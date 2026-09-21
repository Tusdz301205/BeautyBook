import { ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto } from './dto/bookings.dto';
import { assertCustomerSelfBookingAllowed, readCustomerBookingPolicy, replayBookingRestriction,
  RESTRICTION_POLICY_VERSION, RESTRICTION_MS, WINDOW_MS } from './customer-booking-policy';

const now = new Date('2026-09-18T03:00:00Z');
const day = 86_400_000;
const event = (id: string, days = 0, kind = 'LATE_CANCELLATION') => ({ id, kind,
  occurredAt: new Date(now.getTime() + days * day), policyVersion: RESTRICTION_POLICY_VERSION });
function dbFixture(score: number, endsAt: Date | null = null) {
  const row = { id: 'policy', startsAt: endsAt ? new Date(now.getTime() - day) : null, endsAt };
  const tx: any = { bookingViolationEvent: { findMany: jest.fn().mockResolvedValue(Array.from({ length: score }, () => ({ kind: 'LATE_CANCELLATION' }))) },
    customerBookingPolicy: { findUnique: jest.fn().mockResolvedValue(row), upsert: jest.fn().mockResolvedValue(row) },
    auditLog: { create: jest.fn() } };
  return tx;
}
describe('Customer booking warning/restriction', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => jest.useRealTimers());
  test.each([0, 1, 2])('score %s never blocks or requires acknowledgment', async score => {
    const tx = dbFixture(score);
    const result = await assertCustomerSelfBookingAllowed(tx, 'customer', 'business', false, 'actor');
    expect(result).toMatchObject({ selfBookingAllowed: true, acknowledgmentRequired: false,
      warningLevel: score === 2 ? 'WARNING_LEVEL_1' : 'NORMAL' });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
  test.each([false, undefined, null, 'true', 1])('score 3 rejects non-explicit ack %s', async ack => {
    await expect(assertCustomerSelfBookingAllowed(dbFixture(3), 'c', 'b', ack)).rejects.toBeInstanceOf(ConflictException);
  });
  test('score 3 accepts true and records business-bound evidence', async () => {
    const tx = dbFixture(3);
    await expect(assertCustomerSelfBookingAllowed(tx, 'c', 'b', true, 'actor')).resolves.toMatchObject({ score: 3 });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'actor',
      newData: expect.objectContaining({ businessId: 'b', score: 3, acknowledged: true }) }) });
    expect(tx.customerBookingPolicy.upsert.mock.invocationCallOrder[0]).toBeLessThan(tx.bookingViolationEvent.findMany.mock.invocationCallOrder[0]);
  });
  test('active restriction denies even true acknowledgment', async () => {
    await expect(assertCustomerSelfBookingAllowed(dbFixture(4, new Date(now.getTime() + day)), 'c', 'b', true)).rejects.toBeInstanceOf(ForbiddenException);
  });
  test('exact expiry with score >=4 allows booking and GET never writes a restriction', async () => {
    const tx = dbFixture(5, now);
    expect(await readCustomerBookingPolicy(tx, 'c', 'b')).toMatchObject({ selfBookingAllowed: true, acknowledgmentRequired: false });
    expect(tx.customerBookingPolicy.upsert).not.toHaveBeenCalled();
    await expect(assertCustomerSelfBookingAllowed(tx, 'c', 'b', false)).resolves.toMatchObject({ selfBookingAllowed: true });
  });
  test('restriction expiring while waiting on the fence uses time after the wait', async () => {
    const expiry = new Date(now.getTime() + 1000);
    const tx = dbFixture(4, expiry);
    tx.customerBookingPolicy.upsert.mockImplementation(async () => { jest.setSystemTime(expiry); return {}; });
    await expect(assertCustomerSelfBookingAllowed(tx, 'c', 'b', false)).resolves.toMatchObject({ selfBookingAllowed: true });
  });
  test('score query is exact business/customer, inclusive 90-day window, excludes VOID/future', async () => {
    const tx = dbFixture(2);
    await readCustomerBookingPolicy(tx, 'c', 'b');
    expect(tx.bookingViolationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      customerId: 'c', businessId: 'b', voidedAt: null, occurredAt: { gte: new Date(now.getTime() - WINDOW_MS), lte: now },
    } }));
  });
  test('new event 3 -> 4 activates exactly 30 days', () => {
    const result = replayBookingRestriction([event('1', -3), event('2', -2), event('3', -1), event('4')]);
    expect(result).toEqual({ startsAt: now, endsAt: new Date(now.getTime() + RESTRICTION_MS), triggeredByViolationEventId: '4' });
  });
  test('no-show has weight 2 and two events reach 4', () => {
    expect(replayBookingRestriction([event('a', -1, 'NO_SHOW'), event('b', 0, 'NO_SHOW')]).triggeredByViolationEventId).toBe('b');
  });
  test('exact 90-day boundary counts but older event does not', () => {
    expect(replayBookingRestriction([event('a', -90, 'NO_SHOW'), event('b', 0, 'NO_SHOW')]).endsAt).not.toBeNull();
    expect(replayBookingRestriction([event('a', -90.001, 'NO_SHOW'), event('b', 0, 'NO_SHOW')]).endsAt).toBeNull();
  });
  test('new event extends active restriction even if old score aged out', () => {
    const history = [event('a', -89, 'NO_SHOW'), event('b', 0, 'NO_SHOW'), event('c', 20)];
    expect(replayBookingRestriction(history)).toMatchObject({ startsAt: now, endsAt: new Date(now.getTime() + 50 * day), triggeredByViolationEventId: 'c' });
  });
  test('no event after expiry does not restart; next qualifying event does', () => {
    const history = [event('a', -1, 'NO_SHOW'), event('b', 0, 'NO_SHOW')];
    expect(replayBookingRestriction(history).endsAt).toEqual(new Date(now.getTime() + 30 * day));
    expect(replayBookingRestriction([...history, event('c', 31)])).toMatchObject({ startsAt: new Date(now.getTime() + 31 * day), endsAt: new Date(now.getTime() + 61 * day) });
  });
  test('VOID recomputes dependent restriction, not just current score', () => {
    const history = [event('a', -1, 'NO_SHOW'), { ...event('b', 0, 'NO_SHOW'), voidedAt: now }, event('c', 1)];
    expect(replayBookingRestriction(history).endsAt).toBeNull();
  });
  test('out of order processing cannot shorten an extension', () => {
    const history = [event('a', -1, 'NO_SHOW'), event('b', 0, 'NO_SHOW'), event('c', 20), event('d', 10)];
    expect(replayBookingRestriction(history).endsAt).toEqual(new Date(now.getTime() + 50 * day));
  });
  test('legacy events count towards a new violation but never backfill a restriction', () => {
    const legacy = [event('a', -1, 'NO_SHOW'), event('b', 0, 'NO_SHOW')].map(e => ({ ...e, policyVersion: '2026-09-17-request-time' }));
    expect(replayBookingRestriction(legacy).endsAt).toBeNull();
    expect(replayBookingRestriction([...legacy, event('c', 1)]).triggeredByViolationEventId).toBe('c');
  });
  test.each(['true', 'false', 1])('DTO cannot coerce acknowledgment %s into acceptance', async value => {
    const dto = plainToInstance(CreateBookingDto, { violationAcknowledged: value }, { enableImplicitConversion: true });
    expect((await validate(dto)).some(error => error.property === 'violationAcknowledged')).toBe(true);
  });
});
