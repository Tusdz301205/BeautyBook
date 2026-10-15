import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const row = { status: 'CHECKED_IN', serverNow: '2026-10-13T03:00:00Z', scheduledEndAt: '2026-10-13T03:00:01Z', scheduleElapsed: false };
function harness() {
  let state = { accessToken: 'A', user: { id: 'A' } }, generation = 1, cleanup;
  const timers = new Map(), reads = [];
  const store = fn => fn(state); store.getState = () => state;
  const context = { useAuthStore: store, captureSessionGeneration: () => generation, isSessionGenerationCurrent: n => n === generation,
    useEffect: fn => { cleanup?.(); cleanup = fn(); },
    setTimeout: (fn, delay) => { timers.set(fn, delay); return fn; }, clearTimeout: fn => timers.delete(fn) };
  const source = readFileSync(new URL('./useScheduleHistoryRefresh.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
  vm.runInNewContext(source + ';this.hook=useScheduleHistoryRefresh;this.delay=scheduleHistoryRefreshDelay;', context);
  return { context, timers, reads, render: rows => context.hook(rows, () => reads.push('GET')),
    change: () => { generation++; state = { accessToken: 'B', user: { id: 'B' } }; }, dispose: () => cleanup?.() };
}
test('schedule boundary refresh is based on server time and is read-only', () => {
  const h = harness(); h.render([row]);
  assert.equal([...h.timers.values()][0], 1001); [...h.timers.keys()][0]();
  assert.deepEqual(h.reads, ['GET']); assert.equal(row.status, 'CHECKED_IN'); h.dispose();
});
test('no timers for historical, unarrived, cancelled, or unproven schedule rows', () => {
  const h = harness();
  for (const data of [{ ...row, scheduleElapsed: true }, { ...row, scheduleBucket: 'HISTORY' },
    { ...row, status: 'CONFIRMED' }, { ...row, status: 'CANCELLED' }, { ...row, serverNow: undefined },
    { ...row, scheduledEndAt: '2026-10-13T03:00:01' }]) {
    h.render(data); assert.equal(h.timers.size, 0);
  }
});
test('account switch and unmount fence old timers; earliest booking refreshes only once', () => {
  const h = harness(); h.render([{ ...row, scheduledEndAt: '2026-10-13T03:00:02Z' }, row]);
  const fn = [...h.timers.keys()][0]; assert.equal(h.timers.size, 1);
  h.change(); fn(); assert.deepEqual(h.reads, []);
  h.render([row]); assert.equal(h.timers.size, 1); h.dispose(); assert.equal(h.timers.size, 0);
});
