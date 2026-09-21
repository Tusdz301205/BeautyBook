import { randomUUID } from 'node:crypto';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withSerializableTransaction } from '../common/utils/serializable-transaction';
import { normalizeAppointmentForStorage } from '../common/utils/booking-datetime';
import { recordBookingViolation, voidInvalidBookingViolation } from './booking-violation-policy';
import { assertCustomerSelfBookingAllowed, readCustomerBookingPolicy, RESTRICTION_MS } from './customer-booking-policy';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
if (enabled && (!/^\/beautybook_test_restriction_\d+$/.test(new URL(process.env.DATABASE_URL ?? '').pathname) || process.env.NODE_ENV === 'production')) {
  throw new Error('Restriction integration requires its dedicated fresh test copy');
}
(enabled ? describe : describe.skip)('Customer/business policy on PostgreSQL', () => {
  const db = new PrismaService();
  const day = 86_400_000;
  let branches: Array<{ id: string; businessId: string }>;
  let other: { id: string; businessId: string };
  let customerRole: string;
  beforeAll(async () => {
    await db.onModuleInit();
    const first = await db.branch.findFirstOrThrow({ where: { deletedAt: null }, select: { businessId: true } });
    branches = await db.branch.findMany({ where: { businessId: first.businessId, deletedAt: null }, select: { id: true, businessId: true } });
    expect(branches.length).toBeGreaterThan(1);
    other = await db.branch.findFirstOrThrow({ where: { businessId: { not: first.businessId }, deletedAt: null }, select: { id: true, businessId: true } });
    customerRole = (await db.role.findUniqueOrThrow({ where: { code: 'CUSTOMER' } })).id;
  });
  afterAll(async () => { await db.onModuleDestroy(); });
  async function customer() {
    const user = await db.user.create({ data: { email: `restriction-${randomUUID()}@example.test`, fullName: 'Isolated restriction fixture', passwordHash: 'TEST_DISABLED',
      customerProfile: { create: {} }, userRoles: { create: { roleId: customerRole } } }, include: { customerProfile: true } });
    return { id: user.customerProfile!.id, userId: user.id };
  }
  async function source(c: { id: string; userId: string }, kind: 'LATE_CANCELLATION' | 'NO_SHOW', at = new Date(), branch = branches[0]) {
    let start = new Date(at.getTime() + (kind === 'NO_SHOW' ? -3_600_000 : 3_600_000));
    let interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    if (interval.appointmentEndTime <= interval.appointmentStartTime) {
      start = new Date(start.getTime() + (kind === 'NO_SHOW' ? -1_800_000 : 1_800_000));
      interval = normalizeAppointmentForStorage(start, new Date(start.getTime() + 1_800_000));
    }
    // Terminal fixture avoids reserving seed slots. Lifecycle authorization is
    // separately covered by API tests; this suite exercises real policy writes.
    const booking = await db.booking.create({ data: { bookingCode: `TEST-RESTRICTION-${randomUUID()}`, customerId: c.id, branchId: branch.id,
      status: kind === 'NO_SHOW' ? 'NO_SHOW' : 'CANCELLED', totalAmount: 0, finalAmount: 0, ...interval } });
    const request = kind === 'LATE_CANCELLATION' ? await db.appointmentChangeRequest.create({ data: { bookingId: booking.id,
      requestedBy: c.userId, requestedByType: 'CUSTOMER', requestType: 'CANCEL', createdAt: at, expiresAt: new Date(at.getTime() + day) } }) : null;
    return { bookingId: booking.id, customerId: c.id, businessId: branch.businessId, recordedById: c.userId,
      kind, occurredAt: at, appointmentStartAt: start, ...(request ? { sourceRequestId: request.id } : {}) };
  }
  const record = (data: Awaited<ReturnType<typeof source>>) => withSerializableTransaction(db, tx => recordBookingViolation(tx, data));
  const policy = (c: { id: string }, branch = branches[0], now = new Date()) => readCustomerBookingPolicy(db, c.id, branch.businessId, now);
  const guard = (c: { id: string; userId: string }, ack: unknown, branch = branches[0]) =>
    withSerializableTransaction(db, tx => assertCustomerSelfBookingAllowed(tx, c.id, branch.businessId, ack, c.userId));

  test('2 warns; 3 requires true; 4 restricts across branches, not other business/customer', async () => {
    const c = await customer();
    await record(await source(c, 'NO_SHOW'));
    expect(await guard(c, false)).toMatchObject({ score: 2, warningLevel: 'WARNING_LEVEL_1' });
    await record(await source(c, 'LATE_CANCELLATION', new Date(), branches[1]));
    await expect(guard(c, false)).rejects.toBeInstanceOf(ConflictException);
    expect(await guard(c, true)).toMatchObject({ score: 3, acknowledgmentRequired: true });
    const trigger = await record(await source(c, 'LATE_CANCELLATION'));
    await expect(guard(c, true, branches[1])).rejects.toBeInstanceOf(ForbiddenException);
    expect(await guard(c, false, other)).toMatchObject({ score: 0, selfBookingAllowed: true });
    expect(await guard(await customer(), false)).toMatchObject({ score: 0 });
    const p = await policy(c);
    expect(p.restriction?.endsAt?.getTime()).toBe(trigger!.occurredAt.getTime() + RESTRICTION_MS);
    expect(await db.customerBookingPolicy.count({ where: { customerId: c.id, businessId: branches[0].businessId } })).toBe(1);
  });
  test('duplicate concurrent events are idempotent, unique policy row and notification', async () => {
    const c = await customer();
    const data = await source(c, 'NO_SHOW');
    await Promise.all([record(data), record(data)]);
    expect(await policy(c)).toMatchObject({ score: 2 });
    expect(await db.bookingViolationEvent.count({ where: { bookingId: data.bookingId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: c.userId, type: 'SYSTEM' } })).toBe(1);
  });
  test('parallel distinct violations extend once per event, never shorten, and VOID recalculates', async () => {
    const c = await customer();
    const base = new Date(Date.now() - 20 * day);
    await record(await source(c, 'NO_SHOW', base));
    const second = await record(await source(c, 'NO_SHOW', new Date(base.getTime() + day)));
    const a = await source(c, 'LATE_CANCELLATION', new Date(base.getTime() + 10 * day));
    const b = await source(c, 'LATE_CANCELLATION', new Date(base.getTime() + 15 * day));
    const [ea, eb] = await Promise.all([record(a), record(b)]);
    expect((await policy(c)).restriction?.endsAt).toEqual(new Date(b.occurredAt.getTime() + RESTRICTION_MS));
    await withSerializableTransaction(db, tx => voidInvalidBookingViolation(tx, eb!.id, c.userId, 'BUSINESS_RULE_ERROR', 'Isolated invalid event evidence'));
    expect((await policy(c)).restriction?.endsAt).toEqual(new Date(a.occurredAt.getTime() + RESTRICTION_MS));
    await withSerializableTransaction(db, tx => voidInvalidBookingViolation(tx, ea!.id, c.userId, 'BUSINESS_RULE_ERROR', 'Isolated invalid event evidence'));
    await withSerializableTransaction(db, tx => voidInvalidBookingViolation(tx, second!.id, c.userId, 'BUSINESS_RULE_ERROR', 'Isolated invalid event evidence'));
    expect(await policy(c)).toMatchObject({ score: 2, selfBookingAllowed: true, restriction: null });
  });
  test('expired restriction with score >=4 remains expired across GET and self-book; a new event activates', async () => {
    const c = await customer();
    await record(await source(c, 'NO_SHOW', new Date(Date.now() - 40 * day)));
    await record(await source(c, 'NO_SHOW', new Date(Date.now() - 39 * day)));
    const before = await db.customerBookingPolicy.findUniqueOrThrow({ where: { customerId_businessId: { customerId: c.id, businessId: branches[0].businessId } } });
    expect(await policy(c)).toMatchObject({ score: 4, selfBookingAllowed: true });
    expect(await policy(c)).toMatchObject({ restriction: { active: false } });
    expect(await guard(c, false)).toMatchObject({ selfBookingAllowed: true });
    expect((await policy(c)).restriction?.endsAt).toEqual(before.endsAt);
    await record(await source(c, 'LATE_CANCELLATION'));
    await expect(guard(c, true)).rejects.toBeInstanceOf(ForbiddenException);
  });
  test('committed violation 3->4 fences two concurrent self-book attempts', async () => {
    const c = await customer();
    await record(await source(c, 'NO_SHOW'));
    await record(await source(c, 'LATE_CANCELLATION'));
    const data = await source(c, 'LATE_CANCELLATION');
    let entered!: () => void, release!: () => void;
    const acquired = new Promise<void>(r => { entered = r; });
    const gate = new Promise<void>(r => { release = r; });
    const writer = withSerializableTransaction(db, async tx => { await recordBookingViolation(tx, data); entered(); await gate; });
    await acquired;
    const attempts = [guard(c, true), guard(c, true)];
    release(); await writer;
    const results = await Promise.allSettled(attempts);
    for (const result of results) { expect(result.status).toBe('rejected'); if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(ForbiddenException); }
  });
  test('self-book fence committed first wins; later violation blocks only subsequent self-book', async () => {
    const c = await customer();
    await record(await source(c, 'NO_SHOW'));
    await record(await source(c, 'LATE_CANCELLATION'));
    const data = await source(c, 'LATE_CANCELLATION');
    let entered!: () => void, release!: () => void;
    const acquired = new Promise<void>(r => { entered = r; });
    const gate = new Promise<void>(r => { release = r; });
    const bookingDecision = withSerializableTransaction(db, async tx => {
      const result = await assertCustomerSelfBookingAllowed(tx, c.id, branches[0].businessId, true, c.userId);
      entered(); await gate; return result;
    });
    await acquired;
    const violation = record(data);
    release();
    expect(await bookingDecision).toMatchObject({ selfBookingAllowed: true, score: 3 });
    await violation;
    await expect(guard(c, true)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
