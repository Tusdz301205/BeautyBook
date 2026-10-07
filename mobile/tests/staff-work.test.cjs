const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name, modules = {}) {
  const module = { exports: {} };
  const file = path.join(__dirname, '../src/operations/staff', name);
  const source = fs.readFileSync(fs.existsSync(file + '.tsx') ? file + '.tsx' : file + '.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; },
    Date, Intl, Map, Error, Number, performance, setTimeout, clearTimeout, setInterval, clearInterval, AbortController });
  return module.exports;
}
const model = load('workModel');
const item = (extra = {}) => ({ id: 'item-a', bookingId: 'booking-uuid', bookingCode: 'BB123', staffId: 'staff-a', branchId: 'branch', businessId: 'business',
  status: 'SCHEDULED', bookingStatus: 'CHECKED_IN', revision: 3, canStart: true, canComplete: false, itemStartAt: '2026-10-05T03:00:00Z', ...extra });
const api = () => {
  const calls = [];
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const mod = load('staffApi', { '../../api/client': { ApiError, withQuery: (url, q) => url + '?' + new URLSearchParams(q), apiRequest: async (url, init) => { calls.push({ url, init }); return {}; } } });
  return { ...mod, calls };
};

test('actions require own assignment, check-in, lifecycle, server eligibility and revision', () => {
  assert.equal(model.actionFor(item(), 'staff-a'), 'START');
  for (const extra of [{ staffId: 'staff-b' }, { bookingStatus: 'CONFIRMED' }, { bookingStatus: 'CANCELLED' }, { revision: 0 }, { revision: 1.2 }, { canStart: false }, { status: 'COMPLETED' }]) {
    assert.equal(model.actionFor(item(extra), 'staff-a'), null);
  }
  assert.equal(model.actionFor(item({ status: 'IN_PROGRESS', canComplete: true }), 'staff-a'), 'COMPLETE');
  assert.equal(model.actionFor(item({ status: 'SCHEDULED', canComplete: true, canStart: false }), 'staff-a'), null);
});
test('all parallel in-progress items remain visible and completed siblings do not remove tasks', () => {
  const data = [item({ id: 'finished', status: 'COMPLETED', canStart: false }), item({ id: 'next' }),
    item({ id: 'active-2', status: 'IN_PROGRESS' }), item({ id: 'active-1', status: 'IN_PROGRESS' })];
  assert.deepEqual(Array.from(model.orderWork(data), row => row.id), ['active-1', 'active-2', 'next', 'finished']);
  assert.equal(data[0].id, 'finished');
});
test('Today hierarchy preserves every item and deterministically chooses an eligible next service', () => {
  const data = [item({ id: 'done', status: 'COMPLETED', canStart: false }),
    item({ id: 'waiting', bookingStatus: 'CONFIRMED', canStart: false, itemStartAt: '2026-10-05T01:00:00Z' }),
    item({ id: 'ready-b' }), item({ id: 'ready-a' }),
    item({ id: 'active-b', status: 'IN_PROGRESS' }), item({ id: 'active-a', status: 'IN_PROGRESS' }),
    item({ id: 'cancelled', status: 'SCHEDULED', bookingStatus: 'CANCELLED', canStart: false })];
  const rows = model.todayRows(data, 'staff-a');
  assert.deepEqual(Array.from(rows, r => `${r.kind}:${r.item.id}`), ['current:active-a', 'current:active-b', 'next:ready-a', 'later:ready-b', 'later:waiting', 'finished:cancelled', 'finished:done']);
  assert.equal(rows.filter(r => r.primary).length, 1);
  assert.equal(rows.length, data.length);
  assert.equal(model.todayRows([...data].reverse(), 'staff-a').find(r => r.kind === 'next').item.id, 'ready-a');
  assert.equal(model.todayRows([data[0], data[6]], 'staff-a').some(r => r.kind === 'next'), false);
  assert.equal(model.todayRows([data[1]], 'staff-a')[0].kind, 'next');
  assert.equal(model.actionFor(data[1], 'staff-a'), null);
});
test('completed-day feedback never treats stale, empty, skipped or still-scheduled work as success', () => {
  const completed = item({ status: 'COMPLETED', canStart: false });
  assert.equal(model.allWorkCompleted([completed], true), true);
  for (const [items, fresh] of [[[], true], [[completed], false], [[completed, item()], true], [[item({ status: 'SKIPPED' })], true]]) {
    assert.equal(model.allWorkCompleted(items, fresh), false);
  }
});

function cardHarness() {
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: value => [value, () => {}], useEffect() {}, useRef: value => ({ current: value }) };
  const timeModel = load('../../utils/bookingOperationalTime');
  const timeHook = load('../../hooks/useOperationalTime', { react: React, 'react-native': {}, '../utils/bookingOperationalTime': timeModel });
  const card = load('WorkCard', { react: React, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '../../constants/colors': { colors: {} }, '../OperationPrimitives': { OperationButton: 'OperationButton' }, './workModel': model,
    '../../hooks/useOperationalTime': timeHook, '../../utils/bookingOperationalTime': timeModel });
  const nodes = tree => tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
    : typeof tree !== 'object' ? [tree] : typeof tree.type === 'function' ? nodes(tree.type({ ...tree.props, children: tree.children })) : [tree, ...tree.children.flatMap(nodes)];
  const render = extra => nodes(card.default({ item: item({ customer: { fullName: 'Nguyễn Thị Ngọc Ánh với tên đầy đủ rất dài' }, serviceNameSnapshot: 'Chăm sóc tóc chuyên sâu với mô tả dài', branch: { name: 'Chi nhánh', timezone: 'Asia/Bangkok' }, durationMinutes: 30 }), staffId: 'staff-a', serverNow: Date.now(), receivedAt: Date.now(), ...extra }));
  return { card, nodes, render };
}
test('actual card Nhận khách and Hoàn tất labels keep START/COMPLETE payload and pre-arrival safety', () => {
  const h = cardHarness(), calls = [];
  const next = h.render({ onAction: (item, action) => calls.push(action) });
  const button = next.find(n => n?.type === 'OperationButton');
  assert.equal(button.props.label, 'Nhận khách'); button.props.onPress();
  const current = h.render({ item: item({ status: 'IN_PROGRESS', canComplete: true, customer: { fullName: 'Khách' }, branch: { name: 'A' } }), variant: 'current', onAction: (item, action) => calls.push(action) });
  const complete = current.find(n => n?.type === 'OperationButton');
  assert.equal(complete.props.label, 'Hoàn tất'); complete.props.onPress();
  assert.deepEqual(calls, ['START', 'COMPLETE']);
  const waiting = h.render({ item: item({ bookingStatus: 'CONFIRMED', canStart: true, customer: { fullName: 'Khách' }, branch: { name: 'A' } }), onAction() {} });
  assert.ok(!waiting.some(n => n?.type === 'OperationButton'));
  assert.ok(waiting.includes('Chưa ghi nhận khách đến'));
  assert.equal(h.render({ disabled: true, onAction() {} }).find(n => n?.type === 'OperationButton').props.disabled, true);
});
test('compact agenda/later row opens detail without starting work or truncating operational names', () => {
  const h = cardHarness(); let opened = 0, writes = 0;
  const row = h.render({ variant: 'compact', onOpen: () => opened++, onAction: () => writes++ });
  row.find(n => n?.type === 'Pressable').props.onPress();
  assert.match(row.find(n => n?.type === 'Pressable').props.accessibilityLabel, /Dự kiến 10:00/);
  assert.equal(opened, 1); assert.equal(writes, 0);
  assert.ok(!row.some(n => n?.type === 'OperationButton'));
  assert.ok(row.includes('Nguyễn Thị Ngọc Ánh với tên đầy đủ rất dài'));
  assert.ok(row.includes('Chăm sóc tóc chuyên sâu với mô tả dài'));
  assert.ok(!row.some(n => n?.type === 'Text' && n.props.numberOfLines));
});
test('branch-local day and date navigation ignore device timezone and handle month boundaries', () => {
  const now = Date.parse('2026-10-04T18:30:00Z');
  assert.equal(model.branchDate(now, 'Asia/Bangkok'), '2026-10-05');
  assert.equal(model.branchDate(now, 'America/New_York'), '2026-10-04');
  assert.equal(model.branchDate(now, undefined), null);
  assert.equal(model.branchDate(now, 'invalid'), null);
  assert.equal(model.shiftDate('2026-12-31', 1), '2027-01-01');
});
test('actual timer survives reload and background via persisted start and server anchor', () => {
  const work = item({ status: 'IN_PROGRESS', actualTimingSource: 'SERVICE_ADJUSTMENT', actualStartedAt: '2026-10-05T03:00:00Z' });
  const server = Date.parse('2026-10-05T03:15:00Z');
  assert.equal(model.elapsedSeconds(work, server, 100000, 100000), 900);
  assert.equal(model.elapsedSeconds(work, server, 100000, 160000), 960);
  assert.equal(model.elapsedSeconds(work, server + 60000, 900000, 900000), 960);
  assert.equal(model.elapsedSeconds({ ...work, actualTimingSource: 'UNAVAILABLE' }, server, 0, 0), null);
  assert.equal(model.elapsedSeconds({ ...work, actualStartedAt: null }, server, 0, 0), null);
  assert.equal(model.elapsedSeconds({ ...work, status: 'COMPLETED', actualCompletedAt: '2026-10-05T03:10:00Z' }, server, 0, 999999), 600);
  assert.equal(model.elapsedSeconds({ ...work, status: 'COMPLETED' }, server, 0, 0), null);
});
test('lifecycle sends booking UUID + item ID + captured expectedRevision; ignores unsafe response', async () => {
  const h = api();
  await h.staffApi.update(item(), 'START');
  assert.equal(h.calls[0].url, '/bookings/booking-uuid/items/item-a');
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { action: 'START', expectedRevision: 3, reason: 'Nhân viên bắt đầu dịch vụ được phân công trên mobile.' });
  assert.equal(h.calls[0].init.method, 'PATCH');
});
test('safe list traverses all pages and reports full total; stale request stops pagination', async () => {
  const h = api(), calls = [];
  const read = async q => { calls.push(q); return { data: Array.from({ length: q.page === 1 ? 50 : 1 }, (_, i) => item({ id: `${q.page}-${i}` })), total: 51, page: q.page, limit: 50, serverNow: '2026-10-05T03:00:00Z' }; };
  const result = await h.readWorkDay({ branchId: 'branch', dateFrom: '2026-10-05', dateTo: '2026-10-05' }, () => true, read);
  assert.equal(result.data.length, 51); assert.equal(result.total, 51); assert.equal(calls.length, 2);
  let current = true, count = 0;
  await assert.rejects(h.readWorkDay({ branchId: 'branch' }, () => current, async q => { count++; current = false; return read(q); }), /STALE_REQUEST/);
  assert.equal(count, 1);
});
test('pagination fails explicitly on premature empty page and never silently truncates', async () => {
  const h = api();
  await assert.rejects(h.readWorkDay({ branchId: 'branch' }, () => true, async q => ({ data: [], total: 51, page: q.page, limit: 50 })), /chưa đầy đủ/);
});
test('double-tap cannot send second lifecycle; no success before mutation and safe read finish', async () => {
  const gate = model.createWorkGate(); let sends = 0, reads = 0, resolveMutation;
  const pending = gate.run(() => { sends++; return new Promise(resolve => { resolveMutation = resolve; }); }, async () => { reads++; });
  assert.equal(gate.blocked, true);
  assert.equal(await gate.run(async () => sends++, async () => reads++), false);
  assert.equal(reads, 0); resolveMutation(); await pending;
  assert.equal(sends, 1); assert.equal(reads, 1); assert.equal(gate.blocked, false);
});
test('timeout refetch runs once; failed refetch blocks retry until explicit reconciliation', async () => {
  const gate = model.createWorkGate(); let reads = 0, sends = 0;
  await assert.rejects(gate.run(async () => { sends++; throw new Error('timeout'); }, async () => { reads++; throw new Error('offline'); }), /offline/);
  assert.equal(gate.blocked, true);
  await gate.run(async () => sends++, async () => reads++);
  assert.equal(sends, 1); assert.equal(reads, 1);
  await gate.reconcile(async () => { reads++; });
  assert.equal(gate.blocked, false); assert.equal(reads, 2);
});
test('revision conflict performs safe read before making next action available', async () => {
  const gate = model.createWorkGate(); let reads = 0;
  await assert.rejects(gate.run(async () => { throw new Error('409'); }, async () => { reads++; }), /409/);
  assert.equal(reads, 1); assert.equal(gate.blocked, false);
});
test('reassignment, lost scope and missing staff profile discard sensitive cached work', () => {
  for (const status of [401, 403, 404]) assert.equal(model.workError({ status }).removeData, true);
  assert.match(model.workError({ status: 404, payload: { code: 'STAFF_PROFILE_REQUIRED' } }).message, /Hồ sơ nhân viên/);
  assert.equal(model.workError({ status: 0 }).removeData, false);
});

// Run actual hooks with controlled promises; no native runtime or network is started.
function hooks() {
  const states = [], refs = []; let stateIndex = 0, refIndex = 0;
  const React = {
    useState(value) { const i = stateIndex++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(value) { const i = refIndex++; return refs[i] ||= { current: value }; },
    useCallback: fn => fn, useEffect() {},
  };
  return { React, render(fn) { stateIndex = refIndex = 0; return fn(); } };
}
test('actual staff data hook fences previous context and revision responses', async () => {
  const h = hooks(); let generation = 1, resolveOld;
  const ops = { contextKey: 'account-a', branchId: 'branch', businessId: 'business', revision: 1,
    canWorkAsStaff: true, staffProfile: { id: 'staff-a' } };
  let read = () => new Promise(resolve => { resolveOld = resolve; });
  const mod = load('useStaffWork', { react: h.React, '../../api/client': { getApiSessionGeneration: () => generation },
    '../OperationsContext': { useOperations: () => ops }, './staffApi': { staffApi: { detail: (...args) => read(...args) }, readWorkDay: (...args) => read(...args) }, './workModel': model });
  const render = () => h.render(() => mod.useStaffWork({ itemId: 'item-a' }));
  const pending = render().load();
  ops.contextKey = 'account-b'; generation++;
  render();
  resolveOld(item({ serverNow: '2026-10-05T03:00:00Z' }));
  assert.equal(await pending, false); assert.equal(render().items.length, 0);
  read = async () => item({ serverNow: '2026-10-05T03:00:00Z' });
  assert.equal(await render().load(), true); assert.equal(render().fresh, true);
  ops.revision++;
  assert.equal(render().fresh, false);
  read = async () => { throw { status: 404 }; };
  await render().load();
  assert.equal(render().items.length, 0); assert.match(render().error, /không còn được giao/);
});
test('actual staff data hook retains stale read data on offline failure but forbids actions', async () => {
  const h = hooks(); const ops = { contextKey: 'account-a', branchId: 'branch', businessId: 'business', revision: 1,
    canWorkAsStaff: true, staffProfile: { id: 'staff-a' } };
  let read = async () => item({ serverNow: '2026-10-05T03:00:00Z' });
  const mod = load('useStaffWork', { react: h.React, '../../api/client': { getApiSessionGeneration: () => 1 },
    '../OperationsContext': { useOperations: () => ops }, './staffApi': { staffApi: { detail: () => read() } }, './workModel': model });
  const render = () => h.render(() => mod.useStaffWork({ itemId: 'item-a' }));
  await render().load(); assert.equal(render().items.length, 1);
  read = async () => { throw { status: 0 }; };
  await render().load(); assert.equal(render().items.length, 1); assert.equal(render().fresh, false);
  assert.match(render().error, /có thể đã cũ/);
  ops.canWorkAsStaff = false;
  assert.equal(render().items.length, 0);
});
test('COMPLETE confirmation cannot send after context changes', async () => {
  const h = hooks(); const alerts = []; let sends = 0;
  const props = { identity: 'account-a', fresh: true, staffId: 'staff-a', reload: async () => true, refresh() {} };
  const mod = load('useWorkActions', { react: h.React, 'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '../../api/client': { getApiSessionGeneration: () => 1 }, './staffApi': { staffApi: { update: async () => sends++ } }, './workModel': model });
  const render = () => h.render(() => mod.useWorkActions(props));
  render().action(item({ status: 'IN_PROGRESS', canComplete: true, serviceNameSnapshot: 'Cắt tóc', customer: { fullName: 'Khách A' } }), 'COMPLETE');
  assert.equal(sends, 0); assert.match(alerts[0][1], /Cắt tóc · Khách A/);
  props.identity = 'account-b'; render();
  alerts[0][2][1].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 0);
});

test('COMPLETE alert from an unmounted navigator cannot submit in the unchanged auth session', async () => {
  const h = hooks(), alerts = []; let cleanup, sends = 0;
  h.React.useEffect = effect => { cleanup = effect(); };
  const props = { identity: 'same-session', fresh: true, staffId: 'staff-a', reload: async () => true, refresh() {} };
  const mod = load('useWorkActions', { react: h.React, 'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '../../api/client': { getApiSessionGeneration: () => 1 }, './staffApi': { staffApi: { update: async () => sends++ } }, './workModel': model });
  h.render(() => mod.useWorkActions(props)).action(item({ status: 'IN_PROGRESS', canComplete: true, serviceNameSnapshot: 'Cắt tóc', customer: { fullName: 'Khách A' } }), 'COMPLETE');
  assert.equal(alerts.length, 1); cleanup();
  alerts[0][2][1].onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 0);
});
test('actual lifecycle hook refetches restricted detail and list after timeout, without replay', async () => {
  const h = hooks(); const calls = [];
  const props = { identity: 'account-a', fresh: true, staffId: 'staff-a',
    reload: async () => { calls.push('safe-list'); return true; }, refresh: () => calls.push('refresh') };
  const mod = load('useWorkActions', { react: h.React, 'react-native': { Alert: { alert() {} } },
    '../../api/client': { getApiSessionGeneration: () => 1 }, './staffApi': { staffApi: {
      update: async () => { calls.push('write'); throw new Error('timeout'); },
      detail: async id => { calls.push(`safe-detail:${id}`); return item({ status: 'IN_PROGRESS' }); },
    } }, './workModel': model });
  const render = () => h.render(() => mod.useWorkActions(props));
  render().action(item(), 'START'); render().action(item(), 'START');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['write', 'safe-detail:item-a', 'safe-list']);
  assert.equal(render().blocked, false);
  assert.match(render().message, /Đã đọc lại công việc/);
});
