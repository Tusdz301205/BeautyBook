import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsAccessService } from './bookings-access.service';
import { BookingsController } from './bookings.controller';
import { BookingItemsService } from './booking-items.service';
import { assertActorStatusTransition } from './bookings.validation';
import { WaitlistController } from '../operations/waitlist.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { REQUIRES_PERMISSION_KEY } from '../common/decorators/permission.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

function methodMetadata(key: string, prototype: object, method: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
  return Reflect.getMetadata(key, descriptor?.value as object) as unknown;
}

const principal = (role: string, branchId = 'branch-a'): AuthUser => ({
  id: 'actor', email: 'actor@example.test', sessionType: 'salon', roles: [role],
  scopes: [{ code: role, businessId: 'business', branchId: role === 'BUSINESS_OWNER' ? null : branchId }],
});

function accessFixture(assigned = false) {
  const booking = {
    id: 'booking', branchId: 'branch-a', customerId: 'customer',
    branch: { businessId: 'business' }, customer: { userId: 'customer-user' },
    bookingServices: [{ staffId: 'provider' }],
  };
  const prisma = {
    branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business' }) },
    booking: { findFirst: jest.fn().mockResolvedValue(booking) },
    staffProfile: { findFirst: jest.fn().mockResolvedValue(assigned ? { userId: 'actor' } : null) },
  };
  return new BookingsAccessService(prisma as never);
}

describe('Booking responsibilities without Manager', () => {
  test.each(['cancel', 'assign', 'reschedule', 'check_in'] as const)(
    'receptionist %s is bound to its own branch', async (action) => {
      const access = accessFixture();
      await expect(access.assertWrite(principal('RECEPTIONIST'), 'booking', action)).resolves.toMatchObject({ branchId: 'branch-a' });
      await expect(access.assertWrite(principal('RECEPTIONIST', 'branch-b'), 'booking', action)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(access.assertWrite(principal('STAFF'), 'booking', action)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  test('receptionist reads its full branch, not a separate staff assignment', async () => {
    const access = accessFixture();
    const mixed = principal('RECEPTIONIST');
    mixed.roles.push('STAFF');
    mixed.scopes.push({ code: 'STAFF', businessId: 'business', branchId: 'branch-b' });
    await expect(access.assertReadBranch(mixed, 'branch-a')).resolves.toBeUndefined();
    await expect(access.assertReadBranch(mixed, 'branch-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('an unrelated receptionist role cannot bypass assigned-staff checks', async () => {
    const mixed = principal('STAFF');
    mixed.roles.push('RECEPTIONIST');
    mixed.scopes.push({ code: 'RECEPTIONIST', businessId: 'business', branchId: 'branch-b' });
    await expect(accessFixture(false).assertWrite(mixed, 'booking')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(accessFixture(true).assertWrite(mixed, 'booking', 'complete')).resolves.toMatchObject({ staffUserId: 'actor' });
    expect(accessFixture().rolesAtResource(mixed, { businessId: 'business', branchId: 'branch-a' })).toEqual(['STAFF']);
  });

  test('retired Manager cannot create, read, or update bookings', async () => {
    const access = accessFixture();
    const retired = principal('BRANCH_MANAGER');
    await expect(access.assertCustomerCreate(retired, 'branch-a')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access.assertReadBranch(retired, 'branch-a')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(access.assertWrite(retired, 'booking')).rejects.toBeInstanceOf(ForbiddenException);
    expect(() => assertActorStatusTransition(retired.roles, 'PENDING', 'CONFIRMED')).toThrow(BadRequestException);
  });

  test.each([
    ['PENDING', 'CONFIRMED'], ['CONFIRMED', 'NO_SHOW'], ['CHECKED_IN', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'COMPLETED'], ['IN_PROGRESS', 'CANCELLED'],
  ])('owner independently permits %s to %s', (from, to) => {
    expect(() => assertActorStatusTransition(['BUSINESS_OWNER'], from, to)).not.toThrow();
  });

  test('receptionist does not inherit owner service lifecycle or override authority', () => {
    expect(() => assertActorStatusTransition(['RECEPTIONIST'], 'CONFIRMED', 'CHECKED_IN')).not.toThrow();
    expect(() => assertActorStatusTransition(['RECEPTIONIST'], 'IN_PROGRESS', 'COMPLETED')).toThrow();
    expect(() => assertActorStatusTransition(['RECEPTIONIST'], 'IN_PROGRESS', 'CANCELLED')).toThrow();
  });

  test.each(['getByBranch', 'approveChangeRequest', 'rejectChangeRequest', 'pendingChangeRequests'])(
    '%s exposes the counter workflow but not Manager', (method) => {
      const roles = methodMetadata(ROLES_KEY, BookingsController.prototype, method);
      expect(roles).toContain('RECEPTIONIST');
      expect(roles).not.toContain('BRANCH_MANAGER');
    },
  );

  test('waitlist offers are available to receptionist while resize stays owner-only', () => {
    expect(methodMetadata(ROLES_KEY, WaitlistController.prototype, 'offer')).toEqual(['BUSINESS_OWNER', 'RECEPTIONIST']);
    expect(methodMetadata(ROLES_KEY, BookingsController.prototype, 'resizeBooking')).toEqual(['BUSINESS_OWNER']);
    expect(methodMetadata(REQUIRES_PERMISSION_KEY, BookingsController.prototype, 'assignStaff'))
      .toEqual(['booking:assign:branch', 'booking:assign:tenant']);
    expect(methodMetadata(REQUIRES_PERMISSION_KEY, BookingsController.prototype, 'moveBooking'))
      .toEqual(['booking:reschedule:branch', 'booking:update:tenant']);
  });

  test('a receptionist role at another branch cannot add a service as assigned staff', async () => {
    const mixed = principal('STAFF');
    mixed.roles.push('RECEPTIONIST');
    mixed.scopes.push({ code: 'RECEPTIONIST', businessId: 'business', branchId: 'branch-b' });
    const items = { add: jest.fn() };
    const controller = new BookingsController({} as never, accessFixture(true), {} as never,
      {} as never, {} as never, {} as never, items as never);
    await expect(controller.addBookingItem('booking', { serviceId: 'service', reason: 'Add' }, mixed))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(items.add).not.toHaveBeenCalled();
    await controller.addBookingItem('booking', { serviceId: 'service', reason: 'Add' }, principal('RECEPTIONIST'));
    expect(items.add).toHaveBeenCalledTimes(1);
  });

  test('an owner role in another tenant cannot authorize resize for a receptionist booking', async () => {
    const mixed = principal('RECEPTIONIST');
    mixed.roles.push('BUSINESS_OWNER');
    mixed.scopes.push({ code: 'BUSINESS_OWNER', businessId: 'other-business', branchId: null });
    const bookings = { resizeBooking: jest.fn() };
    const controller = new BookingsController(bookings as never, accessFixture(), {} as never,
      {} as never, {} as never, {} as never, {} as never);
    await expect(controller.resizeBooking('booking', { newEndTime: '2026-09-20T10:00:00Z' }, mixed))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(bookings.resizeBooking).not.toHaveBeenCalled();
    await controller.resizeBooking('booking', { newEndTime: '2026-09-20T10:00:00Z' }, principal('BUSINESS_OWNER'));
    expect(bookings.resizeBooking).toHaveBeenCalledTimes(1);
  });

  test('owner-only booking metrics omit other roles and their tenant scopes', async () => {
    const mixed = principal('STAFF');
    mixed.roles.push('BUSINESS_OWNER');
    mixed.scopes.push({ code: 'BUSINESS_OWNER', businessId: 'owner-business', branchId: null });
    const bookings = { getStatsForBranches: jest.fn().mockResolvedValue({}) };
    const prisma = { branch: { findMany: jest.fn().mockResolvedValue([{ id: 'owner-branch' }]) } };
    const controller = new BookingsController(bookings as never, accessFixture(), prisma as never,
      {} as never, {} as never, {} as never, {} as never);
    await controller.getStats(mixed);
    expect(prisma.branch.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      where: { businessId: 'owner-business', deletedAt: null }, select: { id: true },
    });
    expect(bookings.getStatsForBranches).toHaveBeenCalledWith(['owner-branch']);
  });

  test.each(['START', 'COMPLETE'] as const)('controller preserves exact staff authorization for %s', async (action) => {
    const mixed = principal('STAFF');
    mixed.roles.push('BUSINESS_OWNER');
    mixed.scopes.push({ code: 'BUSINESS_OWNER', businessId: 'other-business', branchId: null });
    const items = { update: jest.fn() };
    const controller = new BookingsController({} as never, accessFixture(true), {} as never,
      {} as never, {} as never, {} as never, items as never);
    const body = { action, expectedRevision: 1, reason: 'Service lifecycle' };
    await controller.updateBookingItem('booking', 'item', body, mixed);
    expect(items.update).toHaveBeenCalledWith('booking', 'item', 'actor', body, { assignedStaffUserId: 'actor' });
    items.update.mockClear();
    await expect(controller.updateBookingItem('booking', 'item', body, principal('RECEPTIONIST')))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(items.update).not.toHaveBeenCalled();
  });

  test.each(['branch', 'offer'] as const)('waitlist %s rejects receptionist/staff scope mixing', async (method) => {
    const mixed = principal('STAFF');
    mixed.roles.push('RECEPTIONIST');
    mixed.scopes.push({ code: 'RECEPTIONIST', businessId: 'business', branchId: 'branch-b' });
    const waitlist = { listBranch: jest.fn(), offer: jest.fn() };
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business' }) },
      waitlistEntry: { findUniqueOrThrow: jest.fn().mockResolvedValue({ branchId: 'branch-a' }) },
    };
    const controller = new WaitlistController(waitlist as never, prisma as never);
    const invoke = (user: AuthUser) => method === 'branch'
      ? controller.branch('branch-a', user) : controller.offer('entry', {}, user);
    await expect(invoke(mixed)).rejects.toBeInstanceOf(ForbiddenException);
    expect(waitlist.listBranch).not.toHaveBeenCalled();
    expect(waitlist.offer).not.toHaveBeenCalled();
    await invoke(principal('RECEPTIONIST'));
    expect(method === 'branch' ? waitlist.listBranch : waitlist.offer).toHaveBeenCalledTimes(1);
  });
});

describe('Assigned service item authorization under transaction lock', () => {
  function fixture(assigned: boolean) {
    const item = { id: 'item', bookingId: 'booking', staffId: 'provider', revision: 1,
      status: 'IN_PROGRESS', priceAtBooking: 100, booking: { status: 'IN_PROGRESS' } };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      staffProfile: { findFirst: jest.fn().mockResolvedValue(assigned ? { id: 'provider' } : null) },
      bookingService: {
        findFirst: jest.fn().mockResolvedValue(item),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...item, status: 'COMPLETED', revision: 2 }),
      },
    };
    const service = new BookingItemsService({ $transaction: jest.fn(<T>(fn: (client: typeof tx) => Promise<T>) => fn(tx)) } as never);
    jest.spyOn(service as any, 'recordAdjustment').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'detail').mockResolvedValue({ id: 'booking' });
    return { service, tx };
  }

  test('staff assigned another item cannot complete this item', async () => {
    const { service, tx } = fixture(false);
    await expect(service.update('booking', 'item', 'actor',
      { action: 'COMPLETE', expectedRevision: 1, reason: 'Done' }, { assignedStaffUserId: 'actor' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.staffProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 'provider', userId: 'actor', status: 'ACTIVE', deletedAt: null }, select: { id: true },
    });
    expect(tx.bookingService.updateMany).not.toHaveBeenCalled();
  });

  test('assigned staff can complete with optimistic revision check preserved', async () => {
    const { service, tx } = fixture(true);
    await expect(service.update('booking', 'item', 'actor',
      { action: 'COMPLETE', expectedRevision: 1, reason: 'Done' }, { assignedStaffUserId: 'actor' }))
      .resolves.toEqual({ id: 'booking' });
    expect(tx.bookingService.updateMany).toHaveBeenCalledWith({
      where: { id: 'item', bookingId: 'booking', revision: 1 }, data: { revision: { increment: 1 }, status: 'COMPLETED' },
    });
  });
});
