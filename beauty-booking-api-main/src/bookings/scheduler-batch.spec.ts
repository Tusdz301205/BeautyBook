import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import * as tenancy from '../common/utils/multi-tenancy';
import type { AuthUser } from '../common/decorators/current-user.decorator';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const user = { id: 'owner', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'biz' }] } as AuthUser;
const start = '2026-10-08T00:00:00Z', end = '2026-10-09T00:00:00Z';
describe('scheduler batch preserves per-branch scope and staff projection', () => {
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    const controller = Object.assign(Object.create(BookingsController.prototype), { prisma: {} }) as BookingsController;
    const data = jest.spyOn(controller, 'getSchedulerData').mockResolvedValue({ staff: [], bookings: [] } as never);
    return { controller, data };
  }
  it('authorizes every requested branch, deduplicates and delegates to existing scoped single-branch implementation', async () => {
    const { controller, data } = fixture(); const access = jest.spyOn(tenancy, 'assertBranchAccess').mockResolvedValue('biz');
    const result = await controller.getSchedulerBatch(A + ',' + B + ',' + A, start, end, user);
    expect(access).toHaveBeenCalledTimes(2); expect(data).toHaveBeenCalledTimes(2);
    expect(data).toHaveBeenCalledWith(A, start, end, user); expect(data).toHaveBeenCalledWith(B, start, end, user);
    expect(result.branches.map(item => item.branchId)).toEqual([A, B]);
  });
  it('one unauthorized branch rejects before any scheduler payload is fetched', async () => {
    const { controller, data } = fixture(); jest.spyOn(tenancy, 'assertBranchAccess').mockImplementation(async (_db, _user, id) => { if (id === B) throw new ForbiddenException(); return 'biz'; });
    await expect(controller.getSchedulerBatch(A + ',' + B, start, end, user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(data).not.toHaveBeenCalled();
  });
  it.each(['', 'not-a-uuid', Array.from({ length: 51 }, (_, n) => (n + 1).toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111').join(',')])('rejects invalid/unbounded branch set', async ids => {
    const { controller, data } = fixture(); await expect(controller.getSchedulerBatch(ids, start, end, user)).rejects.toBeInstanceOf(BadRequestException); expect(data).not.toHaveBeenCalled();
  });
  it.each([['invalid', end], [end, start], [start, '2027-10-09T00:00:00Z']])('rejects invalid/unbounded date range before fetching', async (from, to) => {
    const { controller, data } = fixture(); await expect(controller.getSchedulerBatch(A, from, to, user)).rejects.toBeInstanceOf(BadRequestException); expect(data).not.toHaveBeenCalled();
  });
});
