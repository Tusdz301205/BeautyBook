import { ConflictException, Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';
import { notifyBookingBothParties, notifySalonMembers } from '../common/utils/notify';
import * as validation from './bookings.validation';

jest.mock('../common/utils/notify', () => ({ notifyBookingBothParties: jest.fn(), notifySalonMembers: jest.fn() }));
const scheduler = () => ({ notifyBookingUpdated: jest.fn() });

describe('ChangeRequestsService expiration and concurrency', () => {
  beforeEach(() => { jest.spyOn(Logger.prototype, 'warn').mockImplementation(); });
  afterEach(() => jest.restoreAllMocks());
  test('does not create a second active pending request for one booking', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (operation) => operation(prisma)),
      booking: { findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1', status: 'CONFIRMED', customer: { userId: 'customer-1' },
        appointmentDate: new Date('2099-01-01'), appointmentStartTime: new Date('1970-01-01T09:00:00Z'),
      }) },
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'pending-1' }),
      },
    } as unknown as PrismaService;

    await expect(
      new ChangeRequestsService(prisma, {} as never, {} as never, scheduler() as never).create(
        'booking-1',
        'customer-1',
        'CUSTOMER',
        { requestType: 'CANCEL' },
      ),
    ).rejects.toThrow('đang chờ xử lý');
  });

  test('expired request cannot be approved and is lazily marked expired', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      appointmentChangeRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'request-1',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 1_000),
          booking: { bookingServices: [], branch: { businessId: 'biz-1' } },
        }),
        updateMany,
      },
    } as unknown as PrismaService;

    await expect(
      new ChangeRequestsService(prisma, {} as never, {} as never, scheduler() as never).approve('request-1', 'manager-1'),
    ).rejects.toThrow('hết hạn');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  });

  test('pending list expires stale rows and excludes them from the query', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany,
      },
      $transaction: jest.fn(async (operation) => operation({ appointmentChangeRequest: {
        findMany: jest.fn().mockResolvedValue([{ bookingId: 'booking-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      } })),
    } as unknown as PrismaService;
    await new ChangeRequestsService(prisma, {} as never, {} as never, scheduler() as never).listPending();
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ status: 'PENDING', expiresAt: { gt: expect.any(Date) } }),
    );
  });

  test('pending list prefers explicit branch scope over tenant-wide scope', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany,
      },
      $transaction: jest.fn(async (operation) => operation({ appointmentChangeRequest: {
        findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      } })),
    } as unknown as PrismaService;

    await new ChangeRequestsService(prisma, {} as never, {} as never, scheduler() as never).listPending(['business-1'], ['branch-1']);
    expect(findMany.mock.calls[0][0].where.booking).toEqual({
      branchId: { in: ['branch-1'] },
    });
  });

  test('approved cancellation closes unfinished items before returning the booking detail', async () => {
    const items = [{ id: 'item-1', status: 'SCHEDULED', revision: 1 }];
    const booking = {
      id: 'booking-1', status: 'CONFIRMED', branchId: 'branch-1', voucherId: null,
      branch: { id: 'branch-1', businessId: 'biz-1' }, bookingServices: items,
      appointmentDate: new Date('2099-01-01T00:00:00Z'),
      appointmentStartTime: new Date('1970-01-01T09:00:00Z'), totalAmount: 100,
    };
    const tx: any = {
      bookingViolationEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      appointmentChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      cancellationPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }) => ({ ...booking, ...data, bookingServices: items.map((item) => ({ ...item })) })),
      },
      bookingService: { updateMany: jest.fn(async () => { items[0].status = 'CANCELLED'; items[0].revision += 1; return { count: 1 }; }) },
      bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      appointmentChangeRequest: { findUnique: jest.fn().mockResolvedValue({
        id: 'request-1', bookingId: 'booking-1', requestType: 'CANCEL', status: 'PENDING',
        expiresAt: new Date('2099-01-01'), reason: 'Cancel request', booking,
      }) },
      booking: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (operation) => operation(tx)),
    };
    const service = new ChangeRequestsService(prisma, {
      getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 24 }),
    } as never, { releaseBookingBenefits: jest.fn() } as never, scheduler() as never);
    const result = await service.approve('request-1', 'manager-1');
    expect(result).toMatchObject({ status: 'CANCELLED', pendingExpiresAt: null, cancellationFeeAmount: null });
    expect(result.bookingServices[0]).toMatchObject({ status: 'CANCELLED', revision: 2 });
    expect(tx.bookingService.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED', revision: { increment: 1 } },
    });
  });
});

describe('ChangeRequestsService committed invalidations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.mocked(notifyBookingBothParties).mockResolvedValue(undefined);
    jest.mocked(notifySalonMembers).mockResolvedValue(undefined);
    jest.spyOn(validation, 'validateStaffForService').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertNoOverlap').mockResolvedValue(undefined);
    jest.spyOn(validation, 'assertCustomerNotDoubleBooked').mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  function fixture(requestType: 'CANCEL' | 'RESCHEDULE' | 'STAFF_CHANGE' = 'CANCEL') {
    const booking: any = {
      id: 'booking-1', status: 'CONFIRMED', branchId: 'branch-1', customerId: 'profile-1',
      customer: { userId: 'customer-1' }, branch: { id: 'branch-1', businessId: 'business-1' },
      updatedAt: new Date('2099-01-01T01:00:00Z'), totalAmount: 100, voucherId: null,
      appointmentDate: new Date('2099-01-01T00:00:00Z'),
      appointmentStartTime: new Date('1970-01-01T09:00:00Z'),
      appointmentEndTime: new Date('1970-01-01T10:00:00Z'),
      bookingServices: [{ id: 'item-1', bookingId: 'booking-1', revision: 1, serviceId: 'service-1', staffId: 'staff-1', status: 'SCHEDULED' }],
    };
    const request: any = {
      id: 'request-1', bookingId: booking.id, status: 'PENDING', requestType, requestedByType: 'SALON',
      expiresAt: new Date('2099-01-02'), createdAt: new Date('2098-12-31'), booking,
      proposedStartTime: new Date('2099-01-01T11:00:00Z'), proposedEndTime: new Date('2099-01-01T12:00:00Z'),
      proposedStaffId: 'staff-2',
    };
    let committed = false;
    const tx: any = {
      staffProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'staff-1', userId: 'staff-user-1' }, { id: 'staff-2', userId: 'staff-user-2' }]) },
      bookingServiceAdjustment: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ bookingId: booking.id }]),
        create: jest.fn().mockResolvedValue(request),
      },
      bookingViolationEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      cancellationPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }) => { Object.assign(booking, data); return booking; }),
      },
      bookingService: { update: jest.fn(), updateMany: jest.fn() },
      bookingStatusHistory: { create: jest.fn() },
    };
    const prisma: any = {
      appointmentChangeRequest: { findUnique: jest.fn().mockResolvedValue(request), updateMany: jest.fn(async () => { committed = true; return { count: 1 }; }) },
      cancellationPolicy: tx.cancellationPolicy,
      booking: { findUnique: jest.fn(async ({ where }) => {
        expect(committed).toBe(true);
        return { ...booking, id: where.id };
      }) },
      $transaction: jest.fn(async (operation) => {
        const result = await operation(tx);
        expect(gateway.notifyBookingUpdated).not.toHaveBeenCalled();
        committed = true;
        return result;
      }),
    };
    const gateway = { notifyBookingUpdated: jest.fn(() => { expect(committed).toBe(true); }) };
    const benefits = { releaseBookingBenefits: jest.fn() };
    const service = new ChangeRequestsService(prisma, {
      getEffective: jest.fn().mockResolvedValue({ freeCancellationHours: 24 }),
    } as never, benefits as never, gateway as never);
    return { service, prisma, tx, gateway, booking, request, benefits };
  }

  test.each(['CANCEL', 'RESCHEDULE', 'STAFF_CHANGE'] as const)('%s approval emits only after commit, with sparse customer and tenant scopes', async (type) => {
    const { service, gateway, prisma, tx, booking, benefits } = fixture(type);
    await expect(service.approve('request-1', 'manager-1')).resolves.toBe(booking);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledWith({
      id: 'booking-1', status: type === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
      branchId: 'branch-1', updatedAt: booking.updatedAt, businessId: 'business-1', customerUserId: 'customer-1',
    });
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({ where: { id: 'booking-1' }, select: {
      id: true, status: true, branchId: true, updatedAt: true,
      branch: { select: { businessId: true } }, customer: { select: { userId: true } },
    } });
    if (type === 'CANCEL') expect(benefits.releaseBookingBenefits).toHaveBeenCalledWith(tx, 'booking-1', null, null);
    if (type === 'RESCHEDULE') expect(tx.bookingService.update).toHaveBeenCalled();
    if (type === 'STAFF_CHANGE') expect(tx.bookingService.updateMany).toHaveBeenCalledWith({ where: { bookingId: 'booking-1', status: 'SCHEDULED' }, data: { staffId: 'staff-2', revision: { increment: 1 } } });
    if (type !== 'CANCEL') expect(tx.bookingServiceAdjustment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: 'manager-1', bookingId: 'booking-1', action: 'REASSIGN',
      beforeSnapshot: expect.objectContaining({ staffId: 'staff-1', staffUserId: 'staff-user-1' }),
      afterSnapshot: expect.objectContaining({ staffId: 'staff-2', staffUserId: 'staff-user-2' }),
    }) });
  });

  test('new pending cancellation invalidates only after the transaction resolves', async () => {
    const { service, gateway, request } = fixture();
    await expect(service.create('booking-1', 'manager-1', 'SALON', { requestType: 'CANCEL' })).resolves.toBe(request);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'booking-1', customerUserId: 'customer-1', businessId: 'business-1', branchId: 'branch-1',
    }));
    expect(notifySalonMembers).toHaveBeenCalled();
  });

  test.each(['create', 'approve', 'reject', 'expirePending'] as const)('%s emits nothing when commit fails', async (method) => {
    const { service, prisma, gateway } = fixture();
    prisma.$transaction.mockImplementation(async (operation) => { await operation(fixture().tx); throw new Error('commit failed'); });
    const operation = method === 'create' ? service.create('booking-1', 'manager-1', 'SALON', { requestType: 'CANCEL' })
      : method === 'expirePending' ? service.expirePending() : service[method]('request-1', 'manager-1');
    await expect(operation).rejects.toThrow('commit failed');
    expect(gateway.notifyBookingUpdated).not.toHaveBeenCalled();
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(notifyBookingBothParties).not.toHaveBeenCalled();
  });

  test.each(['approve', 'reject'] as const)('%s returns committed success despite notification failure and still invalidates', async (method) => {
    const { service, gateway } = fixture();
    jest.mocked(notifyBookingBothParties).mockRejectedValueOnce(new Error('SECRET provider details'));
    await expect(service[method]('request-1', 'manager-1')).resolves.toBeDefined();
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'booking-1', customerUserId: 'customer-1', businessId: 'business-1', branchId: 'branch-1',
    }));
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Committed change request: notification delivery failed');
    expect(JSON.stringify(jest.mocked(Logger.prototype.warn).mock.calls)).not.toContain('SECRET');
  });

  test.each(['approve', 'reject'] as const)('%s returns committed success despite emitter failure and still attempts notifications', async (method) => {
    const { service, gateway } = fixture();
    gateway.notifyBookingUpdated.mockImplementation(() => { throw new Error('SECRET socket details'); });
    await expect(service[method]('request-1', 'manager-1')).resolves.toBeDefined();
    expect(notifyBookingBothParties).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledWith('Committed change request: booking invalidation failed');
    expect(JSON.stringify(jest.mocked(Logger.prototype.warn).mock.calls)).not.toContain('SECRET');
  });

  test('postcommit sparse lookup failure cannot reject a committed pending request', async () => {
    const { service, prisma, gateway } = fixture();
    prisma.booking.findUnique.mockRejectedValueOnce(new Error('SECRET database details'));
    await expect(service.create('booking-1', 'manager-1', 'SALON', { requestType: 'CANCEL' })).resolves.toBeDefined();
    expect(gateway.notifyBookingUpdated).not.toHaveBeenCalled();
    expect(JSON.stringify(jest.mocked(Logger.prototype.warn).mock.calls)).not.toContain('SECRET');
  });

  test('expiry deduplicates affected bookings after commit and preserves the affected row count', async () => {
    const { service, tx, gateway } = fixture();
    tx.appointmentChangeRequest.findMany.mockResolvedValue([{ bookingId: 'booking-1' }, { bookingId: 'booking-1' }, { bookingId: 'booking-2' }]);
    tx.appointmentChangeRequest.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.expirePending()).resolves.toBe(3);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(2);
    expect(gateway.notifyBookingUpdated).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ id: 'booking-1', customerUserId: 'customer-1', businessId: 'business-1', branchId: 'branch-1' }));
    expect(gateway.notifyBookingUpdated).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ id: 'booking-2', customerUserId: 'customer-1', businessId: 'business-1', branchId: 'branch-1' }));
    expect(tx.appointmentChangeRequest.findMany.mock.calls[0][0].where).toEqual(tx.appointmentChangeRequest.updateMany.mock.calls[0][0].where);
  });

  test('zero expired rows produces no invalidation', async () => {
    const { service, tx, gateway } = fixture();
    tx.appointmentChangeRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.expirePending('booking-1')).resolves.toBe(0);
    expect(gateway.notifyBookingUpdated).not.toHaveBeenCalled();
    expect(tx.appointmentChangeRequest.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'PENDING', expiresAt: { lte: expect.any(Date) } }, select: { bookingId: true },
    });
  });

  test('async emitter rejection during expiry preserves count and continues other booking invalidations', async () => {
    const { service, tx, gateway } = fixture();
    tx.appointmentChangeRequest.findMany.mockResolvedValue([{ bookingId: 'booking-1' }, { bookingId: 'booking-2' }]);
    tx.appointmentChangeRequest.updateMany.mockResolvedValue({ count: 2 });
    gateway.notifyBookingUpdated.mockImplementationOnce(async () => { throw new Error('SECRET socket details'); });
    await expect(service.expirePending()).resolves.toBe(2);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(jest.mocked(Logger.prototype.warn).mock.calls)).not.toContain('SECRET');
  });

  test('lazy expiration emits after its update succeeds while approval remains rejected', async () => {
    const { service, request, gateway } = fixture();
    request.expiresAt = new Date(Date.now() - 1000);
    await expect(service.approve('request-1', 'manager-1')).rejects.toThrow('hết hạn');
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledTimes(1);
    expect(gateway.notifyBookingUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'booking-1', customerUserId: 'customer-1', businessId: 'business-1', branchId: 'branch-1',
    }));
    expect(notifyBookingBothParties).not.toHaveBeenCalled();
  });
});
