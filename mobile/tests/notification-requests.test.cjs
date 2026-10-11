const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
function load(file, modules = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return module.exports;
}
const helper = load('utils/notificationRequests.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const item = (id = 'one', isRead = false) => ({ id, isRead, title: id, createdAt: '2026-10-11' });
const page = (rows = [item()], current = 1, totalPages = 3, unreadCount = 3) => ({ data: rows, pagination: { page: current, totalPages, total: 60 }, unreadCount });
function harness(append = false) {
  let valid = true, changes = 0;
  const lists = [], reads = [], alls = [];
  const api = {
    list(number) { const d = deferred(); lists.push({ ...d, number }); return d.promise; },
    markRead(id) { const d = deferred(); reads.push({ ...d, id }); return d.promise; },
    markAllRead() { const d = deferred(); alls.push(d); return d.promise; },
  };
  const q = helper.createNotificationRequests(api, append, () => valid, () => changes++);
  q.activate();
  return { q, api, lists, reads, alls, get changes() { return changes; }, invalidate() { valid = false; } };
}
async function seed(h, result = page()) { const wait = h.q.load(); h.lists.at(-1).resolve(result); await wait; }

test('Messages page 2 resolving after read-all and page 1 reload cannot restore unread rows or pagination', async () => {
  const h = harness(true); await seed(h);
  h.q.move(1); const stale = h.lists[1];
  const all = h.q.markAllRead(); void h.q.markAllRead(); h.q.move(1);
  assert.equal(h.alls.length, 1); assert.equal(h.lists.length, 2);
  h.alls[0].resolve(); await settle();
  assert.equal(h.lists[2].number, 1);
  h.lists[2].resolve(page([item('one', true)], 1, 1, 0)); await all;
  stale.resolve(page([item('stale')], 2)); await settle();
  assert.equal(h.q.getState().page, 1); assert.equal(h.q.getState().data.data.length, 1);
  assert.equal(h.q.getState().data.data[0].isRead, true); assert.equal(h.q.getState().data.unreadCount, 0);
  assert.equal(h.q.getState().data.pagination.totalPages, 1); assert.equal(h.q.getState().busy, false);
});

test('duplicate item reads share one PATCH and one open callback; stale list is replaced after the mark', async () => {
  const h = harness(); await seed(h); h.q.move(1);
  let opened = 0;
  const first = h.q.markRead(item(), () => opened++);
  await h.q.markRead(item(), () => opened++);
  assert.equal(h.reads.length, 1);
  h.reads[0].resolve(); await first;
  assert.equal(opened, 1); assert.equal(h.q.getState().data.data[0].isRead, true);
  assert.equal(h.q.getState().data.unreadCount, 2);
  h.lists[1].resolve(page([item('stale')], 2, 99, 99)); await settle();
  assert.equal(h.q.getState().busy, true); assert.equal(h.q.getState().page, 1);
  h.lists[2].resolve(page([item()], 2, 2, 2)); await settle();
  assert.equal(h.q.getState().page, 2); assert.equal(h.q.getState().data.data[0].isRead, true);
  assert.equal(h.q.getState().data.unreadCount, 2);
  await h.q.markRead(item()); assert.equal(h.reads.length, 1);
});

for (const append of [false, true]) test(`${append ? 'Messages' : 'Operations'} trusts fresh server count with stale unread row, preserving local read flags`, async () => {
  const h = harness(append); await seed(h);
  const mark = h.q.markRead(item()); h.reads[0].resolve(); await mark;
  assert.equal(h.q.getState().data.unreadCount, 2); // Local snapshot decremented once.
  for (const count of [2, 3]) {
    const reload = h.q.reload();
    h.lists.at(-1).resolve(page([item('one', false)], 1, 3, count)); await reload;
    assert.equal(h.q.getState().data.data[0].isRead, true);
    assert.equal(h.q.getState().data.unreadCount, count); // Authoritative count is unchanged.
  }
  await h.q.markRead(item());
  assert.equal(h.reads.length, 1); assert.equal(h.q.getState().data.unreadCount, 3);
});

for (const append of [false, true]) test(`${append ? 'Messages' : 'Operations'} does not decrement an API count received while the read PATCH is pending`, async () => {
  const h = harness(append); await seed(h);
  const mark = h.q.markRead(item()); const reload = h.q.reload();
  h.lists[1].resolve(page([item('one', false)], 1, 3, 2)); await reload;
  assert.equal(h.q.getState().data.unreadCount, 2);
  h.reads[0].resolve(); await mark;
  assert.equal(h.q.getState().data.data[0].isRead, true);
  assert.equal(h.q.getState().data.unreadCount, 2);
});

test('read-all normalizes mixed-fresh page 1 without letting fenced page 2 restore its count or rows', async () => {
  const h = harness(true); await seed(h); h.q.move(1);
  const stale = h.lists[1]; const all = h.q.markAllRead();
  h.alls[0].resolve(); await settle();
  h.lists[2].resolve(page([item('one', false)], 1, 1, 0)); await all;
  stale.resolve(page([item('stale', false)], 2, 99, 99)); await settle();
  assert.equal(h.q.getState().page, 1); assert.equal(h.q.getState().data.data.length, 1);
  assert.equal(h.q.getState().data.data[0].isRead, true); assert.equal(h.q.getState().data.unreadCount, 0);
  assert.equal(h.q.getState().data.pagination.totalPages, 1);
});

test('same-frame pager taps cannot overshoot; both ends clamp and shrinking page count reloads the last page', async () => {
  const h = harness(); await seed(h, page([item()], 1, 2));
  h.q.move(-1); assert.equal(h.lists.length, 1);
  h.q.move(1); h.q.move(1); h.q.move(-1); assert.equal(h.lists.length, 2);
  h.lists[1].resolve(page([item('two')], 2, 2)); await settle();
  h.q.move(1); assert.equal(h.lists.length, 2);
  h.q.move(-1); h.q.move(-1); assert.equal(h.lists[2].number, 1);
  h.lists[2].resolve(page()); await settle();
  h.q.move(1); h.lists[3].resolve(page([], 2, 1)); await settle();
  assert.equal(h.lists[4].number, 1); assert.equal(h.q.getState().busy, true);
  h.lists[4].resolve(page([], 1, 0, 0)); await settle();
  assert.equal(h.q.getState().page, 1); assert.equal(h.q.getState().busy, false);
});

test('replacement reload owns data, error and busy even when the old request rejects first', async () => {
  const h = harness(); const old = h.q.load(); const fresh = h.q.reload();
  h.lists[0].reject(new Error('old')); await old;
  assert.equal(h.q.getState().error, null); assert.equal(h.q.getState().busy, true);
  h.lists[1].resolve(page([item('fresh')])); await fresh;
  assert.equal(h.q.getState().data.data[0].id, 'fresh');
});

test('Operations refresh after a mark preserves the requested page while replacing its stale response', async () => {
  const h = harness(); await seed(h); h.q.move(1);
  const mark = h.q.markRead(item(), () => { void h.q.reload(); });
  h.reads[0].resolve(); await mark;
  assert.equal(h.lists[2].number, 2); assert.equal(h.lists[3].number, 2);
  h.lists[1].resolve(page([item('old')], 2)); h.lists[2].resolve(page([item('replaced')], 2)); await settle();
  assert.equal(h.q.getState().busy, true);
  h.lists[3].resolve(page([item('fresh')], 2)); await settle();
  assert.equal(h.q.getState().page, 2); assert.equal(h.q.getState().data.data[0].id, 'fresh');
});

test('mark failure permits retry and leaves unread state intact', async () => {
  const h = harness(); await seed(h); let failures = 0;
  const wait = h.q.markRead(item(), undefined, () => failures++);
  h.reads[0].reject(new Error('offline')); await wait;
  assert.equal(failures, 1); assert.equal(h.q.getState().data.data[0].isRead, false);
  const retry = h.q.markRead(item()); assert.equal(h.reads.length, 2);
  h.reads[1].resolve(); await retry; assert.equal(h.q.getState().data.data[0].isRead, true);
});

test('read-all failure releases guards and reloads without claiming all rows read', async () => {
  const h = harness(true); await seed(h); let failures = 0;
  const wait = h.q.markAllRead(() => failures++);
  h.alls[0].reject(new Error('offline')); await settle();
  assert.equal(h.q.getState().markingAll, false); assert.equal(h.q.getState().data.data[0].isRead, false);
  h.lists[1].resolve(page()); await wait; assert.equal(failures, 1);
});

for (const fence of ['session', 'unmount']) test(`${fence} fences list/read/read-all success, errors, alerts and routing`, async () => {
  const h = harness(); await seed(h);
  const list = h.q.reload(); let effects = 0;
  const mark = h.q.markRead(item(), () => effects++, () => effects++);
  const all = h.q.markAllRead(() => effects++);
  if (fence === 'session') h.invalidate(); else h.q.dispose();
  const changes = h.changes;
  h.lists[1].reject(new Error('old')); h.reads[0].resolve(); h.alls[0].reject(new Error('old'));
  await Promise.all([list, mark, all]);
  assert.equal(effects, 0); assert.equal(h.changes, changes); assert.equal(h.lists.length, 2);
  assert.equal(h.q.getState().data.data[0].isRead, false);
});

test('lifetime generation rejects callbacks after dispose/reactivate, including an old read finally', async () => {
  const h = harness(); const old = h.q.markRead(item());
  h.q.dispose(); h.q.activate(); const fresh = h.q.markRead(item());
  h.reads[0].resolve(); await old;
  await h.q.markRead(item()); assert.equal(h.reads.length, 2);
  h.reads[1].resolve(); await fresh;
});

test('append pagination deduplicates IDs and authorization failures clear displayed data', async () => {
  const h = harness(true); await seed(h); h.q.move(1);
  h.lists[1].resolve(page([item(), item('two')], 2)); await settle();
  assert.equal(h.q.getState().data.data.length, 2);
  const wait = h.q.reload(); h.lists[2].reject({ status: 403 }); await wait;
  assert.equal(h.q.getState().data, null); assert.equal(h.q.getState().busy, false);
});

function hookHarness() {
  const slots = []; let cursor = 0, effects = [], generation = 1, token = 'token', listener;
  const auth = { user: { id: 'same-user' }, isLoggedIn: true };
  const h = harness();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const mod = load('hooks/useNotificationRequests.ts', {
    react, '../api/client': { getApiSessionGeneration: () => generation, getApiAccessToken: () => token,
      subscribeApiAccessToken: fn => { listener = fn; return () => { listener = null; }; } },
    '../api/notifications': { notificationsApi: h.api }, '../context/AuthContext': { useAuth: () => auth },
    '../utils/notificationRequests': helper,
  });
  return { ...h, render(key = 'branch-a', revision = 0, runEffects = true) {
    cursor = 0; const result = mod.useNotificationRequests(false, key, revision);
    if (runEffects) { const next = effects; effects = []; next.forEach(fn => fn()); }
    return result;
  }, commit() { const next = effects; effects = []; next.forEach(fn => fn()); },
  session(nextToken) { generation++; token = nextToken; listener?.(); }, rotate() { token = 'rotated'; listener?.(); },
  unmount() { slots.forEach(slot => slot?.cleanup?.()); }, get subscribed() { return Boolean(listener); } };
}

test('hook fences same-user session replacement immediately, resets data and unsubscribes on unmount', async () => {
  const h = hookHarness(); const old = h.render(); let opened = 0;
  const read = old.requests.markRead(item(), () => opened++);
  h.session('new-session'); h.reads[0].resolve(); await read; assert.equal(opened, 0);
  const fresh = h.render(); assert.notEqual(fresh.requests, old.requests); assert.equal(fresh.data, null);
  h.lists[0].resolve(page([item('old')])); h.lists[1].resolve(page([item('new')])); await settle();
  assert.equal(h.render().data.data[0].id, 'new');
  h.unmount(); assert.equal(h.subscribed, false);
});

test('hook fences context during render before cleanup and keeps token rotation in the same session', async () => {
  const h = hookHarness(); const old = h.render(); let opened = 0;
  const read = old.requests.markRead(item(), () => opened++);
  h.render('branch-b', 0, false); h.reads[0].resolve(); await read; assert.equal(opened, 0);
  h.commit(); const fresh = h.render('branch-b');
  h.rotate(); assert.equal(h.render('branch-b').requests, fresh.requests);
  h.lists[0].resolve(page([item('old')])); h.lists[1].resolve(page([item('current')])); await settle();
  assert.equal(h.render('branch-b').data.data[0].id, 'current'); h.unmount();
});

test('hook logout suppresses pending alerts and does not start an unauthenticated list', async () => {
  const h = hookHarness(); const current = h.render(); let alerts = 0;
  const mark = current.requests.markRead(item(), undefined, () => alerts++);
  h.session(null); h.reads[0].reject(new Error('old')); await mark; h.render();
  assert.equal(alerts, 0); assert.equal(h.lists.length, 1); h.unmount();
});

const elementReact = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  useState(value) { return [value, () => {}]; },
};
const native = { View: 'View', Text: 'Text', FlatList: 'FlatList', Pressable: 'Pressable', TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value }, Alert: { alert() {} } };
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...(tree.props?.children ?? []).flat(Infinity).flatMap(nodes)];
}

test('Messages source wires read-all and append pager to the guarded requests', () => {
  const calls = [];
  const requests = { markAllRead: () => calls.push('all'), markRead: () => calls.push('read'), move: delta => calls.push(delta) };
  const Screen = load('screens/MessagesScreen.tsx', {
    react: { ...elementReact, default: elementReact }, 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../theme': load('theme/index.ts'), '../ui': { ScreenHeader: 'ScreenHeader', IconButton: 'IconButton', AppButton: 'AppButton', EmptyState: 'EmptyState', LoadingState: 'LoadingState', Notice: 'Notice' }, '../hooks/useNotificationRequests': { useNotificationRequests: append => {
      assert.equal(append, true); return { data: page(), page: 1, busy: false, markingAll: true, error: null, requests };
    } },
  }).default;
  const tree = Screen({ navigation: { goBack() {} } });
  const header = nodes(tree).find(node => node.type === 'ScreenHeader');
  const readAll = header.props.right;
  assert.equal(readAll.props.disabled, true); readAll.props.onPress();
  const list = nodes(tree).find(node => node.type === 'FlatList');
  const pager = list.props.ListFooterComponent; assert.equal(pager.props.disabled, true); pager.props.onPress();
  list.props.renderItem({ item: item() }).props.onPress();
  assert.deepEqual(calls, ['all', 1, 'read']);
});

test('Operations source disables both pager directions while busy and uses guarded item marks', () => {
  const calls = [];
  const requests = { move: delta => calls.push(delta), markRead: row => calls.push(row.id) };
  const Screen = load('operations/OperationsNotifications.tsx', {
    react: { ...elementReact, default: elementReact }, 'react-native': native, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '../theme': load('theme/index.ts'),
    '../utils/operationNotifications': { operationNotificationTarget: () => null },
    './OperationsContext': { useOperations: () => ({ contextKey: 'branch', revision: 4, mode: 'OWNER', refresh() {} }) },
    './OperationPrimitives': { OperationPage: 'OperationPage', OperationState: 'OperationState', OperationButton: 'OperationButton' },
    '../hooks/useNotificationRequests': { useNotificationRequests: (append, key, revision) => {
      assert.equal(append, false); assert.equal(key, 'branch'); assert.equal(revision, 4);
      return { data: page([item()], 2), page: 2, busy: true, error: null, requests };
    } },
  }).default;
  const list = nodes(Screen({})).find(node => node.type === 'FlatList');
  const buttons = nodes(list.props.ListFooterComponent).filter(node => node.type === 'OperationButton');
  assert.equal(buttons.length, 2);
  buttons.forEach(button => { assert.equal(button.props.disabled, true); button.props.onPress(); });
  list.props.renderItem({ item: item() }).props.onPress();
  assert.deepEqual(calls, [-1, 1, 'one']);
});
