import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingHoldExpired, pendingHoldItemActions } from './pendingHold.js';

const deadline = Date.parse('2026-10-13T06:00:00Z');
const booking = () => ({ status: 'PENDING', pendingExpiresAt: new Date(deadline).toISOString(), bookingServices: [{ status: 'SCHEDULED' }] });
for (const offset of [-1, 0, 1]) test(`server deadline offset ${offset}`, () => {
  assert.equal(pendingHoldExpired(booking(), deadline + offset), offset >= 0);
});
for (const status of ['IN_PROGRESS', 'COMPLETED']) test(`a sibling ${status} is execution evidence even with UNKNOWN timing`, () => {
  const value = booking(); value.bookingServices.push({ status, actualStartedAt: null, actualTimingStatus: 'UNKNOWN' });
  assert.equal(pendingHoldExpired(value, deadline + 1), false);
});
for (const value of [null, undefined, 'invalid']) test(`legacy or invalid deadline ${value} is not invented`, () => {
  assert.equal(pendingHoldExpired({ ...booking(), pendingExpiresAt: value }, deadline + 1), false);
});
for (const now of [undefined, NaN]) test(`unknown server clock ${now} does not use device time`, () => {
  assert.equal(pendingHoldExpired(booking(), now), false);
});
test('unknown service projection cannot be mistaken for unserved', () => {
  assert.equal(pendingHoldExpired({ ...booking(), bookingServices: undefined }, deadline + 1), false);
});
test('a confirmed parent with an old deadline keeps normal actions', () => {
  assert.equal(pendingHoldExpired({ ...booking(), status: 'CONFIRMED' }, deadline + 1), false);
});
test('expired unserved choices keep cancel/reprice but cannot start without check-in', () => {
  const actions = ['REMOVE', 'SKIP', 'REPRICE', 'START', 'COMPLETE', 'REASSIGN', 'RESIZE'];
  assert.deepEqual(pendingHoldItemActions(actions, true), ['REMOVE', 'SKIP', 'REPRICE', 'COMPLETE']);
  assert.equal(actions.length, 7);
  assert.equal(pendingHoldItemActions(actions, false), actions);
});
