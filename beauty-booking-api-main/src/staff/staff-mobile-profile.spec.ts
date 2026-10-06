import { StaffService } from './staff.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const user: AuthUser = { id: 'u', email: 'staff@test', sessionType: 'salon', businessId: 'business', roles: ['STAFF'],
  scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] };
describe('mobile staff profile scope', () => {
  const row = { id: 'staff', branchId: 'branch', fullName: 'Staff', position: 'Stylist', status: 'ACTIVE',
    branch: { id: 'branch', name: 'Branch', businessId: 'business', timezone: 'Asia/Ho_Chi_Minh' } };
  function setup() {
    const prisma = { staffProfile: { findFirst: jest.fn().mockResolvedValue(row) } };
    return { prisma, service: new StaffService(prisma as any, {} as any) };
  }
  it('selects only active nondeleted linked profile and returns minimal own data', async () => {
    const { service, prisma } = setup();
    await expect(service.findMine('u', user)).resolves.toEqual(row);
    expect(prisma.staffProfile.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u', status: 'ACTIVE', deletedAt: null });
    const select = prisma.staffProfile.findFirst.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('emergencyContactPhone');
    expect(select.branch.select.timezone).toBe(true);
  });
  it.each([
    { ...user, businessId: 'other' }, { ...user, branchId: 'other' },
    { ...user, scopes: [{ code: 'STAFF', businessId: 'wrong-business', branchId: 'branch' }] },
    { ...user, scopes: [{ ...user.scopes[0], expiresAt: '2000-01-01' }] },
    { ...user, roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'other' }] },
  ])('denies profile outside exact live role scope', async (principal) => {
    await expect(setup().service.findMine('u', principal)).rejects.toMatchObject({ status: 403 });
  });
  it('returns explicit linkage state for missing/inactive profile', async () => {
    const { service, prisma } = setup();
    prisma.staffProfile.findFirst.mockResolvedValueOnce(null);
    await expect(service.findMine('u', user)).rejects.toMatchObject({ status: 404, response: { code: 'STAFF_PROFILE_REQUIRED' } });
  });
});
