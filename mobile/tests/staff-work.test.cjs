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
const schedule = load('../../utils/bookingSchedule');
const model = load('workModel', { '../../utils/bookingSchedule': schedule });
// Design tokens are a pure module; load them for real so card styles evaluate.
const theme = load('../../theme/index');
const item = (extra = {}) => ({ id: 'item-a', bookingId: 'booking-uuid', bookingCode: 'BB123', staffId: 'staff-a', branchId: 'branch', businessId: 'business',
  status: 'SCHEDULED', bookingStatus: 'CHECKED_IN', revision: 3, canStart: true, canComplete: false, itemStartAt: '2026-10-05T03:00:00Z', ...extra });
const api = () => {
  const calls = [];
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const mod = load('staffApi', { '../../api/client': { ApiError, withQuery: (url, q) => url + '?' + new URLSearchParams(q), apiRequest: async (url, init) => { calls.push({ url, init }); return {}; } } });
  return { ...mod, calls };
};





function cardHarness() {
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: value => [value, () => {}], useEffect() {}, useRef: value => ({ current: value }) };
  const timeModel = load('../../utils/bookingOperationalTime');
  const timeHook = load('../../hooks/useOperationalTime', { react: React, 'react-native': {}, '../utils/bookingOperationalTime': timeModel });
  const card = load('WorkCard', { react: React, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '../../constants/colors': { colors: {} }, '../../theme': theme, '../OperationPrimitives': { OperationButton: 'OperationButton' }, './workModel': model,
    '../../hooks/useOperationalTime': timeHook, '../../utils/bookingOperationalTime': timeModel });
  const nodes = tree => tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(nodes)
    : typeof tree !== 'object' ? [tree] : typeof tree.type === 'function' ? nodes(tree.type({ ...tree.props, children: tree.children })) : [tree, ...tree.children.flatMap(nodes)];
  const render = extra => nodes(card.default({ item: item({ customer: { fullName: 'Nguyễn Thị Ngọc Ánh với tên đầy đủ rất dài' }, serviceNameSnapshot: 'Chăm sóc tóc chuyên sâu với mô tả dài', branch: { name: 'Chi nhánh', timezone: 'Asia/Bangkok' }, durationMinutes: 30 }), staffId: 'staff-a', serverNow: Date.now(), receivedAt: Date.now(), ...extra }));
  return { card, nodes, render };
}

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
    '../OperationsContext': { useOperations: () => ops }, './staffApi': { staffApi: { detail: (...args) => read(...args) }, readWorkDay: (...args) => read(...args) }, './workModel': model, '../../utils/bookingSchedule': schedule });
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
    '../OperationsContext': { useOperations: () => ops }, './staffApi': { staffApi: { detail: () => read() } }, './workModel': model, '../../utils/bookingSchedule': schedule });
  const render = () => h.render(() => mod.useStaffWork({ itemId: 'item-a' }));
  await render().load(); assert.equal(render().items.length, 1);
  read = async () => { throw { status: 0 }; };
  await render().load(); assert.equal(render().items.length, 1); assert.equal(render().fresh, false);
  assert.match(render().error, /có thể đã cũ/);
  ops.canWorkAsStaff = false;
  assert.equal(render().items.length, 0);
});



test('staff API is readonly even with legacy eligibility flags', async () => {
  const h = api();
  assert.equal(h.staffApi.update, undefined);
  assert.deepEqual(Object.keys(h.staffApi).sort(), ['detail', 'page']);
  await h.staffApi.page({ branchId: 'branch', bookingId: 'booking-uuid', page: 1, limit: 50 });
  await h.staffApi.detail('item-a');
  assert.ok(h.calls.every(c => c.url.startsWith('/bookings/my-work-items')));
  assert.ok(h.calls.every(c => !c.init.method && !c.init.body));
  assert.equal(fs.existsSync(path.join(__dirname, '../src/operations/staff/useWorkActions.ts')), false);
});
test('cards only open detail for scheduled, checked-in, elapsed and legacy running work', () => {
  const h = cardHarness();
  for (const extra of [{ bookingStatus: 'CONFIRMED' }, {}, { scheduleBucket: 'HISTORY', scheduleElapsed: true },
    { status: 'IN_PROGRESS', bookingStatus: 'IN_PROGRESS', canComplete: true }]) {
    let opened = 0, mutations = 0;
    const nodes = h.render({ item: item({ customer: { fullName: 'Khách' }, branch: { name: 'A' }, ...extra }), onOpen: () => opened++, onAction: () => mutations++ });
    assert.ok(!nodes.some(n => n?.type === 'OperationButton'));
    assert.ok(!nodes.some(n => typeof n === 'string' && /Bắt đầu dịch vụ|Hoàn tất dịch vụ|chưa bắt đầu/.test(n)));
    nodes.find(n => n?.type === 'Pressable').props.onPress();
    assert.equal(opened, 1); assert.equal(mutations, 0);
  }
  assert.ok(h.render({ item: item({ bookingStatus: 'CONFIRMED', customer: {}, branch: {} }) }).includes('Đã lên lịch'));
  assert.ok(h.render({ item: item({ scheduleBucket: 'HISTORY', customer: {}, branch: {} }) }).includes('Đã đến · Lịch đã qua'));
});
test('timetable chronology ignores START flags, status ranks and elapsed history', () => {
  const data = [item({ id: 'late', canStart: true, itemStartAt: '2026-10-05T05:00:00Z' }),
    item({ id: 'earliest', canStart: false, bookingStatus: 'CONFIRMED', itemStartAt: '2026-10-05T01:00:00Z' }),
    item({ id: 'history', scheduleBucket: 'HISTORY', itemStartAt: '2026-10-05T02:00:00Z' }),
    item({ id: 'running', status: 'IN_PROGRESS', itemStartAt: '2026-10-05T04:00:00Z' })];
  assert.deepEqual(Array.from(model.todayRows(data), r => r.item.id), ['earliest', 'history', 'running', 'late']);
  assert.deepEqual(Array.from(model.orderWork(data.reverse()), r => r.id), ['earliest', 'history', 'running', 'late']);
  assert.equal(model.workStatusLabel(data.find(i => i.id === 'history')), 'Đã đến · Lịch đã qua');
});

test('checked-in mixed siblings retain terminal item badges and separate arrival before and after booking end', () => {
  const h = cardHarness();
  for (const history of [false, true]) {
    const arrival = history ? 'Đã đến · Lịch đã qua' : 'Khách đã đến';
    const shared = { customer: { fullName: 'Khách A' }, branch: { name: 'A' }, scheduleBucket: history ? 'HISTORY' : 'UPCOMING', scheduleElapsed: history };
    const siblings = [item({ ...shared, id: 'active', status: 'SCHEDULED' }),
      item({ ...shared, id: 'skipped', status: 'SKIPPED' }), item({ ...shared, id: 'cancelled', status: 'CANCELLED' }),
      item({ ...shared, id: 'legacy-done', status: 'COMPLETED' })];
    assert.equal(model.todayRows(siblings).length, siblings.length);
    for (const [work, badge] of [[siblings[0], arrival], [siblings[1], 'Đã bỏ qua'], [siblings[2], 'Đã hủy'], [siblings[3], 'Đã hoàn tất']]) {
      assert.equal(model.workStatusLabel(work), badge);
      assert.equal(model.workArrivalLabel(work), arrival);
      for (const variant of ['compact', 'next', 'detail']) {
        const nodes = h.render({ item: work, variant, onOpen() {} });
        assert.ok(nodes.includes(badge)); assert.ok(nodes.includes(arrival));
        const target = nodes.find(n => n?.type === 'Pressable');
        assert.ok(target.props.accessibilityLabel.includes(badge));
        assert.ok(target.props.accessibilityLabel.includes(arrival));
        assert.ok(!nodes.some(n => n?.type === 'OperationButton'));
      }
    }
  }
});
