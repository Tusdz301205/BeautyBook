import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import * as tenancy from '../common/utils/multi-tenancy';
import * as policy from '../common/utils/policy';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const owner = { id: 'owner', roles: ['BUSINESS_OWNER'] } as AuthUser;
const admin = { id: 'admin', roles: ['PLATFORM_ADMIN'] } as AuthUser;
function setup() {
  jest.spyOn(tenancy, 'assertBranchAccess').mockResolvedValue('business');
  jest.spyOn(policy, 'canOnResource').mockImplementation(user => user.roles.includes('PLATFORM_ADMIN'));
  const services = { review: jest.fn(), submit: jest.fn(), publish: jest.fn(), getReadiness: jest.fn() };
  const state = { transition: jest.fn(), canonicalState: jest.fn() };
  const prisma = { branch: { findUnique: jest.fn().mockResolvedValue({ operationalStatus: 'PAUSED', reviewStatus: 'APPROVED' }) } };
  return { controller: new BranchesController(services as never, state as never, prisma as never), services, state, prisma };
}
afterEach(() => jest.restoreAllMocks());
describe('Generic branch transition cannot bypass dedicated workflows', () => {
  test.each(['APPROVE', 'REQUEST_INFO', 'REJECT', 'SUSPEND'])('owner cannot invoke platform-only %s through transition', async action => {
    const { controller, state, services } = setup();
    await expect(controller.transition('branch', { action: action as never, reason: 'QA reason' }, owner)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.transition).not.toHaveBeenCalled(); expect(services.review).not.toHaveBeenCalled();
  });
  test('generic publish propagates readiness rejection without directly setting state', async () => {
    const { controller, services, state } = setup();
    services.publish.mockRejectedValue(new ConflictException('Missing bookable resources'));
    await expect(controller.transition('branch', { action: 'PUBLISH', reason: 'QA reason' }, owner)).rejects.toBeInstanceOf(ConflictException);
    expect(services.publish).toHaveBeenCalledWith('branch', 'owner'); expect(state.transition).not.toHaveBeenCalled();
  });
  test('platform approval processes the review request rather than only changing state', async () => {
    const { controller, services, state } = setup();
    const branch = { id: 'branch', reviewStatus: 'APPROVED' };
    services.review.mockResolvedValue(branch);
    const result = await controller.transition('branch', { action: 'APPROVE', reason: 'QA decision' }, admin);
    expect(services.review).toHaveBeenCalledWith('branch', 'APPROVE', 'QA decision', 'admin');
    expect('branch' in result && result.branch).toBe(branch); expect(state.transition).not.toHaveBeenCalled();
  });
  test('restore cannot activate an incomplete paused branch', async () => {
    const { controller, services, state } = setup();
    services.getReadiness.mockResolvedValue({ ready: false, reasons: ['Missing staff'] });
    await expect(controller.transition('branch', { action: 'RESTORE', reason: 'QA reason' }, owner)).rejects.toBeInstanceOf(ConflictException);
    expect(state.transition).not.toHaveBeenCalled();
  });
  test('owner cannot lift a platform suspension', async () => {
    const { controller, prisma, state } = setup();
    prisma.branch.findUnique.mockResolvedValue({ operationalStatus: 'SUSPENDED' });
    await expect(controller.transition('branch', { action: 'RESTORE', reason: 'QA reason' }, owner)).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.transition).not.toHaveBeenCalled();
  });
  test('platform restores a suspended draft to private onboarding without publication readiness', async () => {
    const { controller, prisma, state, services } = setup();
    prisma.branch.findUnique.mockResolvedValue({ operationalStatus: 'SUSPENDED', reviewStatus: 'DRAFT' });
    state.transition.mockResolvedValue({ transitioned: true, branch: { reviewStatus: 'DRAFT', operationalStatus: 'INACTIVE' } });
    const result = await controller.transition('branch', { action: 'RESTORE', reason: 'Resume onboarding' }, admin);
    expect('branch' in result && result.branch.operationalStatus).toBe('INACTIVE');
    expect(services.getReadiness).not.toHaveBeenCalled();
    expect(state.transition).toHaveBeenCalledWith('branch', 'RESTORE', 'admin', 'Resume onboarding');
  });
});
