import { AdminController } from './admin.controller';
import { REQUIRES_PERMISSION_KEY } from '../common/decorators/permission.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('Admin public canonical group filters with management visibility', () => {
  const canonical = { OR: [
    { id: 'public-group', status: 'ACTIVE', replacementCanonicalId: null },
    { replacement: { id: 'public-group', status: 'ACTIVE' } },
  ] };
  it('restricts management service options to explicit platform booking access', () => {
    const handler = AdminController.prototype.bookingFilterServices;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['PLATFORM_ADMIN']);
    expect(Reflect.getMetadata(REQUIRES_PERMISSION_KEY, handler)).toEqual(['booking:read:platform']);
  });
  function setup() {
    const prisma = {
      business: { count: jest.fn().mockResolvedValue(12), findMany: jest.fn().mockResolvedValue([]) },
      branch: { count: jest.fn().mockResolvedValue(12), findMany: jest.fn().mockResolvedValue([]) },
      branchServiceOffering: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, controller: new AdminController({} as never, prisma as never, {} as never, {} as never) };
  }

  it('filters businesses by live catalog mappings and keeps status/search/pagination', async () => {
    const { controller, prisma } = setup();
    const result = await controller.businessDirectory(' Bloom ', 'SUSPENDED', '2', '10', 'public-group');
    const where = prisma.business.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ deletedAt: null, status: 'SUSPENDED', serviceCatalog: {
      some: { deletedAt: null, canonicalService: canonical },
    } });
    expect(where.serviceCatalog.some).not.toHaveProperty('status');
    expect(where.OR).toContainEqual({ name: { contains: 'Bloom', mode: 'insensitive' } });
    expect(prisma.business.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 10, take: 10 }));
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 12, totalPages: 2 });
  });

  it('requires an offering at the matched branch rather than another branch of its business', async () => {
    const { controller, prisma } = setup();
    await controller.branchDirectory(undefined, 'INACTIVE', '1', '10', 'public-group');
    const where = prisma.branch.count.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null, status: 'INACTIVE', services: { some: {
      deletedAt: null, businessService: { deletedAt: null, canonicalService: canonical },
    } } });
    expect(prisma.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('keeps unfiltered directory requests compatible', async () => {
    const { controller, prisma } = setup();
    await controller.businessDirectory();
    await controller.branchDirectory();
    expect(prisma.business.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(prisma.branch.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('resolves merged service options and includes inactive/non-bookable management offerings', async () => {
    const { controller, prisma } = setup();
    prisma.branchServiceOffering.findMany.mockResolvedValue([
      { id: 'offering', name: 'Old name', businessService: { name: 'Catalog name',
        canonicalService: { id: 'merged', replacementCanonicalId: 'public-group' } } },
    ] as never);
    await expect(controller.bookingFilterServices('branch-a,branch-b')).resolves.toEqual([
      { id: 'offering', name: 'Catalog name', canonicalServiceId: 'public-group' },
    ]);
    const where = prisma.branchServiceOffering.findMany.mock.calls[0][0].where;
    expect(where.branchId).toEqual({ in: ['branch-a', 'branch-b'] });
    expect(where).not.toHaveProperty('status');
    expect(where).not.toHaveProperty('bookable');
    await controller.bookingFilterServices();
    expect(prisma.branchServiceOffering.findMany.mock.calls[1][0].where.branchId).toEqual({ in: [] });
  });
});
