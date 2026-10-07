import { StaffWorkItemsService } from './staff-work-items.service';
import { staffBookingView } from './staff-booking-view';
import { BookingsController } from './bookings.controller';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const user: AuthUser = { id: 'u', email: 'staff@test', roles: ['STAFF'], sessionType: 'salon', workspace: 'SALON',
  businessId: 'business', scopes: [{ code: 'STAFF', businessId: 'business', branchId: 'branch' }] };
function setup() {
  const started = new Date('2026-10-05T03:00:00Z');
  const row = { id: 'item', staffId: 'staff', bookingId: 'booking', serviceId: 'service',
    serviceNameSnapshot: 'Haircut', status: 'IN_PROGRESS', revision: 2, durationMinutes: 30,
    itemStartAt: null, itemEndAt: null, priceAtBooking: 900, staff: { emergencyContactPhone: 'secret' },
    refs_BookingServiceAdjustment_bookingServiceId: [{ action: 'START', createdAt: started, version: 1,
      beforeSnapshot: { status: 'SCHEDULED', price: 900 }, afterSnapshot: { status: 'IN_PROGRESS' } }],
    booking: { id: 'booking', bookingCode: 'BB001', branchId: 'branch', status: 'IN_PROGRESS',
      totalAmount: 900, note: 'private note', appointmentDate: new Date('2026-10-05'),
      appointmentStartTime: started, appointmentEndTime: started,
      customer: { note: 'health', user: { fullName: 'Customer', phone: 'secret', email: 'secret' } },
      branch: { id: 'branch', name: 'Branch', businessId: 'business', timezone: 'Asia/Ho_Chi_Minh' } } };
  const prisma = { staffProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'staff' }) },
    bookingService: { findMany: jest.fn().mockResolvedValue([row]), findFirst: jest.fn().mockResolvedValue(row),
      count: jest.fn().mockResolvedValue(1) } };
  return { row, started, prisma, service: new StaffWorkItemsService(prisma as any) };
}

describe('personal STAFF work contract', () => {
  it('includes unresolved older work with the same staff/branch scope, without adding terminal history', async () => {
    const { service, prisma } = setup();
    await service.list(user, { branchId: 'branch', dateFrom: '2026-10-06', dateTo: '2026-10-06', includeUnresolved: 'true' });
    const args = prisma.bookingService.findMany.mock.calls[0][0];
    expect(args.where.staffId).toBe('staff');
    expect(args.where.booking.AND).toContainEqual({ branchId: 'branch' });
    expect(args.where.OR[1].status.in).toEqual(['SCHEDULED', 'IN_PROGRESS']);
    expect(args.where.OR[1].booking.status.in).toEqual(['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']);
    expect(args.where.OR[1].OR[0].itemStartAt.lte).toBeInstanceOf(Date);
    expect(prisma.bookingService.count.mock.calls[0][0].where).toEqual(args.where);
  });
  it('queries assigned items and exact active scopes with batched timing; allowlists every field', async () => {
    const { service, prisma, started } = setup();
    const result = await service.list(user, { dateFrom: '2026-10-05', dateTo: '2026-10-05' });
    const args = prisma.bookingService.findMany.mock.calls[0][0];
    expect(args.where.staffId).toBe('staff');
    expect(args.where.staff).toEqual({ userId: 'u', status: 'ACTIVE', deletedAt: null });
    expect(args.where.booking.AND[0].OR).toEqual([{ branch: { businessId: 'business', id: 'branch' } }]);
    expect(args.select).not.toHaveProperty('priceAtBooking');
    expect(args.select.booking.select).not.toHaveProperty('payments');
    expect(args.select.booking.select.customer.select.user.select).toEqual({ fullName: true });
    expect(prisma.bookingService.findFirst).not.toHaveBeenCalled();
    expect(result.data[0]).toMatchObject({ id: 'item', revision: 2, actualStartedAt: started,
      actualCompletedAt: null, actualTimingSource: 'SERVICE_ADJUSTMENT', canStart: false, canComplete: true });
    expect(result.data[0].serverNow).toBe(result.serverNow);
    expect(JSON.stringify(result)).not.toMatch(/secret|priceAtBooking|totalAmount|private note|health|beforeSnapshot/);
  });

  it('resolves booking notification items without date filters and preserves item pagination totals', async () => {
    const { service, prisma } = setup();
    await service.list(user, { bookingId: 'booking', page: '2', limit: '10' });
    const args = prisma.bookingService.findMany.mock.calls[0][0];
    expect(args.where.booking.AND).toContainEqual({ id: 'booking' });
    expect(args.where.booking).not.toHaveProperty('appointmentDate');
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(prisma.bookingService.count.mock.calls[0][0].where).toEqual(args.where);
  });

  it.each(['CUSTOMER', 'RECEPTIONIST', 'PLATFORM_ADMIN'])('denies %s work authority', async (role) => {
    const { service, prisma } = setup();
    await expect(service.list({ ...user, roles: [role], scopes: [{ code: role, businessId: 'business', branchId: 'branch' }] }))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.bookingService.findMany).not.toHaveBeenCalled();
  });

  it('denies expired scope and prevents Owner in A from broadening Staff in B', async () => {
    const { service, prisma } = setup();
    await expect(service.list({ ...user, scopes: [{ ...user.scopes[0], expiresAt: '2000-01-01' }] }))
      .rejects.toMatchObject({ status: 403 });
    await service.list({ ...user, businessId: 'B', roles: ['STAFF', 'BUSINESS_OWNER'], scopes: [
      { code: 'BUSINESS_OWNER', businessId: 'A' }, { code: 'STAFF', businessId: 'B', branchId: 'B1' },
    ] });
    expect(prisma.bookingService.findMany.mock.calls[0][0].where.booking.AND[0].OR)
      .toEqual([{ branch: { businessId: 'B', id: 'B1' } }]);
  });

  it('supports Owner personal work only with linked profile and tenant authority', async () => {
    const { service, prisma } = setup();
    await service.list({ ...user, roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business' }] });
    expect(prisma.bookingService.findMany.mock.calls[0][0].where).toMatchObject({ staffId: 'staff',
      booking: { AND: [{ OR: [{ branch: { businessId: 'business' } }] }] } });
    prisma.staffProfile.findFirst.mockResolvedValueOnce(null);
    await expect(service.list(user)).rejects.toMatchObject({ status: 404,
      response: { code: 'STAFF_PROFILE_REQUIRED' } });
  });

  it('returns404 for reassigned or out-of-scope item using same scope and active profile filters', async () => {
    const { service, prisma } = setup();
    prisma.bookingService.findFirst.mockResolvedValueOnce(null);
    await expect(service.detail(user, 'coworker-item')).rejects.toMatchObject({ status: 404 });
    expect(prisma.bookingService.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'coworker-item', staffId: 'staff',
      booking: { OR: [{ branch: { businessId: 'business', id: 'branch' } }] } });
  });

  it.each([{ dateFrom: '2026-02-30' }, { dateFrom: '2026-10-06', dateTo: '2026-10-05' },
    { page: '0' }, { limit: '101' }])('rejects invalid work query %j', async (query) => {
    await expect(setup().service.list(user, query)).rejects.toMatchObject({ status: 400 });
  });

  it('keeps legacy envelopes safe and omits other providers even after lifecycle mutations', async () => {
    const booking = { id: 'booking', serverNow: new Date('2026-10-05T03:00:00Z'), totalAmount: 900, payments: [{ amount: 900 }],
      customer: { user: { fullName: 'Customer', phone: 'secret' } }, bookingServices: [
        { id: 'mine', staffId: 'staff', status: 'COMPLETED', priceAtBooking: 900,
          staff: { id: 'staff', emergencyContactPhone: 'secret' }, service: { price: 900 } },
        { id: 'other', staffId: 'coworker', status: 'IN_PROGRESS' },
      ] };
    const projected = staffBookingView(booking, 'staff');
    expect(projected.bookingServices.map((item: any) => item.id)).toEqual(['mine']);
    expect(JSON.stringify(projected)).not.toMatch(/secret|price|amount|other|payments/);
    const access = { assertWrite: jest.fn().mockResolvedValue({ businessId: 'business', branchId: 'branch' }),
      rolesAtResource: jest.fn().mockReturnValue(['STAFF']) };
    const items = { update: jest.fn().mockResolvedValue(booking) };
    const controller = new BookingsController({} as any, access as any, {} as any, {} as any, {} as any,
      {} as any, items as any, { profileId: jest.fn().mockResolvedValue('staff') } as any);
    expect(await controller.updateBookingItem('booking', 'mine', { action: 'COMPLETE', expectedRevision: 2, reason: 'Complete' }, user))
      .toEqual(projected);
    expect(items.update.mock.calls[0][4]).toEqual({ assignedStaffUserId: 'u' });
  });
});
