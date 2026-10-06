import { BranchesService } from './branches.service';
describe('mobile accessible branches', () => {
  it('preserves tenant Owner branches with Staff elsewhere and selects timezone', async () => {
    const findMany = jest.fn().mockImplementation(({ select, where }) => Promise.resolve(select.name
      ? [{ id: 'A1', timezone: 'Asia/Ho_Chi_Minh' }] : [{ id: 'A1' }, { id: 'A2' }]));
    const service = new BranchesService({ branch: { findMany } } as any, {} as any, {} as any);
    await service.findAccessible({ id: 'u', email: 'u@test', sessionType: 'salon', businessId: 'A',
      roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [
        { code: 'BUSINESS_OWNER', businessId: 'A' }, { code: 'STAFF', businessId: 'B', branchId: 'B1' },
      ] });
    const args = findMany.mock.calls.at(-1)![0];
    expect(args.where).toEqual({ deletedAt: null, id: { in: ['A1', 'A2'] }, businessId: { in: ['A'] } });
    expect(args.select.timezone).toBe(true);
  });
});
