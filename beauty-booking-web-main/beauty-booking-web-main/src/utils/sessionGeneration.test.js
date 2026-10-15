import { normalizeSchedulerResponse } from './bookingCalendar.adapter.js';
import { operationalListRows } from './operationalListRows.js';
import { unfinishedBooking } from './bookingAffordances.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import * as scope from './authScope.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const session = id => ({ accessToken: `test-only-${id}`, user: { id, sessionType: 'customer',
  roles: ['CUSTOMER'], scopes: [{ code: 'CUSTOMER' }], permissions: [] } });
const response = (status, body) => ({ status, ok: status < 400,
  json: async () => body, text: async () => JSON.stringify(body) });
const observe = promise => promise.then(value => ({ value }), error => ({ error }));

// Execute the real API/store source with only transport, persistence and state
// infrastructure replaced. No server, browser, disk session or credentials.
function harness({ locks = false, initialized = true } = {}) {
  const calls = [], queued = [], resets = [];
  let store, key = 0;
  const strip = source => source.replace(/^import .*;\r?\n/gm, '').replace(/export (?=(const|function|async function))/g, '');
  const context = { ...scope, URLSearchParams, crypto: { randomUUID: () => `key-${++key}` },
    sanitizeApiErrorMessage: (_, message) => message,
    useBookingStore: { getState: () => ({ reset: () => resets.push('reset') }) },
    persist: creator => creator,
    create: creator => {
      let state;
      const set = values => { state = { ...state, ...values }; };
      const get = () => state;
      state = creator(set, get);
      store = { getState: get, setState: set };
      return store;
    },
    fetch: (url, config) => new Promise((resolve, reject) => calls.push({
      path: new URL(url).pathname.replace('/api/v1', ''), config, resolve, reject,
    })),
  };
  if (locks) context.navigator = { locks: { request: (_, callback) => new Promise((resolve, reject) => {
    queued.push(() => Promise.resolve().then(callback).then(resolve, reject));
  }) } };
  vm.createContext(context);
  const helper = new URL('./sessionGeneration.js', import.meta.url);
  if (existsSync(helper)) vm.runInContext(strip(readFileSync(helper, 'utf8')), context);
  const api = readFileSync(new URL('../api/apiClient.js', import.meta.url), 'utf8').split('// ======================== BOOKINGS')[0];
  vm.runInContext(strip(api).replace("import.meta.env.VITE_API_BASE || 'http://localhost:3000/api/v1'", "'https://mock.invalid/api/v1'")
    + ';this.authApi=authApi;this.request=request;this.refreshSession=refreshSession;', context);
  vm.runInContext(strip(readFileSync(new URL('../store/authStore.js', import.meta.url), 'utf8')), context);
  store.setState({ ...scope.sessionState(session('A')), initialized });
  return { calls, queued, resets, store, api: context, switch: id => store.getState().setSession(session(id)),
    reply: (index, status, body) => calls[index].resolve(response(status, body)) };
}

test('late old-account 401 after a new session starts no refresh and cannot clear it', async () => {
  const h = harness(); const request = observe(h.api.request('/notifications'));
  h.switch('B'); h.reply(0, 401, { message: 'expired' }); await settle();
  for (const call of h.calls.slice(1)) call.reject(Error('denied'));
  await request; assert.equal(h.calls.length, 1); assert.equal(h.store.getState().user?.id, 'B');
});

test('old refresh failure cannot clear a new account', async () => {
  const h = harness(); const request = observe(h.api.request('/notifications'));
  h.reply(0, 401, {}); await settle(); h.switch('B'); const resets = h.resets.length;
  h.calls[1].reject(Error('denied')); await request;
  assert.equal(h.store.getState().user?.id, 'B'); assert.equal(h.resets.length, resets);
});

test('old refresh success after clear cannot restore a session or retry', async () => {
  const h = harness(); const request = observe(h.api.request('/notifications'));
  h.reply(0, 401, {}); await settle(); h.store.getState().clearSession(); h.reply(1, 200, session('A')); await settle();
  for (const call of h.calls.slice(2)) call.resolve(response(200, []));
  await request; assert.equal(h.store.getState().user, null); assert.equal(h.calls.length, 2);
});

test('new-account refresh does not join old-account refresh and old finalizer cannot clear its lease', async () => {
  const h = harness(); const a = observe(h.api.refreshSession()); h.switch('B');
  const b = observe(h.api.refreshSession()); assert.equal(h.calls.length, 2);
  h.reply(0, 200, session('A')); await a;
  const anotherB = observe(h.api.refreshSession()); assert.equal(h.calls.length, 2);
  h.reply(1, 200, session('B')); const results = await Promise.all([b, anotherB]);
  assert.ok(results.every(result => result.value?.user.id === 'B'));
});

test('queued Web Lock checks the session again before sending refresh transport', async () => {
  const h = harness({ locks: true }); const refresh = observe(h.api.refreshSession());
  h.switch('B'); const released = h.queued[0](); await settle();
  h.calls.forEach(call => call.resolve(response(200, session('A')))); await released; await refresh;
  assert.equal(h.calls.length, 0);
});

test('late initialize success and failure cannot overwrite a newer login', async () => {
  for (const fail of [false, true]) {
    const h = harness({ initialized: false }); const init = observe(h.store.getState().initialize());
    const login = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
    h.reply(1, 200, session('B')); await login;
    if (fail) h.calls[0].reject(Error('denied')); else h.reply(0, 200, session('A'));
    await init; assert.equal(h.store.getState().user?.id, 'B');
  }
});

test('pending logout clears locally and late completion cannot clear a newer login', async () => {
  const h = harness(); const logout = observe(h.store.getState().logout());
  assert.equal(h.store.getState().user, null);
  const login = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  h.reply(1, 200, session('B')); await login; h.reply(0, 200, {}); const result = await logout;
  assert.equal(result.error, undefined);
  assert.equal(result.value, false);
  assert.equal(h.store.getState().user?.id, 'B');
});

test('logout retains transport failure when no newer session superseded it', async () => {
  const h = harness(); const logout = observe(h.store.getState().logout());
  h.calls[0].reject(new Error('logout transport failed'));
  const result = await logout;
  assert.equal(result.error?.message, 'logout transport failed');
  assert.equal(h.store.getState().user, null);
});

test('two current-session 401s share one refresh and preserve each POST retry key and scopes', async () => {
  const h = harness(); const a = observe(h.api.request('/first', { method: 'POST', businessId: 'tenant', branchId: 'branch' }));
  const b = observe(h.api.request('/second', { method: 'POST', headers: { 'Idempotency-Key': 'supplied-key' } }));
  h.reply(0, 401, {}); h.reply(1, 401, {}); await settle(); assert.equal(h.calls.length, 3);
  h.reply(2, 200, session('A')); await settle(); assert.equal(h.calls.length, 5);
  for (const index of [3, 4]) {
    const original = h.calls.find(call => call.path === h.calls[index].path);
    assert.equal(h.calls[index].config.headers['Idempotency-Key'], original.config.headers['Idempotency-Key']);
    assert.equal(h.calls[index].config.credentials, 'include'); h.reply(index, 200, { ok: true });
  }
  assert.equal(h.calls[3].config.headers['X-Business-Id'], 'tenant');
  assert.equal(h.calls[3].config.headers['X-Branch-Id'], 'branch');
  assert.ok((await Promise.all([a, b])).every(result => result.value?.ok));
});

test('same-account re-login invalidates old refresh even when identity and token fixtures match', async () => {
  const h = harness(); const refresh = observe(h.api.refreshSession());
  const login = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  h.reply(1, 200, session('A')); await login; h.reply(0, 200, session('A')); const result = await refresh;
  assert.ok(result.error); assert.equal(h.store.getState().user.id, 'A');
});

test('failed newer login preserves the prior valid account but fences older refresh work', async () => {
  const h = harness(); const refresh = observe(h.api.refreshSession());
  const login = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  h.reply(1, 400, { message: 'invalid credentials' }); await login;
  h.reply(0, 200, session('A')); const result = await refresh;
  assert.ok(result.error); assert.equal(h.store.getState().user.id, 'A');
});

test('registration returns the valid user and a superseded registration cannot replace a newer login', async () => {
  const h = harness(); const registration = observe(h.store.getState().register({ email: 'fixture@example.test' }));
  const login = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  h.reply(1, 200, session('B')); await login; h.reply(0, 200, session('A')); const old = await registration;
  assert.ok(old.error); assert.equal(h.store.getState().user.id, 'B');
  const next = observe(h.store.getState().register({ email: 'fixture@example.test' })); h.reply(2, 200, session('C'));
  assert.equal((await next).value.id, 'C');
});

test('initialization deduplicates StrictMode calls and keeps a valid refreshed session', async () => {
  const h = harness({ initialized: false }); const first = h.store.getState().initialize();
  const second = h.store.getState().initialize(); assert.equal(h.calls.length, 1);
  h.reply(0, 200, session('A')); await Promise.all([first, second]);
  assert.equal(h.store.getState().initialized, true); assert.equal(h.store.getState().user.id, 'A');
});

test('logout fences a pending refresh before its logout transport completes', async () => {
  const h = harness(); const refresh = observe(h.api.refreshSession());
  const logout = observe(h.store.getState().logout()); h.reply(0, 200, session('A'));
  assert.ok((await refresh).error); assert.equal(h.store.getState().user, null);
  h.reply(1, 200, {}); await logout; assert.equal(h.store.getState().user, null);
});

test('current-session rejected refresh clears only that session and never retries', async () => {
  const h = harness(); const request = observe(h.api.request('/notifications'));
  h.reply(0, 401, {}); await settle(); h.reply(1, 401, {});
  assert.equal((await request).error.status, 401);
  assert.equal(h.store.getState().user, null); assert.equal(h.calls.length, 2);
});

test('credential and logout 401s never invoke automatic refresh', async () => {
  for (const path of ['/auth/login', '/auth/register', '/auth/logout']) {
    const h = harness(); const request = observe(h.api.request(path, { method: 'POST' }));
    h.reply(0, 401, {}); await settle();
    h.calls.slice(1).forEach(call => call.reject(Error('unexpected refresh'))); await request;
    assert.equal(h.calls.length, 1); assert.equal(h.store.getState().user.id, 'A');
  }
});

test('refresh result for another identity cannot authorize retry', async () => {
  const h = harness(); const request = observe(h.api.request('/notifications'));
  h.reply(0, 401, {}); await settle(); h.reply(1, 200, session('B')); await settle();
  h.calls.slice(2).forEach(call => call.resolve(response(200, []))); await request;
  assert.equal(h.store.getState().user, null); assert.equal(h.calls.length, 2);
});

test('successful newer login fences requests started during the previous pending login', async () => {
  const h = harness(); const first = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  const oldRequest = observe(h.api.request('/notifications'));
  const newer = observe(h.store.getState().login('fixture@example.test', 'fixture-only'));
  h.reply(2, 200, session('B')); await newer; h.reply(0, 200, session('A')); h.reply(1, 200, []);
  assert.ok((await first).error); assert.ok((await oldRequest).error); assert.equal(h.store.getState().user.id, 'B');
});

test('same-owner setSession context changes invalidate outstanding reads', async () => {
  const identity = { workspace: 'SALON', businessId: 'business-A', branchId: 'branch-A', sessionId: 'session-A' };
  const ownerSession = changes => ({ ...session('owner'), user: { ...session('owner').user,
    sessionType: 'salon', roles: ['BUSINESS_OWNER'], scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business-A' }],
    ...identity, ...changes } });
  for (const changes of [{ businessId: 'business-B' }, { branchId: 'branch-B' },
    { workspace: 'OTHER' }, { sessionId: 'session-B' }]) {
    const h = harness(); h.store.getState().setSession(ownerSession());
    const request = observe(h.api.request('/notifications'));
    h.store.getState().setSession(ownerSession(changes)); h.reply(0, 200, []);
    assert.equal((await request).error?.code, 'STALE_SESSION');
  }
});

test('refresh rejects same-owner foreign session/context while identical context keeps concurrent retries valid', async () => {
  const ownerSession = changes => ({ ...session('owner'), user: { ...session('owner').user,
    sessionType: 'salon', workspace: 'SALON', roles: ['BUSINESS_OWNER'],
    scopes: [{ code: 'BUSINESS_OWNER', businessId: 'business-A' }],
    businessId: 'business-A', branchId: 'branch-A', sessionId: 'session-A', ...changes } });
  for (const changes of [{ businessId: 'business-B' }, { branchId: 'branch-B' },
    { workspace: 'OTHER' }, { sessionId: 'session-B' }, { sessionId: undefined }]) {
    const h = harness(); h.store.getState().setSession(ownerSession());
    const refresh = observe(h.api.refreshSession()); h.reply(0, 200, ownerSession(changes));
    assert.ok((await refresh).error);
    assert.equal(h.store.getState().user.businessId, 'business-A');
    assert.equal(h.store.getState().user.sessionId, 'session-A');
  }
  const h = harness(); h.store.getState().setSession(ownerSession());
  const a = observe(h.api.request('/first')); const b = observe(h.api.request('/second'));
  h.reply(0, 401, {}); h.reply(1, 401, {}); await settle(); assert.equal(h.calls.length, 3);
  h.reply(2, 200, ownerSession()); await settle(); assert.equal(h.calls.length, 5);
  h.reply(3, 200, []); h.reply(4, 200, []);
  assert.ok((await Promise.all([a, b])).every(result => !result.error));
});

function schedulerRecovery(file) {
  const source = readFileSync(new URL(`../components/admin/scheduler/${file}`, import.meta.url), 'utf8');
  const callback = source.indexOf('    const authorizationChanged = async');
  const start = source.lastIndexOf('  useEffect(() => {', callback);
  const end = source.indexOf('\n  }, [', callback);
  const effect = source.slice(start, source.indexOf(']);', end) + 3);
  let recover, cleanup;
  const calls = [], transport = [];
  const context = { accessToken: 'fixture', branchKey: 'branch', fetchData() {}, load() {},
    authorizationEpoch: { current: 0 }, requestSequence: { current: 0 }, schedulerSocketUrl: () => '/mock',
    useEffect: callback => { cleanup = callback(); },
    io: () => ({ disconnect() {} }),
    bindSchedulerSocketEvents: (_, handlers) => { recover = handlers.authorizationChanged; return () => {}; },
    refreshSession: lease => new Promise((resolve, reject) => transport.push({ lease, resolve, reject })),
    useAuthStore: { getState: () => ({ accessToken: 'fixture',
      setSession: (_, lease) => { calls.push(['setSession', lease]); return { id: 'A' }; },
      clearSession: lease => calls.push(['clearSession', lease]),
    }) },
  };
  for (const name of ['setBookings', 'setStaffList', 'setSelectedBooking', 'setSelectedDay', 'setLoading', 'setSelected', 'setError']) {
    context[name] = () => calls.push([name]);
  }
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('./sessionGeneration.js', import.meta.url), 'utf8').replace(/export /g, ''), context);
  vm.runInContext(effect, context);
  return { calls, transport, recover: () => recover(), unmount: () => cleanup(),
    transition: () => vm.runInContext('advanceSessionGeneration()', context) };
}

for (const file of ['SchedulerView.jsx', 'SchedulerListView.jsx']) {
  test(`${file} actual recovery fences both outcomes after login/logout/context change and branch unmount`, async () => {
    for (const mode of ['login', 'logout', 'context', 'unmount']) {
      for (const failure of [false, true]) {
        const h = schedulerRecovery(file); const recovery = h.recover(); const count = h.calls.length;
        if (mode === 'unmount') h.unmount(); else h.transition();
        if (failure) h.transport[0].reject(Error('stale refresh')); else h.transport[0].resolve(session('A'));
        await recovery; assert.equal(h.calls.length, count, `${mode}: ${failure ? 'failure' : 'success'}`);
      }
    }
  });
  test(`${file} actual current recovery passes its lease to refresh, setSession and clearSession`, async () => {
    for (const failure of [false, true]) {
      const h = schedulerRecovery(file); const recovery = h.recover();
      if (failure) h.transport[0].reject(Error('expired')); else h.transport[0].resolve(session('A'));
      await recovery; const method = failure ? 'clearSession' : 'setSession';
      assert.equal(h.transport[0].lease, 0);
      assert.equal(h.calls.find(call => call[0] === method)?.[1], 0);
    }
  });
}


function scheduleBoundaryScheduler(file) {
  const source = readFileSync(new URL(`../components/admin/scheduler/${file}`, import.meta.url), 'utf8');
  const calendar = file === 'SchedulerView.jsx', name = calendar ? 'fetchData' : 'load';
  const start = source.indexOf(`  const ${name} = useCallback`), end = source.indexOf('\n  useEffect', start);
  let generation = 0, cleanup, state = { accessToken: 'A', user: { id: 'A' } }, rows = [];
  const reads = [], errors = [], timers = new Map();
  const store = selector => selector(state); store.getState = () => state;
  const defer = (kind, args) => new Promise((resolve, reject) => reads.push({ kind, args, resolve, reject }));
  const context = { accessToken: 'A', branchKey: 'branch-a', branchId: 'branch-a', branchNames: new Map(), refreshKey: 0,
    range: { start: new Date('2026-10-13T00:00:00Z'), end: new Date('2026-10-13T23:59:59Z') }, filters: { status: 'unfinished' }, pagination: { page: 1 },
    requestSequence: { current: 0 }, useCallback: fn => fn, useMemo: fn => fn(),
    captureSessionGeneration: () => generation, isSessionGenerationCurrent: lease => lease === generation, useAuthStore: store,
    bookingsApi: { getScheduler: (...args) => defer('calendar', args), getSchedulerBatch: (...args) => defer('batch', args), getAll: (...args) => defer('list', args), getById: () => { throw Error('Unexpected detail read'); } },
    normalizeSchedulerResponse, operationalListRows, toUserFacingRequestError: error => error.message,
    setBookings: value => { rows = value; }, setStaffList() {}, setSelectedBooking() {}, setSelectedDay() {}, setSelected() {}, setPagination() {}, setLoading() {}, setError: error => { if (error) errors.push(error); },
    useEffect: fn => { cleanup?.(); cleanup = fn(); }, setTimeout: (fn, delay) => { timers.set(fn, delay); return fn; }, clearTimeout: fn => timers.delete(fn),
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + `;this.read=${name};`, context);
  const rootHook = readFileSync(new URL('../hooks/useScheduleHistoryRefresh.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
  vm.runInContext(rootHook + ';this.arm=useScheduleHistoryRefresh;', context);
  const response = (row, serverNow = '2026-10-13T03:00:00Z') => calendar ? { bookings: [row], staff: [], serverNow } : { data: [row], serverNow, meta: { page: 1, total: 1 } };
  const arm = () => {
    context.bookings = rows;
    if (calendar) {
      const wiring = source.slice(source.indexOf('  const refreshVisible ='), source.indexOf('  const serviceOptions ='));
      vm.runInContext(wiring.replace('  useOperationalRefresh(refreshVisible);', ''), context);
    } else {
      const wiring = source.slice(source.indexOf('  const scheduleRows ='), source.indexOf('  useEffect', source.indexOf('  const scheduleRows =')));
      vm.runInContext(wiring, context);
    }
  };
  return { reads, errors, timers, response, arm, read: context.read, rows: () => rows,
    switchScope: () => { generation++; state = { accessToken: 'B', user: { id: 'B' } }; },
    unmount: () => { cleanup?.(); context.requestSequence.current++; } };
}

const boundaryRow = { id: 'arrival', bookingId: 'arrival', branchId: 'branch-a', statusEnum: 'CHECKED_IN', status: 'Khách đã đến',
  appointmentDate: '2026-10-13', appointmentStartTime: '03:00:00', appointmentEndTime: '03:01:00', scheduledEndAt: '2026-10-13T03:00:01Z',
  scheduleBucket: 'UPCOMING', scheduleElapsed: false, services: [{ id: 'service', status: 'SCHEDULED', itemStartAt: '2026-10-13T03:00:00Z', itemEndAt: '2026-10-13T03:00:01Z' }] };

for (const file of ['SchedulerView.jsx', 'SchedulerListView.jsx']) {
  test(`${file} actual GET and root boundary hook refresh unfinished attendance without a socket event`, async () => {
    const h = scheduleBoundaryScheduler(file), read = h.read();
    h.reads[0].resolve(h.response(boundaryRow)); await read; h.arm();
    assert.equal(h.timers.size, 1); assert.equal([...h.timers.values()][0], 1001);
    const before = h.rows()[0];
    assert.equal(unfinishedBooking(before), true);
    const boundary = [...h.timers.keys()][0]();
    assert.equal(h.reads.length, 2);
    h.reads[1].resolve(h.response({ ...boundaryRow, scheduleElapsed: true, scheduleBucket: 'HISTORY' }, '2026-10-13T03:00:01.001Z'));
    await boundary; await settle();
    assert.equal(unfinishedBooking(h.rows()[0]), false);
    assert.equal(h.rows()[0].statusEnum || h.rows()[0].status, 'CHECKED_IN');
    assert.equal(h.rows()[0].services[0].actualCompletedAt ?? null, null);
    assert.deepEqual(h.errors, []);
    if (file === 'SchedulerListView.jsx') assert.equal(h.reads[1].args[0].branchId, 'branch-a');
    else assert.equal(h.reads[1].args[0], 'branch-a');
    h.unmount(); assert.equal(h.timers.size, 0);
  });
  test(`${file} boundary timer and late GET responses are fenced on account change and unmount`, async () => {
    for (const mode of ['account', 'unmount']) for (const failure of [false, true]) {
      const h = scheduleBoundaryScheduler(file), initial = h.read();
      h.reads[0].resolve(h.response(boundaryRow)); await initial; h.arm();
      const timer = [...h.timers.keys()][0], pending = h.read();
      if (mode === 'account') { h.switchScope(); timer(); } else { h.unmount(); assert.equal(h.timers.size, 0); }
      assert.equal(h.reads.length, 2);
      if (failure) h.reads[1].reject(Error('stale read')); else h.reads[1].resolve(h.response({ ...boundaryRow, id: 'foreign' }));
      await pending; assert.equal(h.rows()[0].id, 'arrival'); assert.deepEqual(h.errors, []);
    }
  });
  test(`${file} newer scheduler GET wins when reads resolve in reverse order`, async () => {
    const h = scheduleBoundaryScheduler(file), older = h.read(), newer = h.read();
    h.reads[1].resolve(h.response({ ...boundaryRow, id: 'new', bookingId: 'new' })); await newer;
    h.reads[0].resolve(h.response(boundaryRow)); await older;
    assert.equal(h.rows()[0].id, 'new');
  });
}
