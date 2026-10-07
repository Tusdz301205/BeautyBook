import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingItemsService } from './booking-items.service';
import { BookingsService } from './bookings.service';
import { assertNoOverlap } from './bookings.validation';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';

const plannedStart = new Date('2026-10-06T15:00:00Z'); // 22:00 Vietnam
const plannedEnd = new Date('2026-10-06T15:30:00Z');
const lateNow = new Date('2026-10-06T15:52:00Z'); // 22:52 Vietnam
const minutes = (at: Date, amount: number) => new Date(at.getTime() + amount * 60_000);

type Predicate = Record<string, unknown>;
interface BookingState {
  id: string; branchId: string; status: string; deletedAt: null; bookingCode: string;
  appointmentDate: Date; appointmentStartTime: Date; appointmentEndTime: Date;
}
interface CapacityRow {
  id: string; bookingId: string; staffId: string; status: string;
  itemStartAt: Date | null; itemEndAt: Date | null; booking: BookingState;
}
interface ItemState extends Omit<CapacityRow, 'booking'> {
  serviceId: string; variantId: string | null; revision: number; priceAtBooking: number;
  durationMinutes: number; transitionMinutes: number | null;
}
interface AuditData {
  bookingServiceId: string; bookingId: string; actorId: string; action: string;
  reason: string; version: number; beforeSnapshot: unknown; afterSnapshot: unknown; amountDelta: number;
}
interface AuditState extends AuditData { id: string; createdAt: Date }
interface BookingResult {
  appointmentStartTime: Date; appointmentEndTime: Date;
  bookingServices: readonly { actualStartedAt: Date | null }[];
}
interface ReservationPredicate extends Predicate {
  staffId: string; OR: { OR: { itemStartAt: { lt: Date } }[] }[];
}
const isRecord = (value: unknown): value is Predicate => typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

// Evaluate the actual Prisma predicates against state, rather than returning a
// conflict unconditionally. Removing the IN_PROGRESS/date/status filters must
// change the result. Fail loudly for unsupported operators in this test double.
function matches(row: unknown, where: Predicate): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true;
    if (key === 'OR' || key === 'AND') {
      const parts: unknown[] = Array.isArray(condition) ? condition as unknown[] : [condition];
      const evaluate = (part: unknown) => {
        if (!isRecord(part)) throw new Error('Expected a logical predicate object');
        return matches(row, part);
      };
      return key === 'OR' ? parts.some(evaluate) : parts.every(evaluate);
    }
    const value = isRecord(row) ? row[key] : undefined;
    if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
    if (condition === null || typeof condition !== 'object') return value === condition;
    return Object.entries(condition).every(([operator, operand]: [string, unknown]) => {
      if (operator === 'in') {
        if (!Array.isArray(operand)) throw new Error('Expected an IN array');
        return (operand as unknown[]).includes(value);
      }
      if (operator === 'not') return value !== operand;
      if (operator === 'lt' || operator === 'gt') {
        if (value == null) return false;
        if (!(value instanceof Date) || !(operand instanceof Date)) throw new Error('Expected date comparison operands');
        return operator === 'lt' ? value.getTime() < operand.getTime() : value.getTime() > operand.getTime();
      }
      if (['lte', 'gte', 'notIn', 'equals', 'is', 'some'].includes(operator)) {
        throw new Error(`Unsupported test predicate: ${operator}`);
      }
      return matches(value, { [operator]: operand });
    });
  });
}

function otherItem(overrides: Partial<CapacityRow> = {}): CapacityRow {
  return {
    id: 'other-item', bookingId: 'other-booking', staffId: 'staff', status: 'SCHEDULED',
    itemStartAt: minutes(lateNow, 15), itemEndAt: minutes(lateNow, 45),
    booking: {
      id: 'other-booking', branchId: 'branch', deletedAt: null, status: 'CONFIRMED', bookingCode: 'BB-OTHER',
      ...normalizeAppointmentForStorage(minutes(lateNow, 15), minutes(lateNow, 45)),
    },
    ...overrides,
  };
}

function fixture(options: { item?: Partial<ItemState>; bookingStatus?: string; close?: string; others?: CapacityRow[] } = {}) {
  let booking: BookingState = {
    id: 'booking', branchId: 'branch', status: options.bookingStatus ?? 'CHECKED_IN', deletedAt: null,
    bookingCode: 'BB-2026-0100001', ...normalizeAppointmentForStorage(plannedStart, plannedEnd),
  };
  let item: ItemState = {
    id: 'item', bookingId: 'booking', serviceId: 'service', staffId: 'staff', variantId: 'variant',
    status: 'SCHEDULED', revision: 3, priceAtBooking: 100, durationMinutes: 30,
    transitionMinutes: 5, itemStartAt: plannedStart, itemEndAt: plannedEnd, ...options.item,
  };
  let audits: AuditState[] = [];
  const others = options.others ?? [];
  const staff = {
    id: 'staff', branchId: 'branch', userId: 'assigned-user', status: 'ACTIVE', deletedAt: null,
    isBookable: true, staffServices: [{ serviceId: 'service' }],
    user: { isActive: true, deletedAt: null, fullName: 'Provider' },
  };
  const rows = () => [{ ...item, booking: { ...booking } }, ...others];
  const snapshot = () => ({ ...booking, bookingServices: [{ ...item, refs_BookingServiceAdjustment_bookingServiceId: [...audits] }] });
  const tx = {
    $queryRaw: jest.fn<Promise<{ locked: boolean }[]>, unknown[]>().mockResolvedValue([]),
    bookingService: {
      findFirst: jest.fn(({ where }: { where: Predicate }) => Promise.resolve(rows().find(row => matches(row, where)) ?? null)),
      findMany: jest.fn(({ where }: { where: Predicate }) => Promise.resolve(rows().filter(row => matches(row, where)))),
      updateMany: jest.fn(({ where, data }: { where: Predicate; data: Partial<Omit<ItemState, 'revision'>> & { revision: { increment: number } } }) => {
        if (!matches(item, where)) return Promise.resolve({ count: 0 });
        item = { ...item, ...data, revision: item.revision + data.revision.increment };
        return Promise.resolve({ count: 1 });
      }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve({ ...item })),
    },
    booking: {
      create: jest.fn(),
      update: jest.fn(({ data }: { data: Partial<BookingState> }) => { booking = { ...booking, ...data }; return Promise.resolve(booking); }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(snapshot())),
    },
    bookingServiceAdjustment: {
      count: jest.fn(() => Promise.resolve(audits.length)),
      create: jest.fn(({ data }: { data: AuditData }) => {
        // Model the DB default separately from application time, ensuring the
        // projection uses the persisted timestamp and the write omits createdAt.
        const audit = { id: `audit-${audits.length}`, ...data, createdAt: new Date(Date.now() + 123) };
        audits.push(audit);
        return Promise.resolve(audit);
      }),
    },
    staffProfile: {
      findFirst: jest.fn(({ where }: { where: Predicate }) => Promise.resolve(matches(staff, where) ? staff : null)),
      findUnique: jest.fn().mockResolvedValue(staff),
      findMany: jest.fn().mockResolvedValue([staff]),
    },
    serviceVariant: { findUnique: jest.fn().mockResolvedValue({ bufferAfterMinutes: 10 }) },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch', businessId: 'business',
      bookingPolicy: { allowWalkIn: true, allowCounterBooking: true } }) },
    branchServiceOffering: { findMany: jest.fn().mockResolvedValue([{ id: 'service', durationMinutes: 30,
      price: 100, businessServiceId: 'business-service', businessService: { canonicalServiceId: 'canonical' },
      updatedAt: plannedStart }]) },
    serviceDependency: { findMany: jest.fn().mockResolvedValue([]) },
    servicePriceRule: { findMany: jest.fn().mockResolvedValue([]) },
    branchHoliday: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    specialWorkingDay: { findFirst: jest.fn().mockResolvedValue(null) },
    branchWorkingHour: { findUnique: jest.fn().mockResolvedValue({
      openTime: new Date('1970-01-01T09:00:00Z'),
      closeTime: new Date(`1970-01-01T${options.close ?? '23:59'}:00Z`), isClosed: false,
    }) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => {
      const previous = { booking: { ...booking }, item: { ...item }, audits: [...audits] };
      try { return await operation(tx); }
      catch (error) { booking = previous.booking; item = previous.item; audits = previous.audits; throw error; }
    }),
  };
  const items = new BookingItemsService(prisma as never);
  const bookings = new BookingsService(prisma as never, {} as never, {} as never,
    { getEffective: jest.fn().mockResolvedValue({ minBookingLeadTimeHours: 0, maxAdvanceBookingDays: 30 }),
      getConfigured: jest.fn().mockResolvedValue({}) } as never,
    { quote: jest.fn().mockResolvedValue({ finalAmount: 100 }) } as never);
  // Expiration has its own suites; do not execute a background mutation here.
  jest.spyOn(bookings, 'expirePendingHolds').mockResolvedValue(0);
  const start = (expectedRevision = 3, assignedStaffUserId = 'assigned-user') => items.update(
    'booking', 'item', assignedStaffUserId,
    { action: 'START', reason: ' Start after arrival ', expectedRevision }, { assignedStaffUserId },
  );
  const slots = (staffId: string | null = 'staff') => bookings.getAvailableSlots({
    branchId: 'branch', staffId, serviceIds: ['service'], date: '2026-10-06',
  }) as Promise<{ slots: { start: string; end: string }[] }>;
  return { tx, prisma, items, bookings, start, slots, snapshot };
}

function expectNoWrites(f: ReturnType<typeof fixture>) {
  expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
  expect(f.tx.booking.update).not.toHaveBeenCalled();
  expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
  expect(f.snapshot().bookingServices[0]).toMatchObject({ status: 'SCHEDULED', revision: 3 });
}

describe('Overdue service START keeps the planned schedule and validates actual remaining work', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(lateNow); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  test.each([plannedStart, lateNow])('START at %s persists audit facts without moving planned times', async now => {
    jest.setSystemTime(now);
    const f = fixture();
    const result = await f.start() as BookingResult;
    expect(result).toMatchObject({ status: 'IN_PROGRESS', readyToComplete: false, bookingServices: [{
      status: 'IN_PROGRESS', revision: 4, itemStartAt: plannedStart, itemEndAt: plannedEnd,
      actualStartedAt: new Date(now.getTime() + 123), actualCompletedAt: null,
      actualTimingSource: 'SERVICE_ADJUSTMENT',
    }] });
    expect(result.appointmentStartTime).toEqual(f.snapshot().appointmentStartTime);
    expect(result.appointmentEndTime).toEqual(new Date('1970-01-01T22:30:00Z'));
    expect(f.tx.booking.update).toHaveBeenCalledWith({ where: { id: 'booking' }, data: { status: 'IN_PROGRESS' } });
    expect(f.tx.bookingService.updateMany).toHaveBeenCalledWith({
      where: { id: 'item', bookingId: 'booking', revision: 3 }, data: { revision: { increment: 1 }, status: 'IN_PROGRESS' },
    });
    const audit = f.tx.bookingServiceAdjustment.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ actorId: 'assigned-user', action: 'START', reason: 'Start after arrival', version: 1,
      beforeSnapshot: { status: 'SCHEDULED', itemStartAt: plannedStart, itemEndAt: plannedEnd },
      afterSnapshot: { status: 'IN_PROGRESS', itemStartAt: plannedStart, itemEndAt: plannedEnd } });
    expect(audit).not.toHaveProperty('createdAt');
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(f.tx.staffProfile.findFirst.mock.invocationCallOrder[0]);
  });

  test.each([15, 32, 42])('late START conflicts with next booking at +%i minutes (duration/transition/buffer)', async offset => {
    const f = fixture({ others: [otherItem({ itemStartAt: minutes(lateNow, offset) })] });
    await expect(f.start()).rejects.toBeInstanceOf(ConflictException);
    expectNoWrites(f);
  });

  test('half-open boundary accepts the next booking exactly after duration + transition + buffer', async () => {
    const f = fixture({ others: [otherItem({ itemStartAt: minutes(lateNow, 45), itemEndAt: minutes(lateNow, 75) })] });
    await expect(f.start()).resolves.toMatchObject({ bookingServices: [{ status: 'IN_PROGRESS' }] });
  });

  test.each(['23:15', '23:30'])('late START cannot finish required work before closing at %s', async close => {
    const f = fixture({ close });
    await expect(f.start()).rejects.toBeInstanceOf(BadRequestException);
    expectNoWrites(f);
  });

  test('finishing exactly at closing is allowed', async () => {
    await expect(fixture({ close: '23:37' }).start()).resolves.toMatchObject({ status: 'IN_PROGRESS' });
  });

  test.each([
    ['2026-10-06T16:52:00Z', '23:59'],
    ['2026-10-06T16:07:30Z', '23:37'],
  ])('30-minute START at %s cannot cross closing at %s, including midnight and seconds', async (now, close) => {
    jest.setSystemTime(new Date(now));
    const f = fixture({ close, item: { variantId: null, transitionMinutes: 0 } });
    await expect(f.start()).rejects.toBeInstanceOf(BadRequestException);
    expectNoWrites(f);
    expect(f.snapshot().status).toBe('CHECKED_IN');
    expect(f.snapshot().bookingServices[0]).toMatchObject({ itemStartAt: plannedStart, itemEndAt: plannedEnd });
  });

  test('missing check-in rejects without inventing arrival or execution', async () => {
    const f = fixture({ bookingStatus: 'CONFIRMED' });
    await expect(f.start()).rejects.toThrow('check-in');
    expectNoWrites(f);
    expect(f.snapshot().status).toBe('CONFIRMED');
  });

  test.each([false, true])('one millisecond before planned START rejects (legacy dates=%s)', async legacy => {
    jest.setSystemTime(new Date(plannedStart.getTime() - 1));
    const f = fixture({ item: legacy ? { itemStartAt: null, itemEndAt: null } : {} });
    await expect(f.start()).rejects.toBeInstanceOf(ConflictException);
    expectNoWrites(f);
  });

  test('stale revision rejects before capacity checks or audit writes', async () => {
    const f = fixture();
    await expect(f.start(2)).rejects.toBeInstanceOf(ConflictException);
    expectNoWrites(f);
    expect(f.tx.staffProfile.findUnique).not.toHaveBeenCalled();
  });

  test('legacy planned dates and absent variant/transition still permit a valid late START', async () => {
    const f = fixture({ item: { itemStartAt: null, itemEndAt: null, variantId: null, transitionMinutes: null }, close: '23:22' });
    await expect(f.start()).resolves.toMatchObject({ bookingServices: [{ status: 'IN_PROGRESS', itemStartAt: null, itemEndAt: null }] });
    expect(f.tx.serviceVariant.findUnique).not.toHaveBeenCalled();
  });

  test('duplicate START cannot create a second audit or reset actual start', async () => {
    const f = fixture();
    const first = await f.start() as BookingResult;
    jest.setSystemTime(minutes(lateNow, 1));
    await expect(f.start(4)).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.bookingServiceAdjustment.create).toHaveBeenCalledTimes(1);
    expect(f.snapshot().bookingServices[0].refs_BookingServiceAdjustment_bookingServiceId[0].createdAt)
      .toEqual(first.bookingServices[0].actualStartedAt);
  });

  test('wrong assigned staff cannot START a locked item', async () => {
    const f = fixture();
    await expect(f.start(3, 'unassigned-user')).rejects.toBeInstanceOf(ForbiddenException);
    expectNoWrites(f);
    expect(f.tx.staffProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: 'staff', userId: 'unassigned-user',
    }) as unknown }));
  });

  test.each([-60, 60])('same-booking running sibling blocks START regardless of planned interval offset %i', async offset => {
    const sibling = otherItem({ bookingId: 'booking', status: 'IN_PROGRESS',
      itemStartAt: minutes(plannedStart, offset), itemEndAt: minutes(plannedStart, offset + 30) });
    const f = fixture({ others: [sibling] });
    await expect(f.start()).rejects.toThrow('cùng lịch hẹn');
    expectNoWrites(f);
  });

  test('START +1 second allows sequential SCHEDULED sibling without moving either planned interval', async () => {
    jest.setSystemTime(new Date(plannedStart.getTime() + 1000));
    const sibling = otherItem({ bookingId: 'booking', status: 'SCHEDULED',
      itemStartAt: plannedEnd, itemEndAt: minutes(plannedEnd, 30) });
    const siblingBefore = { ...sibling };
    const f = fixture({ others: [sibling] });
    const parentBefore = f.snapshot();
    await expect(f.start()).resolves.toMatchObject({ status: 'IN_PROGRESS', bookingServices: [{
      status: 'IN_PROGRESS', revision: 4, itemStartAt: plannedStart, itemEndAt: plannedEnd,
      actualStartedAt: new Date(plannedStart.getTime() + 1123),
    }] });
    expect(sibling).toEqual(siblingBefore);
    expect(f.snapshot().appointmentDate).toEqual(parentBefore.appointmentDate);
    expect(f.snapshot().appointmentStartTime).toEqual(parentBefore.appointmentStartTime);
    expect(f.snapshot().appointmentEndTime).toEqual(parentBefore.appointmentEndTime);
    expect(f.tx.bookingService.updateMany).toHaveBeenCalledTimes(1);
    expect(f.tx.bookingService.updateMany).toHaveBeenCalledWith({
      where: { id: 'item', bookingId: 'booking', revision: 3 }, data: { revision: { increment: 1 }, status: 'IN_PROGRESS' },
    });
    expect(f.tx.booking.update).toHaveBeenCalledWith({ where: { id: 'booking' }, data: { status: 'IN_PROGRESS' } });
    expect(f.tx.bookingServiceAdjustment.create).toHaveBeenCalledTimes(1);
  });

  test('failed revision claim rolls back the parent status and does not persist a START audit', async () => {
    const f = fixture();
    f.tx.bookingService.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(f.start()).rejects.toBeInstanceOf(ConflictException);
    expect(f.snapshot().status).toBe('CHECKED_IN');
    expect(f.snapshot().bookingServices[0]).toMatchObject({ status: 'SCHEDULED', revision: 3 });
    expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
  });

  test('audit failure rolls back both the parent status and item revision', async () => {
    const f = fixture();
    f.tx.bookingServiceAdjustment.create.mockRejectedValueOnce(new Error('audit write failed'));
    await expect(f.start()).rejects.toThrow('audit write failed');
    expect(f.snapshot()).toMatchObject({ status: 'CHECKED_IN', bookingServices: [{
      status: 'SCHEDULED', revision: 3, refs_BookingServiceAdjustment_bookingServiceId: [],
    }] });
  });

  test('COMPLETE audits the actual stop and releases the open-ended blocker while parent remains IN_PROGRESS', async () => {
    const f = fixture();
    await f.start();
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'new-booking', minutes(lateNow, 60), minutes(lateNow, 90)))
      .rejects.toBeInstanceOf(ConflictException);
    jest.setSystemTime(minutes(lateNow, 60));
    const result = await f.items.update('booking', 'item', 'assigned-user', {
      action: 'COMPLETE', expectedRevision: 4, reason: 'Completed service',
    }, { assignedStaffUserId: 'assigned-user' }) as BookingResult;
    expect(result).toMatchObject({ status: 'IN_PROGRESS', readyToComplete: true, bookingServices: [{
      status: 'COMPLETED', revision: 5, itemStartAt: plannedStart, itemEndAt: plannedEnd,
      actualStartedAt: new Date(lateNow.getTime() + 123), actualCompletedAt: new Date(minutes(lateNow, 60).getTime() + 123),
    }] });
    expect(f.tx.bookingServiceAdjustment.create.mock.calls[1][0].data).toMatchObject({
      action: 'COMPLETE', version: 2, actorId: 'assigned-user',
      beforeSnapshot: { status: 'IN_PROGRESS' }, afterSnapshot: { status: 'COMPLETED' },
    });
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'new-booking', minutes(lateNow, 60), minutes(lateNow, 90)))
      .resolves.toBeUndefined();
  });
});

describe('Open-ended running capacity across dates and available slots', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(lateNow); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  const priorStart = new Date('2026-10-05T15:00:00Z');
  const priorEnd = new Date('2026-10-05T15:30:00Z');
  function running(priorDay: boolean, legacy = false) {
    const start = priorDay ? priorStart : plannedStart;
    const end = priorDay ? priorEnd : plannedEnd;
    return otherItem({ status: 'IN_PROGRESS', itemStartAt: legacy ? null : start, itemEndAt: legacy ? null : end,
      booking: { ...otherItem().booking, status: 'IN_PROGRESS', ...normalizeAppointmentForStorage(start, end) } });
  }

  test.each([
    [-30, 0, false], [5, 15, true], [30, 60, false],
  ])('normal running work blocks only its planned interval (request offsets %i to %i, conflict=%s)', async (startOffset, endOffset, conflict) => {
    jest.setSystemTime(new Date(plannedStart.getTime() + 1000));
    const f = fixture({ others: [running(false)] });
    const check = assertNoOverlap(f.prisma as never, 'staff', 'booking', minutes(plannedStart, startOffset), minutes(plannedStart, endOffset));
    if (conflict) await expect(check).rejects.toBeInstanceOf(ConflictException);
    else await expect(check).resolves.toBeUndefined();
  });

  test('normal running service keeps slots after its future planned end available', async () => {
    jest.setSystemTime(minutes(plannedStart, 5));
    const f = fixture({ others: [running(false)] });
    expect((await f.slots()).slots).toEqual([
      { start: '2026-10-06T15:30:00.000Z', end: '2026-10-06T16:00:00.000Z' },
      { start: '2026-10-06T16:00:00.000Z', end: '2026-10-06T16:30:00.000Z' },
    ]);
  });

  test('one millisecond past planned end turns a running service into an open-ended blocker', async () => {
    const f = fixture({ others: [running(false)] });
    jest.setSystemTime(plannedEnd);
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', plannedEnd, minutes(plannedEnd, 30))).resolves.toBeUndefined();
    jest.setSystemTime(new Date(plannedEnd.getTime() + 1));
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', minutes(plannedEnd, 60), minutes(plannedEnd, 90)))
      .rejects.toBeInstanceOf(ConflictException);
  });

  test.each([[false, false], [true, false], [true, true]])(
    'assertNoOverlap rejects an expired running interval (prior day=%s, legacy=%s)', async (priorDay, legacy) => {
      const f = fixture({ others: [running(priorDay, legacy)] });
      await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', lateNow, minutes(lateNow, 30)))
        .rejects.toThrow('BB-OTHER');
    },
  );

  test.each([false, true])('availability excludes all future slots for an overdue runner (prior day=%s)', async priorDay => {
    const f = fixture({ others: [running(priorDay)] });
    expect((await f.slots()).slots).toEqual([]);
    expect((await f.slots(null)).slots).toEqual([]);
  });

  test('prior-day running item without item dates conservatively blocks future slots', async () => {
    expect((await fixture({ others: [running(true, true)] }).slots()).slots).toEqual([]);
  });

  test.each(['COMPLETED', 'SKIPPED', 'CANCELLED'])('terminal item %s releases slots even with active parent', async status => {
    const row = running(true);
    row.status = status;
    const f = fixture({ others: [row] });
    expect((await f.slots()).slots.map(slot => slot.start)).toEqual([
      '2026-10-06T16:00:00.000Z',
    ]);
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', lateNow, minutes(lateNow, 30))).resolves.toBeUndefined();
  });

  test('expired SCHEDULED booking does not become an open-ended execution blocker', async () => {
    const row = running(true);
    row.status = 'SCHEDULED';
    const f = fixture({ others: [row] });
    expect((await f.slots()).slots).toEqual([{ start: '2026-10-06T16:00:00.000Z', end: '2026-10-06T16:30:00.000Z' }]);
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', lateNow, minutes(lateNow, 30))).resolves.toBeUndefined();
  });

  test.each(['COMPLETED', 'CANCELLED', 'NO_SHOW'])('terminal parent %s does not block with a stale running child', async status => {
    const row = running(true);
    row.booking.status = status;
    const f = fixture({ others: [row] });
    expect((await f.slots()).slots).toEqual([{ start: '2026-10-06T16:00:00.000Z', end: '2026-10-06T16:30:00.000Z' }]);
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', lateNow, minutes(lateNow, 30))).resolves.toBeUndefined();
  });

  test('running work for a different provider cannot block this provider', async () => {
    const row = running(true);
    row.staffId = 'different-staff';
    const f = fixture({ others: [row] });
    expect((await f.slots()).slots).toEqual([{ start: '2026-10-06T16:00:00.000Z', end: '2026-10-06T16:30:00.000Z' }]);
    await expect(assertNoOverlap(f.prisma as never, 'staff', 'booking', lateNow, minutes(lateNow, 30))).resolves.toBeUndefined();
  });

  test.each([false, true])('creation rechecks running capacity inside reservation (prior day=%s)', async priorDay => {
    const others: CapacityRow[] = [];
    const f = fixture({ others });
    // Advisory locks succeed. A missing lock row must not mask whether the
    // reservation predicate or the later domain validation caught the runner.
    f.tx.$queryRaw.mockResolvedValue([{ locked: true }]);
    // Availability was free, but another request committed a START before this
    // request entered its serializable reservation. Keep that external commit.
    const transaction = f.prisma.$transaction.getMockImplementation()!;
    f.prisma.$transaction.mockImplementationOnce(operation => {
      others.push(running(priorDay));
      return transaction(operation);
    });
    await expect(f.bookings.create({
      customerId: 'customer', createdBy: 'receptionist', branchId: 'branch', serviceIds: ['service'],
      appointmentDate: '2026-10-06T16:00:00Z', source: 'WALK_IN',
    }, { authorizedCounter: true })).rejects.toBeInstanceOf(ConflictException);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    const where = f.tx.bookingService.findFirst.mock.calls[0][0].where as ReservationPredicate;
    expect(where.staffId).toBe('staff');
    expect(f.tx.booking.create).not.toHaveBeenCalled();
    expect(f.tx.bookingService.updateMany).not.toHaveBeenCalled();
    expect(f.tx.bookingServiceAdjustment.create).not.toHaveBeenCalled();
    // Reservation must compare absolute item instants, not SQL TIME values
    // normalized onto 1970. The later assertNoOverlap is a separate safety net.
    expect(where.OR[0].OR[0].itemStartAt.lt).toEqual(new Date('2026-10-06T16:30:00Z'));
    expect(matches(others[0], where)).toBe(true);
  });
});
