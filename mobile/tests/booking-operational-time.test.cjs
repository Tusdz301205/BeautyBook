const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/bookingOperationalTime.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: moduleValue, exports: moduleValue.exports, Date, Number, Math });
const { operationalTimeLabel: label, advanceServerClock } = moduleValue.exports;
const start = Date.parse('2026-10-06T15:00:00Z'), end = start + 30 * 60000;
const pending = { status: 'SCHEDULED', itemStartAt: new Date(start).toISOString(), itemEndAt: new Date(end).toISOString(), actualStartedAt: null };
test('22:00–22:30 boundaries and 22:52 distinguish due and overdue without execution', () => {
  assert.equal(label(pending, 'CONFIRMED', start - 1), null);
  assert.equal(label(pending, 'CONFIRMED', start), 'Đã đến giờ — chưa bắt đầu');
  assert.equal(label(pending, 'CONFIRMED', end), 'Đã đến giờ — chưa bắt đầu');
  assert.equal(label(pending, 'CONFIRMED', start + 52 * 60000), 'Quá giờ dự kiến — cần kiểm tra');
  assert.equal(pending.actualStartedAt, null); assert.equal(pending.status, 'SCHEDULED');
});
test('check-in does not pretend service started; running overrun is distinct', () => {
  assert.equal(label(pending, 'CHECKED_IN', end + 1), 'Quá giờ dự kiến — cần kiểm tra');
  assert.equal(label({ ...pending, status: 'IN_PROGRESS', actualStartedAt: new Date(start).toISOString() }, 'IN_PROGRESS', end + 1), 'Đang phục vụ quá giờ dự kiến');
});
test('terminal bookings/items, missing facts and contradictory recorded start suppress waiting alerts', () => {
  for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED']) assert.equal(label(pending, status, end + 1), null);
  for (const status of ['COMPLETED', 'CANCELLED', 'SKIPPED']) assert.equal(label({ ...pending, status }, 'IN_PROGRESS', end + 1), null);
  assert.equal(label({ ...pending, actualStartedAt: new Date(start).toISOString() }, 'CHECKED_IN', end + 1), null);
  assert.equal(label({ status: 'SCHEDULED' }, 'CONFIRMED', end + 1), null);
  assert.equal(label(pending, 'CONFIRMED', NaN), null);
});
test('monotonic server clock remains correct across midnight/device clock changes', () => {
  const server = Date.parse('2026-10-06T16:59:59Z');
  assert.equal(advanceServerClock(server, 1000, 3000), server + 2000);
  assert.equal(advanceServerClock(server, 3000, 1000), server);
  assert.ok(Number.isNaN(advanceServerClock(NaN, 1000, 3000)));
  assert.equal(label(pending, 'CONFIRMED', advanceServerClock(server, 1000, 3000)), 'Quá giờ dự kiến — cần kiểm tra');
});
test('partial multi-service booking evaluates each item without changing siblings', () => {
  const items = [{ ...pending, status: 'COMPLETED' }, pending, { ...pending, status: 'IN_PROGRESS' }];
  assert.deepEqual(items.map(item => label(item, 'IN_PROGRESS', end + 1)), [null, 'Quá giờ dự kiến — cần kiểm tra', 'Đang phục vụ quá giờ dự kiến']);
});
