import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';

describe('Booking canonical group query contract', () => {
  it('composes canonical, legacy category, exact service and tenant constraints in row/count queries', async () => {
    const prisma = { booking: {
      findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), fields: {},
    } };
    const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    jest.spyOn(service as any, 'expirePendingHolds').mockResolvedValue(undefined);
    await service.findAll({ canonicalServiceId: 'public-group', categoryId: 'legacy-category',
      serviceId: 'offering', allowedBranchIds: ['branch-a'], customerId: 'customer-a' });
    const where = prisma.booking.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ deletedAt: null, branchId: { in: ['branch-a'] }, customerId: 'customer-a' });
    expect(where.AND).toContainEqual({ bookingServices: { some: { service: { categoryId: 'legacy-category' } } } });
    expect(where.AND).toContainEqual({ bookingServices: { some: {
      serviceId: 'offering', service: { businessService: { canonicalService: { OR: [
        { id: 'public-group', status: 'ACTIVE', replacementCanonicalId: null },
        { replacement: { id: 'public-group', status: 'ACTIVE' } },
      ] } } },
    } } });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('retains an empty branch scope and categoryId compatibility without a canonical group', async () => {
    const prisma = { booking: {
      findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), fields: {},
    } };
    const service = new BookingsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    const expire = jest.spyOn(service as any, 'expirePendingHolds').mockResolvedValue(undefined);
    await service.findAll({ categoryId: 'legacy', allowedBranchIds: [] });
    expect(expire).not.toHaveBeenCalled();
    expect(prisma.booking.count).toHaveBeenCalledWith({ where: {
      deletedAt: null, branchId: { in: [] },
      AND: [{ bookingServices: { some: { service: { categoryId: 'legacy' } } } }],
    } });
  });

  it.each(['PLATFORM_ADMIN', 'CUSTOMER'])('forwards the canonical query for %s while preserving actor scope', async (role) => {
    const bookings = { findAll: jest.fn().mockResolvedValue({ data: [] }) };
    const prisma = { customerProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'own-profile' }) } };
    const controller = new BookingsController(bookings as never, {} as never, prisma as never,
      {} as never, {} as never, {} as never, {} as never);
    const user = { id: 'actor', roles: [role], scopes: [{ code: role }] };
    await controller.findAll(user as never, undefined, undefined, undefined, undefined, 'legacy',
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, 'public-group');
    expect(bookings.findAll).toHaveBeenCalledWith(expect.objectContaining({
      canonicalServiceId: 'public-group', categoryId: 'legacy',
      ...(role === 'CUSTOMER' ? { customerId: 'own-profile' } : {}),
    }));
  });
});
