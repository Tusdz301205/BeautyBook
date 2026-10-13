import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function harness(initial) {
  let state = { ...initial }, tree, subscriptions = [];
  const store = selector => { const value = selector(state); subscriptions.push({ selector, value }); return value; };
  store.getState = () => ({ ...state, isAuthenticated: () => !!state.accessToken });
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { lazy: () => () => null, Suspense: 'Suspense', useEffect() {}, useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-router-dom': { BrowserRouter: 'BrowserRouter', Routes: 'Routes', Route: 'Route', Navigate: 'Navigate', Outlet: 'Outlet', useLocation: () => ({ pathname: '/' }) },
    'react-hot-toast': { Toaster: 'Toaster' }, './store/authStore': { useAuthStore: store },
    './api/apiClient': { businessApi: {} }, './config/featureAvailability': { FINANCE_WORKSPACE_ENABLED: false },
    './components/UnavailableFeature': { default: 'UnavailableFeature' }, './utils/authScope': { CUSTOMER_ACCOUNT_REQUIRED: 'customer', isCustomerAccount: () => true },
    './config/homeMedia': { getHomeMedia() {} }, './utils/seo': { applySeo() {}, getSiteUrl() {} },
    './components/layout/PlatformShell': { PlatformShell: 'PlatformShell' }, './components/layout/SalonShell': { SalonShell: 'SalonShell' }, './components/layout/CustomerShell': { CustomerShell: 'CustomerShell' },
  };
  const module = { exports: {} };
  const source = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; } });
  const render = () => { subscriptions = []; tree = module.exports.default(); };
  render();
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
  return {
    root: () => nodes(tree).find(node => node.type === 'Route' && node.props.path === '/').props.element,
    update(patch) {
      state = { ...state, ...patch };
      if (subscriptions.some(({ selector, value }) => !Object.is(selector(state), value))) render();
    },
  };
}

test('root follows login and logout in the same mounted app', () => {
  const h = harness({ accessToken: null, user: null });
  assert.notEqual(h.root().type, 'Navigate');
  h.update({ accessToken: 'qa-memory-token', user: { sessionType: 'customer' } });
  assert.equal(h.root().props.to, '/customer/appointments');
  h.update({ accessToken: null, user: null });
  assert.notEqual(h.root().type, 'Navigate');
});

for (const [sessionType, home] of [['customer', '/customer/appointments'], ['salon', '/salon'], ['admin', '/admin']]) {
  test(`authenticated ${sessionType} cold root returns public home after logout without document reload`, () => {
    const h = harness({ accessToken: 'qa-memory-token', user: { sessionType } });
    assert.equal(h.root().props.to, home);
    h.update({ accessToken: null, user: null });
    assert.notEqual(h.root().type, 'Navigate');
  });
}

test('root changes with workspace and token loss, without borrowing the previous session', () => {
  const h = harness({ accessToken: 'qa-memory-token', user: { sessionType: 'customer' } });
  h.update({ user: { sessionType: 'salon' } });
  assert.equal(h.root().props.to, '/salon');
  h.update({ user: { sessionType: 'admin' } });
  assert.equal(h.root().props.to, '/admin');
  h.update({ accessToken: null });
  assert.notEqual(h.root().type, 'Navigate');
});
