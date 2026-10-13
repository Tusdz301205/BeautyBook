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
