const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
function load(file, modules) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, setTimeout, clearTimeout, console });
  return module.exports;
}
function harness(owner, profileStatus) {
  const slots = []; let cursor = 0, effects = [], pending;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }),
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  class ApiError extends Error { constructor(status) { super('Test API error'); this.status = status; } }
  const session = load('utils/operationSession.ts', {});
  const user = { id: 'actor', workspace: 'SALON', businessId: 'business-a', roles: [owner ? 'BUSINESS_OWNER' : 'STAFF'], scopes: [{ code: owner ? 'BUSINESS_OWNER' : 'STAFF', businessId: 'business-a', branchId: owner ? null : 'branch-a' }] };
  const calls = [];
  const mod = load('operations/OperationsContext.tsx', {
    react: { ...react, default: react }, 'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'socket.io-client': { io: (origin, options) => { assert.equal(origin, 'http://qa'); assert.equal(options.forceNew, true); assert.equal(options.autoConnect, false); return {}; } }, '../config/api': { API_BASE_URL: 'http://qa/api/v1' },
    '../context/AuthContext': { useAuth: () => ({ user }) }, '../utils/operationSession': session,
    '../api/client': { ApiError, getApiAccessToken: () => 'test-token', subscribeApiAccessToken: () => () => {}, refreshAccessToken: async () => 'test-token',
      apiRequest: async endpoint => { calls.push(endpoint); if (endpoint === '/staff/me') throw new ApiError(profileStatus); return [{ id: 'branch-a', name: 'A', businessId: 'business-a' }]; } },
    '../utils/bookingSync': { schedulerOrigin: () => 'http://qa', bindBookingSocket: () => ({ setActive() {}, dispose() {} }),
      createInvalidationQueue: options => ({ invalidate() { pending = Promise.resolve().then(options.fetch).then(options.commit, options.fail); return pending; }, suspend() {}, dispose() {} }) },
  });
  const render = () => { cursor = 0; const tree = mod.OperationsProvider({ children: null }); const next = effects; effects = []; next.forEach(fn => fn()); return tree.props.value; };
  return { render, settle: () => pending, calls };
}
test('Owner branch context remains usable when optional Staff profile belongs to another business', async () => {
  const h = harness(true, 403); h.render(); await h.settle(); const result = h.render();
  assert.equal(result.error, null); assert.equal(result.loading, false); assert.equal(result.branches.length, 1);
  assert.equal(result.mode, 'OWNER'); assert.equal(result.staffProfile, null); assert.equal(result.canWorkAsStaff, false);
  assert.deepEqual(h.calls, ['/branches/accessible', '/staff/me']);
});
test('Staff profile forbidden remains a blocking context error and never inherits Owner authority', async () => {
  const h = harness(false, 403); h.render(); await h.settle(); const result = h.render();
  assert.ok(result.error); assert.equal(result.branches.length, 0); assert.equal(result.canWorkAsStaff, false);
});
