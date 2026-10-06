const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, modules = {}, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require(name) { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; }, Headers, Response, console, setTimeout, clearTimeout, ...globals }, { filename: file });
  return module.exports;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function clock() {
  let id = 0; const timers = new Map();
  return { setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, async tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); await settle(); }, get size() { return timers.size; } };
}
function socket() {
  const listeners = new Map();
  return { auth: {}, connects: 0, disconnects: 0,
    on(e, fn) { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e).add(fn); },
    off(e, fn) { listeners.get(e)?.delete(fn); },
    emit(e, ...args) { [...(listeners.get(e) ?? [])].forEach(fn => fn(...args)); },
    connect() { this.connects++; }, disconnect() { this.disconnects++; },
    get count() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
  };
}
const sync = load('utils/bookingSync.ts');

test('burst coalesces; invalidation during flight rejects stale data and makes one trailing fetch', async () => {
  const c = clock(), pending = [], commits = [], errors = []; let simultaneous = 0, maximum = 0;
  const { createInvalidationQueue } = load('utils/bookingSync.ts', {}, c);
  const q = createInvalidationQueue({ fetch() { const d = deferred(); pending.push(d); maximum = Math.max(maximum, ++simultaneous); return d.promise.finally(() => simultaneous--); }, commit: rows => commits.push(rows), fail: e => errors.push(e) });
  const waits = [q.invalidate(), q.invalidate(), q.invalidate()];
  assert.equal(c.size, 1); await c.tick(); assert.equal(pending.length, 1);
  waits.push(q.invalidate(), q.invalidate()); pending[0].resolve('stale'); await settle();
  assert.deepEqual(commits, []); assert.equal(pending.length, 2); assert.equal(maximum, 1);
  pending[1].resolve('latest'); await Promise.all(waits);
  assert.deepEqual(commits, ['latest']); assert.deepEqual(errors, []); assert.equal(c.size, 0);
});

test('dispose cancels queued work and fences an old account response; background defers work until resume', async () => {
  const c = clock(), d = deferred(), commits = [], busy = []; let calls = 0;
  const { createInvalidationQueue } = load('utils/bookingSync.ts', {}, c);
  const q = createInvalidationQueue({ fetch: () => { calls++; return d.promise; }, commit: x => commits.push(x), fail() {}, busy: x => busy.push(x) });
  q.suspend(true); await q.invalidate(); await c.tick(); assert.equal(calls, 0);
  q.suspend(false); await c.tick(); assert.equal(calls, 1);
  const wait = q.invalidate(); q.dispose(); await wait; d.resolve('private old data'); await settle();
  assert.deepEqual(commits, []); assert.equal(c.size, 0);
  const q2 = createInvalidationQueue({ fetch: async () => { calls++; }, commit() {}, fail() {} });
  const queued = q2.invalidate(); q2.dispose(); await queued; await c.tick(); assert.equal(calls, 1);
});

test('suspend fences in-flight result and refetches exactly once on resume', async () => {
  const c = clock(), d = deferred(), commits = []; let calls = 0;
  const { createInvalidationQueue } = load('utils/bookingSync.ts', {}, c);
  const q = createInvalidationQueue({ fetch: () => ++calls === 1 ? d.promise : Promise.resolve('foreground'), commit: x => commits.push(x), fail() {} });
  void q.invalidate(); await c.tick(); q.suspend(true); d.resolve('background stale'); await settle();
  assert.deepEqual(commits, []); q.suspend(false); await c.tick(); assert.deepEqual(commits, ['foreground']); assert.equal(calls, 2); q.dispose();
});

function binding(overrides = {}, syncApi = sync) {
  const s = socket(); let token = 'access', subscriber; const trace = [];
  const b = syncApi.bindBookingSocket(s, { token: () => token, subscribeToken(fn) { subscriber = fn; return () => { subscriber = null; }; }, refreshToken: async () => token, invalidate: () => trace.push('fetch'), clear: () => trace.push('clear'), suspend: value => trace.push(`suspend:${value}`), active: true, ...overrides });
  return { s, b, trace, token(value) { token = value; subscriber?.(value); }, get subscribed() { return Boolean(subscriber); } };
}

test('root origin, auth.token, invalidation-only events and access revocation clear before refetch', () => {
  assert.equal(sync.schedulerOrigin('http://10.0.2.2:3012/api/v1/'), 'http://10.0.2.2:3012');
  const h = binding(); assert.equal(h.s.auth.token, 'access'); assert.equal(h.s.connects, 1);
  h.trace.length = 0;
  for (const event of ['booking_created', 'booking_updated', 'booking_deleted', 'scheduler_resync']) h.s.emit(event, { id: 'hostile', secret: 'never merge' });
  assert.deepEqual(h.trace, ['fetch', 'fetch', 'fetch', 'fetch']);
  h.trace.length = 0; h.s.emit('scheduler_access_changed'); assert.deepEqual(h.trace, ['clear', 'fetch']); h.b.dispose();
});

test('background disconnects; foreground and network reconnect refetch; rotation reconnects; cleanup removes listeners', () => {
  const h = binding(); h.trace.length = 0; h.b.setActive(false); const connects = h.s.connects;
  h.s.emit('booking_created'); h.token('rotated'); assert.equal(h.s.connects, connects); assert.ok(!h.trace.includes('fetch'));
  h.trace.length = 0; h.b.setActive(true); assert.deepEqual(h.trace, ['suspend:false', 'fetch']); assert.equal(h.s.auth.token, 'rotated');
  h.s.emit('connect'); h.s.emit('connect'); assert.equal(h.trace.filter(x => x === 'fetch').length, 3);
  h.token(null); assert.equal(h.trace.at(-2), 'clear'); assert.equal(h.trace.at(-1), 'suspend:true');
  h.b.dispose(); assert.equal(h.s.count, 0); assert.equal(h.subscribed, false);
  const before = h.s.connects; h.b.setActive(true); assert.equal(h.s.connects, before);
});

test('socket connect before auth rejection never resets the 5xx recovery cap; backoff and background cleanup', async () => {
  const c = clock(), delays = [], originalTimer = c.setTimeout;
  c.setTimeout = (fn, delay) => { delays.push(delay); return originalTimer(fn); };
  const api = load('utils/bookingSync.ts', {}, c); let calls = 0;
  const h = binding({ refreshToken: async () => { calls++; throw new Error('503'); } }, api);
  h.s.emit('connect'); h.s.emit('scheduler_auth_failed'); h.s.emit('connect_error', { data: { code: 'WS_AUTH_FAILED' } });
  assert.equal(calls, 0); assert.equal(c.size, 1);
  for (let i = 0; i < 3; i++) { await c.tick(); h.s.emit('connect'); h.s.emit('scheduler_auth_failed'); }
  assert.equal(calls, 3); assert.deepEqual(delays, [1000, 5000, 30000]); assert.equal(c.size, 0);
  h.s.emit('scheduler_auth_failed'); await c.tick(); assert.equal(calls, 3);
  h.b.setActive(false); h.b.setActive(true); h.s.emit('scheduler_auth_failed'); assert.equal(c.size, 1);
  h.b.setActive(false); assert.equal(c.size, 0); await c.tick(); assert.equal(calls, 3);
  h.b.setActive(true); h.s.emit('scheduler_auth_failed'); h.b.dispose(); assert.equal(c.size, 0);
});

test('auth recovery is singleflight and disposed in-flight refresh cannot reconnect', async () => {
  const c = clock(), api = load('utils/bookingSync.ts', {}, c), d = deferred(); let calls = 0;
  const h = binding({ refreshToken: () => { calls++; return d.promise; } }, api);
  h.s.emit('scheduler_auth_failed'); await c.tick(); h.s.emit('scheduler_auth_failed'); assert.equal(calls, 1);
  h.b.dispose(); const connects = h.s.connects; d.resolve('new'); await settle(); assert.equal(h.s.connects, connects); assert.equal(c.size, 0);
});

function client(fetch) {
  const c = load('api/client.ts', { '../config/api': { API_BASE_URL: 'http://qa/api/v1' } }, { fetch });
  c.setApiAccessToken('old'); c.setApiRefreshToken('refresh'); return c;
}
const response = (status, body = {}) => new Response(JSON.stringify(body), { status });
const session = { accessToken: 'new', refreshToken: 'next', user: { id: 'customer' } };

for (const explicit of [false, true]) test(`401 retry preserves ${explicit ? 'explicit' : 'generated'} idempotency key and original body`, async () => {
  const calls = []; let attempt = 0;
  const c = client(async (url, init) => { if (url.endsWith('/auth/refresh')) return response(200, session); calls.push(init); return response(++attempt === 1 ? 401 : 200, { id: 'created' }); });
  const body = JSON.stringify({ exact: 'body' });
  const result = await c.apiRequest('/bookings', { method: 'POST', body, ...(explicit ? { headers: { 'Idempotency-Key': 'original' } } : {}) });
  assert.equal(result.id, 'created'); assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get('Idempotency-Key'), calls[1].headers.get('Idempotency-Key'));
  if (explicit) assert.equal(calls[1].headers.get('Idempotency-Key'), 'original');
  assert.equal(calls[1].body, body); assert.equal(calls[1].headers.get('Authorization'), 'Bearer new');
});

test('concurrent HTTP and socket refreshes share one flight; late old-token 401 uses rotated token', async () => {
  const d = deferred(), late = deferred(); let refreshes = 0, requests = 0;
  const c = client(async url => { if (url.endsWith('/auth/refresh')) { refreshes++; return d.promise; } if (++requests === 1) return response(401); if (requests === 2) return late.promise; return response(200, { ok: true }); });
  const a = c.apiRequest('/bookings/a'), b = c.apiRequest('/bookings/b'); await settle(); const socketRefresh = c.refreshAccessToken(); assert.equal(refreshes, 1);
  d.resolve(response(200, session)); await a; await socketRefresh; late.resolve(response(401)); await b; assert.equal(refreshes, 1);
});

for (const status of [0, 503]) test(`refresh ${status} retains session and never calls logout`, async () => {
  let logout = 0;
  const c = client(async url => { if (!url.endsWith('/auth/refresh')) return response(401); if (!status) throw new Error('offline'); return response(status); });
  c.setApiUnauthorizedHandler(() => logout++);
  await assert.rejects(c.apiRequest('/bookings'), e => e.status === status);
  assert.equal(logout, 0); assert.equal(c.getApiAccessToken(), 'old');
});

test('definitive refresh rejection clears session once', async () => {
  let logout = 0; const c = client(async () => response(401)); c.setApiUnauthorizedHandler(() => logout++);
  await assert.rejects(c.apiRequest('/bookings')); assert.equal(logout, 1); assert.equal(c.getApiAccessToken(), null);
});

test('old refresh response cannot resurrect logout or replace another account; old finally cannot clear new flight', async () => {
  const old = deferred(), next = deferred(); let calls = 0, persisted = 0;
  const c = client(() => ++calls === 1 ? old.promise : next.promise); c.setApiSessionRefreshHandler(() => persisted++);
  const a = c.refreshAccessToken(); c.setApiAccessToken(null); c.setApiRefreshToken(null);
  c.setApiAccessToken('account-b'); c.setApiRefreshToken('refresh-b'); const b = c.refreshAccessToken();
  old.resolve(response(200, session)); assert.equal(await a, null); assert.equal(c.getApiAccessToken(), 'account-b'); assert.equal(persisted, 0);
  const b2 = c.refreshAccessToken(); assert.equal(calls, 2); next.resolve(response(200, { ...session, accessToken: 'rotated-b' })); await Promise.all([b, b2]); assert.equal(persisted, 1);
});

test('old successful API response is rejected after logout/account replacement, even during body parsing', async () => {
  const d = deferred(); const c = client(async () => ({ ok: true, status: 200, text: () => d.promise }));
  const request = c.apiRequest('/bookings'); await settle(); c.setApiAccessToken('account-b'); d.resolve('{"private":"old"}'); await assert.rejects(request, e => e.status === 401);
});

const timing = load('utils/bookingTiming.ts');
test('planned duration and timestamps are separate from known actual audit points; unavailable legacy data is not invented', () => {
  const base = { durationMinutes: 30, itemStartAt: '2026-10-07T03:00:00Z', itemEndAt: '2026-10-07T03:30:00Z' };
  const lines = timing.serviceTimingLines(base, 'Asia/Ho_Chi_Minh'); assert.equal(lines[0], 'Thời lượng dự kiến: 30 phút'); assert.match(lines[1], /10:00:00/); assert.match(lines.at(-1), /Chưa có/);
  const actual = timing.serviceTimingLines({ ...base, actualTimingSource: 'SERVICE_ADJUSTMENT', actualStartedAt: '2026-10-07T03:10:00Z', actualCompletedAt: null, actualStoppedAt: '2026-10-07T03:20:00Z' }, 'Asia/Ho_Chi_Minh');
  assert.ok(actual.some(x => /Bắt đầu thực tế:.*10:10:00/.test(x))); assert.ok(actual.some(x => /Dừng thực tế:.*10:20:00/.test(x))); assert.ok(!actual.some(x => /Hoàn thành thực tế/.test(x)));
  const unavailable = timing.serviceTimingLines({ ...base, actualTimingSource: 'UNAVAILABLE', actualStartedAt: base.itemStartAt }); assert.ok(!unavailable.some(x => /Bắt đầu thực tế/.test(x)));
});
test('timing uses branch timezone across day boundary; invalid timestamps are unknown and invalid zones use explicit UTC', () => {
  const boundary = timing.formatServiceTimestamp('2026-10-07T18:00:00Z', 'Asia/Ho_Chi_Minh');
  assert.match(boundary, /08\/10\/2026/); assert.match(boundary, /01:00:00/);
  assert.equal(timing.formatServiceTimestamp('bad', 'Asia/Ho_Chi_Minh'), null);
  assert.equal(timing.formatServiceTimestamp('2026-10-07T18:00:00Z', 'bad-zone'), '2026-10-07T18:00:00.000Z (UTC)');
});
test('mapper preserves server clock, branch zone, planned fields, lifecycle status and nullable actual audit points', () => {
  const mapper = load('mappers/booking.ts');
  const raw = { id: 'booking', status: 'CHECKED_IN', appointmentDate: '2026-10-07', appointmentStartTime: '10:00', serverNow: '2026-10-07T03:00:00Z', branch: { id: 'branch', timezone: 'Asia/Ho_Chi_Minh' }, bookingServices: [{ id: 'item', durationMinutes: 30, status: 'IN_PROGRESS', itemStartAt: 'planned', itemEndAt: 'planned-end', actualStartedAt: 'actual', actualCompletedAt: null, actualStoppedAt: null, actualTimingSource: 'SERVICE_ADJUSTMENT' }] };
  const mapped = mapper.mapBooking(raw); assert.equal(mapped.serverNow, raw.serverNow); assert.equal(mapped.branchTimezone, raw.branch.timezone);
  for (const key of ['durationMinutes', 'status', 'itemStartAt', 'itemEndAt', 'actualStartedAt', 'actualCompletedAt', 'actualStoppedAt', 'actualTimingSource']) assert.equal(mapped.bookingServices[0][key], raw.bookingServices[0][key]);
});

function hooks() {
  const slots = []; let index = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({ Provider: 'Provider' }),
    useContext: context => context,
    useState(value) { const i = index++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(value) { const i = index++; return slots[i] ||= { current: value }; },
    useMemo(fn, deps) { const i = index++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = index++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  return { react: { ...React, default: React }, render(fn, props) { index = 0; const tree = fn(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree; }, dispose() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function providerHarness() {
  const c = clock(), hook = hooks(), sockets = [], subscribers = new Set(); let token = 'account-a-token', generation = 1, appListener, rows = [], pending, calls = 0;
  const auth = { user: { id: 'account-a' }, isRestoring: false };
  const clientMock = { getApiAccessToken: () => token, getApiSessionGeneration: () => generation, refreshAccessToken: async () => token, subscribeApiAccessToken(fn) { subscribers.add(fn); return () => subscribers.delete(fn); } };
  const provider = load('context/BookingsContext.tsx', {
    react: hook.react,
    'react-native': { AppState: { currentState: 'active', addEventListener(event, fn) { appListener = fn; return { remove() { appListener = null; } }; } } },
    'socket.io-client': { io(origin, config) { assert.equal(origin, 'http://qa'); assert.equal(config.autoConnect, false); const s = socket(); sockets.push(s); return s; } },
    '../config/api': { API_BASE_URL: 'http://qa/api/v1' }, '../api/client': clientMock,
    '../utils/bookingSync': load('utils/bookingSync.ts', {}, c),
    '../api/bookings': { bookingsApi: { mine: async () => { calls++; if (pending) { const d = pending; pending = null; return d.promise; } return rows; }, create: async () => ({ id: 'local', status: 'PENDING' }) } },
    '../mappers/booking': { mapBooking: x => x }, './AuthContext': { useAuth: () => auth },
  });
  let tree;
  const render = () => { tree = hook.render(provider.BookingsProvider, { children: 'child' }); return tree.props.value; };
  render();
  return { render, c, sockets, get calls() { return calls; }, rows(value) { rows = value; }, pending(value) { pending = value; }, app(state) { appListener?.(state); }, account(id) { generation++; token = id ? `${id}-token` : null; [...subscribers].forEach(fn => fn(token)); auth.user = id ? { id } : null; }, dispose: hook.dispose };
}

test('provider integrates ONE socket: held list and details update via authorized API; duplicates coalesce; background refresh keeps data/loading stable', async () => {
  const h = providerHarness(); h.rows([{ id: 'first', status: 'upcoming' }]); await h.c.tick(); let value = h.render();
  assert.equal(h.sockets.length, 1); assert.equal(value.bookings.length, 1); assert.equal(value.isLoading, false);
  h.rows([{ id: 'web-created', status: 'upcoming' }, { id: 'first', status: 'completed' }]);
  h.sockets[0].emit('booking_created', { id: 'unauthorized-payload', status: 'COMPLETED' }); h.sockets[0].emit('booking_created'); h.sockets[0].emit('booking_updated');
  value = h.render(); assert.equal(value.bookings[0].id, 'first'); assert.equal(value.isLoading, false);
  await h.c.tick(); value = h.render(); assert.equal(h.calls, 2); assert.equal(value.bookings.length, 2); assert.equal(value.getBooking('first').status, 'completed'); assert.equal(value.getBooking('unauthorized-payload'), undefined);
  const d = deferred(); h.pending(d); h.sockets[0].emit('booking_updated'); await h.c.tick(); value = h.render(); assert.equal(value.isLoading, false); assert.equal(value.isRefreshing, true); assert.equal(value.bookings.length, 2);
  d.resolve([{ id: 'first', status: 'cancelled' }]); await settle(); value = h.render(); assert.equal(value.getBooking('first').status, 'cancelled'); assert.equal(value.getBooking('web-created'), undefined); h.dispose(); assert.equal(h.sockets[0].count, 0);
});

test('provider access revocation clears immediately, fences stale API data; account replacement and logout dispose old socket', async () => {
  const h = providerHarness(); h.rows([{ id: 'private-a' }]); await h.c.tick(); h.render();
  const d = deferred(); h.pending(d); h.sockets[0].emit('booking_updated'); await h.c.tick();
  h.sockets[0].emit('scheduler_access_changed'); assert.equal(h.render().bookings.length, 0);
  h.rows([]); d.resolve([{ id: 'stale-a' }]); await settle(); assert.equal(h.render().bookings.length, 0);
  h.account('account-b'); h.rows([{ id: 'private-b' }]); assert.equal(h.render().bookings.length, 0); await h.c.tick(); const value = h.render();
  assert.equal(value.bookings[0].id, 'private-b'); assert.equal(value.getBooking('private-a'), undefined); assert.equal(h.sockets[0].count, 0); assert.equal(h.sockets.length, 2);
  h.account(null); assert.equal(h.render().bookings.length, 0); assert.equal(h.sockets[1].count, 0); h.dispose();
});

test('provider defers fetch/socket in background, refetches foreground and reconnect; same-account new session cannot reuse old data', async () => {
  const h = providerHarness(); h.rows([{ id: 'old' }]); await h.c.tick(); h.render(); const count = h.calls;
  h.app('background'); h.sockets[0].emit('booking_created'); await h.c.tick(); assert.equal(h.calls, count);
  h.rows([{ id: 'missed' }]); h.app('active'); await h.c.tick(); assert.equal(h.render().bookings[0].id, 'missed');
  h.rows([{ id: 'recovered' }]); h.sockets[0].emit('connect'); await h.c.tick(); assert.equal(h.render().bookings[0].id, 'recovered');
  h.account('account-a'); h.rows([]); assert.equal(h.render().bookings.length, 0); await h.c.tick(); assert.equal(h.render().bookings.length, 0); assert.equal(h.sockets.length, 2); h.dispose();
});

test('real detail never displays old route summary when shared booking disappears; known actual points appear when restored', () => {
  const hook = hooks(); let booking; const modules = {
    react: hook.react,
    'react-native': { ...Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'ScrollView', 'Image'].map(x => [x, x])), StyleSheet: { create: x => x }, Alert: { alert() {} }, Linking: { openURL() {} } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/native': { useFocusEffect() {} }, '../constants/colors': { colors: {} }, '../data/catalogModels': { formatCurrency: String }, '../data/appointments': { bookingStatusMeta: () => ({}) },
    '../context/BookingsContext': { useBookings: () => ({ getBooking: () => booking, reload: async () => {}, isLoading: false }) },
    '../components/WriteReviewSheet': { default: 'Review' }, '../api/reviews': { reviewsApi: {} }, '../api/platformSettings': { platformSettingsApi: { publicPolicy: async () => ({}) } }, '../utils/bookingTiming': timing,
  };
  const screen = load('screens/AppointmentDetailScreen.tsx', modules).default;
  const props = { route: { params: { id: 'old', isReal: true, shopName: 'PRIVATE OLD SHOP', title: 'PRIVATE OLD SERVICE', status: 'completed' } }, navigation: { goBack() {} } };
  function texts(tree) { if (typeof tree === 'string') return tree; if (!tree) return ''; if (Array.isArray(tree)) return tree.map(texts).join(' '); return texts(tree.props?.children); }
  assert.doesNotMatch(texts(hook.render(screen, props)), /PRIVATE OLD|VIẾT ĐÁNH GIÁ/);
  booking = { id: 'old', status: 'upcoming', shopName: 'AUTHORIZED SHOP', serviceName: 'AUTHORIZED SERVICE', appointmentStartAt: '2026-10-07T03:00:00Z', branchTimezone: 'Asia/Ho_Chi_Minh', bookingServices: [{ id: 'item', serviceName: 'Service', durationMinutes: 30, actualTimingSource: 'SERVICE_ADJUSTMENT', actualStartedAt: '2026-10-07T03:00:00Z' }] };
  assert.match(texts(hook.render(screen, props)), /Bắt đầu thực tế:.*10:00:00/); booking = undefined;
  assert.doesNotMatch(texts(hook.render(screen, props)), /AUTHORIZED SHOP|PRIVATE OLD/); hook.dispose();
});

test('AuthContext clears user/token synchronously before pending network logout; a late login cannot resurrect it', async () => {
  const hook = hooks(), login = deferred(), logout = deferred(); let token = 'old', cleared = 0;
  const provider = load('context/AuthContext.tsx', {
    react: hook.react,
    '../api/auth': { authApi: { login: () => login.promise } },
    '../api/client': { ApiError: class extends Error {}, getApiAccessToken: () => token, setApiAccessToken: x => { token = x; }, setApiRefreshToken() {}, setApiSessionRefreshHandler() {}, setApiUnauthorizedHandler() {}, apiRequest(path, init) { assert.equal(token, null); assert.equal(init.headers.Authorization, 'Bearer old'); return logout.promise; } },
    '../utils/authStorage': { loadAuthSession: async () => null, saveAuthSession: async () => {}, clearAuthSession: async () => { cleared++; } },
  }).AuthProvider;
  const render = () => hook.render(provider, { children: null }).props.value;
  render(); await settle(); let value = render(); const attempt = value.login('email', 'password'); const exit = value.logout();
  value = render(); assert.equal(value.user, null); assert.equal(token, null); assert.equal(value.isSubmitting, false);
  login.resolve({ user: { id: 'late' }, accessToken: 'late-token' }); await attempt; assert.equal(render().user, null); assert.equal(token, null);
  logout.resolve({ ok: true }); await exit; assert.equal(cleared, 1); hook.dispose();
});
