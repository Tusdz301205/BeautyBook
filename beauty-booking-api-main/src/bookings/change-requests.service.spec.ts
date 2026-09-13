import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';

describe('ChangeRequestsService expiration and concurrency', () => {
  test('does not create a second active pending request for one booking', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }) },
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'pending-1' }),
      },
    } as unknown as PrismaService;

    await expect(
      new ChangeRequestsService(prisma, {} as never, {} as never).create(
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
      new ChangeRequestsService(prisma, {} as never, {} as never).approve('request-1', 'manager-1'),
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
    } as unknown as PrismaService;
    await new ChangeRequestsService(prisma, {} as never, {} as never).listPending();
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
    } as unknown as PrismaService;

    await new ChangeRequestsService(prisma, {} as never, {} as never).listPending(['business-1'], ['branch-1']);
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
    } as never, { releaseBookingBenefits: jest.fn() } as never);
    const result = await service.approve('request-1', 'manager-1');
    expect(result).toMatchObject({ status: 'CANCELLED', pendingExpiresAt: null, cancellationFeeAmount: null });
    expect(result.bookingServices[0]).toMatchObject({ status: 'CANCELLED', revision: 2 });
    expect(tx.bookingService.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED', revision: { increment: 1 } },
    });
  });
});
