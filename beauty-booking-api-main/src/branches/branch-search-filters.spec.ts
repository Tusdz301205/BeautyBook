import { BranchesService } from './branches.service';

describe('branch area/service filters before pagination', () => {
  test('intersects exact ID/category/price with area, service and branch names', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 'district-match' }]).mockResolvedValueOnce([{ id: 'service-match' }]).mockResolvedValueOnce([{ id: 'branch-match' }]),
      branch: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await new BranchesService(prisma, {} as never, {} as never).findAll({ districtId: 'EXACT-ID', area: '  HA   NOI ', serviceQuery: ' CHAM   SOC DA ', search: 'duong', categoryId: 'EXACT-CATEGORY', minPrice: 100, maxPrice: 200, page: 3, limit: 10 });
    const args = prisma.branch.findMany.mock.calls[0][0], where = args.where;
    expect(where.districtId).toBe('EXACT-ID');
    expect(where.district).toEqual({ id: { in: ['district-match'] } });
    expect(where.id).toEqual({ in: ['branch-match'] });
    expect(where.services.some).toEqual({ deletedAt: null, status: 'ACTIVE', categoryId: 'EXACT-CATEGORY', id: { in: ['service-match'] }, price: { gte: 100, lte: 200 } });
    expect(where.business.bookingRestrictedAt).toBeNull();
    expect(args).toMatchObject({ skip: 20, take: 10 });
    const queries = prisma.$queryRaw.mock.calls.map(([sql]) => sql);
    expect(queries[0].values).toContain('%ha noi%');
    expect(queries[1].values).toContain('%cham soc da%');
    expect(queries.every(sql => sql.sql.includes('translate'))).toBe(true);
  });
  test('no matches does not drop the service constraint', async () => {
    const prisma: any = { $queryRaw: jest.fn().mockResolvedValue([]), branch: { findMany: jest.fn().mockResolvedValue([]) } };
    await new BranchesService(prisma, {} as never, {} as never).findAll({ serviceQuery: 'unknown' });
    expect(prisma.branch.findMany.mock.calls[0][0].where.services.some.id).toEqual({ in: [] });
  });
  test('page and count retain the same branch/status/category scope', async () => {
    const prisma: any = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'service-match' }]), branchServiceOffering: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const service = new BranchesService(prisma, {} as never, {} as never);
    jest.spyOn(service as any, 'findPublicBranchIdentity').mockResolvedValue({ id: 'branch-exact' });
    await service.findPublicServices('branch-exact', { search: 'cham soc da', categoryId: 'category-exact', page: 2, limit: 7 });
    const where = { branchId: 'branch-exact', status: 'ACTIVE', deletedAt: null, categoryId: 'category-exact', id: { in: ['service-match'] } };
    expect(prisma.branchServiceOffering.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 7, take: 7 }));
    expect(prisma.branchServiceOffering.count).toHaveBeenCalledWith({ where });
    expect(prisma.$queryRaw.mock.calls[0][0].values).toContain('branch-exact');
    expect(prisma.$queryRaw.mock.calls[0][0].sql).not.toContain('::uuid'); // IDs are text columns in the existing Prisma schema.
  });
});
