import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ChangeRequestsService } from './change-requests.service';

describe('ChangeRequestsService expiration and concurrency', () => {
  test('does not create a second active pending request for one booking', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1' }) },
      appointmentChangeRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'pending-1' }),
      },
    } as unknown as PrismaService;

    await expect(
      new ChangeRequestsService(prisma).create(
        'booking-1',
        'customer-1',
        'CUSTOMER',
        { requestType: 'CANCEL' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
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
      new ChangeRequestsService(prisma).approve('request-1', 'manager-1'),
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
    await new ChangeRequestsService(prisma).listPending();
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

    await new ChangeRequestsService(prisma).listPending(['business-1'], ['branch-1']);
    expect(findMany.mock.calls[0][0].where.booking).toEqual({
      branchId: { in: ['branch-1'] },
    });
  });
});
