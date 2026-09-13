import { BadRequestException } from '@nestjs/common';
import {
  assertActorStatusTransition,
  assertCustomerNotDoubleBooked,
  assertNoOverlap,
  assertStatusTransition,
  assertTimeAllowedForStatusTransition,
  validateStaffForService,
} from './bookings.validation';
import type { PrismaService } from '../prisma/prisma.service';

describe('booking status authorization', () => {
  test('receptionist confirms and checks in but cannot complete service', () => {
    expect(() =>
      assertActorStatusTransition(['RECEPTIONIST'], 'PENDING', 'CONFIRMED'),
    ).not.toThrow();
    expect(() =>
      assertActorStatusTransition(['RECEPTIONIST'], 'CONFIRMED', 'CHECKED_IN'),
    ).not.toThrow();
    expect(() =>
      assertActorStatusTransition(['RECEPTIONIST'], 'IN_PROGRESS', 'COMPLETED'),
    ).toThrow(BadRequestException);
  });

  test('staff starts checked-in work and completes in-progress work', () => {
    expect(() =>
      assertActorStatusTransition(['STAFF'], 'CHECKED_IN', 'IN_PROGRESS'),
    ).not.toThrow();
    expect(() =>
      assertActorStatusTransition(['STAFF'], 'IN_PROGRESS', 'COMPLETED'),
    ).not.toThrow();
  });

  test('customer may cancel but cannot confirm their own booking', () => {
    expect(() =>
      assertActorStatusTransition(['CUSTOMER'], 'PENDING', 'CANCELLED'),
    ).not.toThrow();
    expect(() =>
      assertActorStatusTransition(['CUSTOMER'], 'PENDING', 'CONFIRMED'),
    ).toThrow(BadRequestException);
  });

  test('global state machine requires CHECKED_IN before IN_PROGRESS', () => {
    expect(() => assertStatusTransition('CONFIRMED', 'IN_PROGRESS')).toThrow(
      BadRequestException,
    );
    expect(() => assertStatusTransition('CONFIRMED', 'CHECKED_IN')).not.toThrow();
  });
});

describe('booking status time guard', () => {
  const start = new Date('2026-07-20T03:00:00.000Z');
  const end = new Date('2026-07-20T04:00:00.000Z');

  test('future CONFIRMED booking cannot check in', () => {
    expect(() => assertTimeAllowedForStatusTransition({
      fromStatus: 'CONFIRMED', toStatus: 'CHECKED_IN',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date('2026-07-20T01:00:00.000Z'),
    })).toThrow(BadRequestException);
  });

  test('future CHECKED_IN booking cannot start service', () => {
    expect(() => assertTimeAllowedForStatusTransition({
      fromStatus: 'CHECKED_IN', toStatus: 'IN_PROGRESS',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date('2026-07-20T02:59:59.000Z'),
    })).toThrow(BadRequestException);
  });

  test('future IN_PROGRESS booking cannot complete', () => {
    expect(() => assertTimeAllowedForStatusTransition({
      fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date('2026-07-20T03:59:59.000Z'),
    })).toThrow(BadRequestException);
  });

  test('past IN_PROGRESS booking can complete', () => {
    expect(() => assertTimeAllowedForStatusTransition({
      fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date('2026-07-20T04:00:00.000Z'),
    })).not.toThrow();
  });

  test('CONFIRMED booking cannot be marked no-show during grace period', () => {
    expect(() => assertTimeAllowedForStatusTransition({
      fromStatus: 'CONFIRMED', toStatus: 'NO_SHOW',
      appointmentStartTime: start, appointmentEndTime: end,
      now: new Date('2026-07-20T03:15:00.000Z'), noShowGraceMinutes: 15,
    })).toThrow(BadRequestException);
  });
});

describe('branch-based staff availability', () => {
  const start = new Date('2026-07-13T03:00:00.000Z');
  const end = new Date('2026-07-13T04:00:00.000Z');

  function prismaStub(options: {
    isBookable?: boolean;
    inactiveUser?: boolean;
    branchClosed?: boolean;
    holidayClosed?: boolean;
    specialOpening?: boolean;
  } = {}): PrismaService {
    return {
      staffProfile: { findUnique: jest.fn().mockResolvedValue({
        id: 'staff-1', branchId: 'branch-1', status: 'ACTIVE',
        isBookable: options.isBookable ?? true,
        userId: options.inactiveUser ? 'user-1' : null,
        user: options.inactiveUser ? { isActive: false, deletedAt: null } : null,
        staffServices: [{ serviceId: 'service-1' }],
      }) },
      branchHoliday: { findUnique: jest.fn().mockResolvedValue(
        options.holidayClosed ? { id: 'holiday-1', isClosed: true, name: 'Ngày nghỉ' } : null,
      ) },
      specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(
        options.specialOpening ? {
          id: 'special-1',
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          endTime: new Date('1970-01-01T18:00:00.000Z'),
        } : null,
      ) },
      branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({
        isClosed: options.branchClosed ?? false,
        openTime: new Date('1970-01-01T09:00:00.000Z'),
        closeTime: new Date('1970-01-01T18:00:00.000Z'),
      }) },
    } as unknown as PrismaService;
  }

  test('active skilled provider is valid without an individual schedule', async () => {
    await expect(
      validateStaffForService(prismaStub(), 'staff-1', 'service-1', start, end, 'branch-1'),
    ).resolves.toBeUndefined();
  });

  test('branch closure blocks assignment', async () => {
    await expect(
      validateStaffForService(prismaStub({ branchClosed: true }), 'staff-1', 'service-1', start, end),
    ).rejects.toThrow('Chi nhánh đóng cửa');
  });

  test('special branch opening overrides a closed holiday', async () => {
    await expect(
      validateStaffForService(
        prismaStub({ holidayClosed: true, specialOpening: true }),
        'staff-1', 'service-1', start, end,
      ),
    ).resolves.toBeUndefined();
  });

  test('profile disabled for booking cannot be assigned even when it has the skill', async () => {
    await expect(
      validateStaffForService(prismaStub({ isBookable: false }), 'staff-1', 'service-1', start, end),
    ).rejects.toThrow('chưa được bật nhận lịch');
  });

  test('inactive linked account cannot receive a booking', async () => {
    await expect(
      validateStaffForService(prismaStub({ inactiveUser: true }), 'staff-1', 'service-1', start, end),
    ).rejects.toThrow('không còn hoạt động');
  });
});

describe('date-aware booking overlap', () => {
  test('provider overlap uses item intervals and a date-aware legacy fallback', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { bookingService: { findFirst } } as unknown as PrismaService;
    await assertNoOverlap(
      prisma,
      'staff-1',
      null,
      new Date('2026-07-15T02:00:00.000Z'),
      new Date('2026-07-15T03:00:00.000Z'),
    );

    const where = findFirst.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({
      itemStartAt: { lt: new Date('2026-07-15T03:00:00.000Z') },
      itemEndAt: { gt: new Date('2026-07-15T02:00:00.000Z') },
    });
    expect(where.OR[1].booking).toEqual({
      appointmentDate: new Date('2026-07-15T00:00:00.000Z'),
      AND: [
        { appointmentStartTime: { lt: new Date('1970-01-01T10:00:00.000Z') } },
        { appointmentEndTime: { gt: new Date('1970-01-01T09:00:00.000Z') } },
      ],
    });
  });

  test('customer overlap query uses half-open adjacent intervals on one date', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { booking: { findFirst } } as unknown as PrismaService;
    await assertCustomerNotDoubleBooked(
      prisma,
      'customer-1',
      null,
      new Date('2026-07-20T03:00:00.000Z'),
      new Date('2026-07-20T04:00:00.000Z'),
    );

    const where = findFirst.mock.calls[0][0].where;
    expect(where.appointmentDate).toEqual(new Date('2026-07-20T00:00:00.000Z'));
    expect(where.AND).toEqual([
      { appointmentStartTime: { lt: new Date('1970-01-01T11:00:00.000Z') } },
      { appointmentEndTime: { gt: new Date('1970-01-01T10:00:00.000Z') } },
    ]);
  });
});
