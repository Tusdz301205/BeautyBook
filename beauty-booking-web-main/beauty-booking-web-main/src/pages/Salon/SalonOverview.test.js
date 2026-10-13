import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as dates from 'date-fns';
import { FINANCE_WORKSPACE_ENABLED } from '../../config/featureAvailability.js';
import { normalizeBooking } from '../../utils/bookingCalendar.adapter.js';

const source = readFileSync(new URL('./SalonOverview.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
const owner = (businessId = 'business-a', permissions = ['branch:update:tenant']) => ({
  id: 'owner', sessionType: 'salon', businessId, roles: ['BUSINESS_OWNER'],
  scopes: [{ code: 'BUSINESS_OWNER', businessId }], permissions,
});
const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes)
  : [value, ...nodes(value.props?.children), ...nodes(value.props?.action)];

// Execute the actual JSX, with React hook dependency/cleanup semantics and
// deferred APIs. No browser, server, database, or fixtures are involved.
function harness(initialUser = owner(), finance = FINANCE_WORKSPACE_ENABLED, now = null) {
  const cells = [], calls = [], effects = []; let cursor = 0, dirty = false, generation = 0, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [cells[i].value, update => {
        const value = typeof update === 'function' ? update(cells[i].value) : update;
        if (!Object.is(value, cells[i].value)) { cells[i].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { deps, value: fn() }; return cells[i].value; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(cells[i]?.deps, deps)) {
        effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const session = { user: initialUser, accessToken: 'token-a', can: code => session.user?.permissions?.includes(code) || false };
  const useAuthStore = selector => selector(session);
  useAuthStore.getState = () => session;
  const defer = name => (...args) => new Promise((resolve, reject) => calls.push({ name, args, resolve, reject }));
  const api = {
    branchesApi: { getAccessible: defer('branches') }, bookingsApi: { getAll: defer('bookings') },
    servicesApi: { getManage: defer('services') }, staffApi: { getAll: defer('staff') },
    reviewsApi: { getForManagement: defer('reviews') }, paymentsApi: { getAll: defer('payments') },
    reportsApi: { getOverview: defer('overview'), getOwnerDashboard: defer('dashboard') },
  };
  const jsx = (type, props) => ({ type, props });
  const names = new Proxy({}, { get: (_, name) => name });
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'date-fns': dates,
    'lucide-react': names, recharts: names, 'react-router-dom': { Link: 'Link' },
    '../../api/apiClient': api, '../../components/ui': names, '../../store/authStore': { useAuthStore },
    '../../utils/bookingCalendar.adapter': { normalizeBooking },
    '../../config/featureAvailability': { FINANCE_WORKSPACE_ENABLED: finance },
    '../../utils/sessionGeneration': { captureSessionGeneration: () => generation, isSessionGenerationCurrent: lease => lease === generation },
  };
  const module = { exports: {} };
  const ClockDate = now === null ? Date : class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, Date: ClockDate, require: name => {
    assert.ok(name in modules, `Unexpected import ${name}`); return modules[name];
  } });
  const render = (flushEffects = true) => {
    let passes = 0;
    do {
      assert.ok(++passes < 30, 'No uncontrolled render/fetch loop');
      dirty = false; cursor = 0; tree = module.exports.SalonOverview();
      if (flushEffects) while (effects.length) effects.shift()();
    } while (dirty && flushEffects);
    return nodes(tree);
  };
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); return render(); };
  const complete = (requests, overrides = {}) => requests.forEach(call => {
    let result = typeof overrides === 'function' ? overrides(call) : overrides[call.name] ?? [];
    if (call.name === 'bookings' && Array.isArray(result)) {
      const { page = 1, limit = 50 } = call.args[0];
      result = { data: result.slice(0, limit), meta: { total: result.length, page, limit, totalPages: Math.ceil(result.length / limit) } };
    }
    if (result instanceof Error) call.reject(result); else call.resolve(result);
  });
  return { render, settle, calls, session, complete, advance: () => ++generation,
    unmount: () => cells.forEach(cell => cell.cleanup?.()) };
}
const find = (h, type) => h.render().find(node => node.type === type);
const metric = (h, label) => h.render().find(node => node.type === 'MetricCard' && node.props.label === label)?.props.value;
const appointmentLinks = h => h.render().filter(node => node.type === 'Link' && node.props.to?.includes('?bookingId='));
const pendingAction = h => h.render().find(node => node.type === 'Link' && node.props.to === '/salon/appointments' && nodes(node).some(child => child.props?.children === 'Lịch cần xác nhận'));
const actionCount = h => nodes(pendingAction(h)).find(node => node.type === 'p' && node.props.className?.includes('tabular-nums'))?.props.children;
const noDashboard = h => {
  const view = h.render();
  assert.ok(!view.some(node => ['Select', 'MetricCard'].includes(node.type)));
  assert.ok(!view.some(node => node.type === 'Link' && node.props.to === '/salon/appointments'));
  assert.ok(!view.some(node => node.type === 'EmptyState' && node.props.description?.includes('Lịch vẫn sẵn sàng')));
};

test('branch loading and confirmed zero branches gate dashboard/calendar and offer permitted setup', async () => {
  const h = harness(); h.render(); noDashboard(h);
  assert.deepEqual(h.calls.map(call => call.name), ['branches']);
  h.calls[0].resolve({ data: [] }); await h.settle(); noDashboard(h);
  assert.equal(find(h, 'EmptyState').props.title, 'Chưa có chi nhánh');
  assert.equal(find(h, 'Link').props.to, '/salon/profile');
  assert.equal(h.calls.length, 1);
});

test('branch failure is actionable error, retry waits then loads a concrete branch exactly once', async () => {
  const h = harness(); h.render(); h.calls[0].reject(new Error('Controlled network failure')); await h.settle();
  noDashboard(h); assert.equal(find(h, 'EmptyState'), undefined);
  assert.equal(find(h, 'ErrorState').props.message, 'Controlled network failure');
  void find(h, 'ErrorState').props.onRetry(); h.render(); noDashboard(h);
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve([{ id: 'branch-a', name: 'Branch A' }]); await h.settle();
  const dashboard = h.calls.slice(2);
  assert.deepEqual(dashboard.map(call => call.name), ['bookings', 'bookings', 'bookings', 'bookings', 'bookings', 'services', 'staff']);
  assert.equal(dashboard[0].args[0].branchId, 'branch-a');
  assert.equal(dashboard[5].args[0], 'branch-a');
  h.complete(dashboard); await h.settle();
  assert.equal(metric(h, 'Lịch trong kỳ'), 0);
  assert.ok(find(h, 'EmptyState').props.description.includes('Lịch vẫn sẵn sàng'));
  h.render(); assert.equal(h.calls.length, 9);
});

test('malformed successful branch response is error, not confirmed empty', async () => {
  const h = harness(); h.render(); h.calls[0].resolve({ unexpected: [] }); await h.settle();
  assert.ok(find(h, 'ErrorState')); assert.equal(find(h, 'EmptyState'), undefined); noDashboard(h);
});

test('setup respects profile route permission and branch staff get assignment guidance', async () => {
  for (const user of [owner('business-a', []), { id: 'staff', roles: ['STAFF'], scopes: [], permissions: [] }]) {
    const h = harness(user); h.render(); h.calls[0].resolve([]); await h.settle();
    assert.equal(find(h, 'Link'), undefined); noDashboard(h);
    if (user.id === 'staff') assert.equal(find(h, 'EmptyState').props.title, 'Chưa có chi nhánh được phân công');
  }
});

test('late branch success/failure is fenced across same-owner business changes, even before render', async () => {
  for (const stale of [[{ id: 'old-branch' }], new Error('stale branch failure')]) {
    const h = harness(); h.render();
    h.session.user = owner('business-b');
    h.complete([h.calls[0]], { branches: stale }); await h.settle();
    noDashboard(h); assert.equal(h.calls.length, 2);
    h.calls[1].resolve([]); await h.settle();
    assert.equal(find(h, 'EmptyState').props.title, 'Chưa có chi nhánh');
    assert.equal(find(h, 'ErrorState'), undefined); assert.equal(h.calls.length, 2);
  }
});

test('dashboard success/failure from old auth context cannot overwrite new confirmed setup state', async () => {
  for (const stale of [[{ id: 'old-booking', status: 'PENDING' }], new Error('stale dashboard failure')]) {
    const h = harness(); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
    const old = h.calls.slice(1);
    h.session.user = owner('business-b'); h.session.accessToken = 'token-b'; h.advance();
    noDashboard(h);
    assert.equal(h.calls.at(-1).name, 'branches');
    h.calls.at(-1).resolve([]); await h.settle();
    h.complete(old, { bookings: stale, services: stale, staff: stale }); await h.settle();
    noDashboard(h); assert.equal(find(h, 'ErrorState'), undefined);
    assert.equal(find(h, 'EmptyState').props.title, 'Chưa có chi nhánh');
    assert.equal(h.calls.length, 9);
  }
});

test('date and selected branch changes clear visible data and fence out-of-order dashboard results', async () => {
  const h = harness(); h.render(); h.calls[0].resolve([{ id: 'branch-a' }, { id: 'branch-b' }]); await h.settle();
  const first = h.calls.slice(1); assert.equal(first[0].args[0].branchId, undefined);
  h.complete(first, { bookings: [{ id: 'first', status: 'PENDING' }] }); await h.settle();
  assert.equal(metric(h, 'Lịch trong kỳ'), 1);
  find(h, 'Select').props.onChange({ target: { value: 'branch-b' } }); h.render();
  assert.equal(metric(h, 'Lịch trong kỳ'), undefined);
  const old = h.calls.slice(8); assert.equal(old[0].args[0].branchId, 'branch-b');
  find(h, 'Input').props.onChange({ target: { value: '2026-10-01' } }); h.render();
  // Ensure a changed date even if the initial month happens to be October.
  find(h, 'Input').props.onChange({ target: { value: '2026-09-01' } }); h.render();
  const fresh = h.calls.slice(-7);
  assert.equal(fresh[0].args[0].dateFrom, '2026-09-01');
  h.complete(fresh, { bookings: [{ id: 'fresh-1' }, { id: 'fresh-2' }] }); await h.settle();
  h.complete(old, { bookings: new Error('stale date failure'), services: new Error('stale'), staff: new Error('stale') }); await h.settle();
  assert.equal(metric(h, 'Lịch trong kỳ'), 2); assert.equal(find(h, 'ErrorState'), undefined);
});

test('token-only and generation-only transitions fence requests; logout never starts dashboard', async () => {
  for (const change of [h => { h.session.accessToken = 'new-token'; }, h => h.advance(), h => { h.session.user = null; h.session.accessToken = null; h.advance(); }]) {
    const h = harness(); h.render(); change(h);
    h.calls[0].resolve([{ id: 'old-branch' }]); await h.settle(); noDashboard(h);
    assert.ok(h.calls.every(call => call.name === 'branches'));
    assert.equal(h.calls.length, h.session.user ? 2 : 1);
  }
});

test('unmount fences branch and dashboard completions without further requests', async () => {
  for (const withDashboard of [false, true]) {
    const h = harness(); h.render();
    if (withDashboard) { h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle(); }
    const count = h.calls.length; h.unmount(); h.complete(h.calls); await h.settle();
    assert.equal(h.calls.length, count); assert.equal(metric(h, 'Lịch trong kỳ'), undefined);
  }
});

test('existing finance exclusion and review permission gate survive; partial and total dashboard failures retain behavior', async () => {
  assert.equal(FINANCE_WORKSPACE_ENABLED, false);
  const h = harness(owner('business-a', ['review:moderate:tenant', 'payment:read:tenant', 'report:revenue:tenant']));
  h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
  assert.deepEqual(h.calls.slice(1).map(call => call.name), ['bookings', 'bookings', 'bookings', 'bookings', 'bookings', 'services', 'staff', 'reviews']);
  h.complete(h.calls.slice(1), { services: new Error('partial') }); await h.settle();
  assert.ok(find(h, 'InlineNotice')); assert.equal(find(h, 'ErrorState'), undefined);
  assert.equal(metric(h, 'Doanh thu thuần trong kỳ'), undefined);
  find(h, 'Input').props.onChange({ target: { value: '2026-08-01' } }); h.render();
  const failures = h.calls.slice(-8); failures.forEach(call => call.reject(new Error('dashboard unavailable'))); await h.settle();
  assert.equal(find(h, 'ErrorState').props.message, 'dashboard unavailable');
  void find(h, 'ErrorState').props.onRetry(); h.render();
  h.complete(h.calls.slice(-8)); await h.settle(); assert.equal(find(h, 'ErrorState'), undefined);
});

test('filtered counts use meta.total beyond page length and never request full pages just to count', async () => {
  const h = harness(); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
  h.complete(h.calls.slice(1), call => call.name === 'bookings'
    ? { data: [], meta: { total: call.args[0].limit !== 1 ? 0 : call.args[0].status === 'PENDING' ? 123 : call.args[0].status === 'COMPLETED' ? 234 : 321, page: 1, limit: call.args[0].limit, totalPages: 321 } }
    : []);
  await h.settle();
  assert.equal(metric(h, 'Lịch trong kỳ'), 321);
  assert.equal(metric(h, 'Lịch hoàn thành'), 234);
  assert.equal(actionCount(h), 123);
  const counts = h.calls.filter(call => call.name === 'bookings' && call.args[0].limit === 1);
  assert.equal(counts.length, 3);
  for (const call of counts) {
    assert.equal(call.args[0].branchId, 'branch-a');
    assert.equal(call.args[0].dateFrom, dates.format(dates.startOfMonth(new Date()), 'yyyy-MM-dd'));
    assert.equal(call.args[0].dateTo, dates.format(dates.endOfMonth(new Date()), 'yyyy-MM-dd'));
  }
});

test('upcoming excludes earlier EXPIRED and every terminal status, retaining legitimate active appointments', async () => {
  const h = harness(); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
  const day = dates.format(new Date(), 'yyyy-MM-dd');
  // Select a future range so this remains deterministic at any wall-clock time.
  const future = dates.format(dates.addDays(new Date(), 1), 'yyyy-MM-dd');
  const rows = ['EXPIRED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_PROGRESS'].map((status, i) => ({
    bookingId: status, statusEnum: status, appointment_time: future, appointment_start: `09:${String(i).padStart(2, '0')}`, customer_name: status,
  }));
  find(h, 'Input').props.onChange({ target: { value: day } }); h.render();
  h.render().filter(node => node.type === 'Input')[1].props.onChange({ target: { value: future } }); h.render();
  h.complete(h.calls.slice(1), call => {
    if (call.name !== 'bookings') return [];
    const data = call.args[0].status === 'unfinished' ? rows.filter(row => ['EXPIRED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(row.statusEnum))
      : rows.filter(row => !['EXPIRED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(row.statusEnum));
    return { data: data.slice(0, call.args[0].limit), meta: { total: data.length, page: 1, limit: call.args[0].limit, totalPages: Math.ceil(data.length / call.args[0].limit) } };
  });
  await h.settle();
  assert.deepEqual(appointmentLinks(h).map(node => node.props.to), ['CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_PROGRESS'].map(id => `/salon/appointments?bookingId=${id}`));
});

test('failed count requests remain unavailable with warning instead of false zero or stable action', async () => {
  const h = harness(); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
  h.complete(h.calls.slice(1), call => call.name === 'bookings' ? new Error('count unavailable') : []); await h.settle();
  assert.equal(metric(h, 'Lịch trong kỳ'), '—');
  assert.equal(metric(h, 'Lịch hoàn thành'), '—');
  assert.equal(actionCount(h), '—');
  assert.ok(find(h, 'InlineNotice'));
  assert.ok(!nodes(pendingAction(h)).some(node => node.type === 'Badge' && node.props.children === 'Ổn định'));
});

const fixedNow = '2026-10-12T12:00:00';
const appointment = (bookingId, statusEnum, time, day = '2026-10-12') => ({
  bookingId, statusEnum, appointment_time: day, appointment_start: time,
});
const pageResponse = (call, rows) => {
  const { page, limit } = call.args[0];
  return { data: rows.slice((page - 1) * limit, page * limit), meta: { total: rows.length, page, limit, totalPages: Math.ceil(rows.length / limit) } };
};

test('upcoming pages beyond elapsed same-day rows and merges earliest six across both active groups', async () => {
  const h = harness(owner(), false, fixedNow); h.render(); h.calls[0].resolve([{ id: 'branch-a' }, { id: 'branch-b' }]); await h.settle();
  const pending = [
    ...Array.from({ length: 12 }, (_, i) => appointment(`past-${i}`, 'PENDING', '09:00')),
    ...Array.from({ length: 7 }, (_, i) => appointment(`pending-${i}`, 'PENDING', `13:0${i}`)),
  ];
  const active = [appointment('active', 'CONFIRMED', '12:30'), appointment('later', 'IN_PROGRESS', '18:00')];
  const completePage = requests => h.complete(requests, call => call.name !== 'bookings' ? [] : pageResponse(call, call.args[0].status === 'unfinished' ? active : pending));
  let next = 1;
  for (let pass = 0; pass < 3; pass++) {
    const end = h.calls.length; completePage(h.calls.slice(next, end)); next = end; await h.settle();
  }
  assert.deepEqual(appointmentLinks(h).map(node => node.props.to), ['active', ...Array.from({ length: 5 }, (_, i) => `pending-${i}`)].map(id => `/salon/appointments?bookingId=${id}`));
  const upcomingCalls = h.calls.filter(call => call.name === 'bookings' && call.args[0].limit === 6);
  assert.deepEqual(upcomingCalls.map(call => call.args[0].page), [1, 1, 2, 3]);
  for (const call of upcomingCalls) {
    assert.equal(call.args[0].sortOrder, 'appointment');
    assert.equal(call.args[0].dateFrom, '2026-10-12'); assert.equal(call.args[0].dateTo, '2026-10-31');
    assert.equal(call.args[0].branchId, undefined); // Full accessible tenant scope.
  }
  assert.equal(metric(h, 'Lịch trong kỳ'), 19);
});

test('future selected range and branch scope reach upcoming queries; historical range sends counts only', async () => {
  const h = harness(owner(), false, fixedNow); h.render(); h.calls[0].resolve([{ id: 'branch-a' }, { id: 'branch-b' }]); await h.settle();
  find(h, 'Select').props.onChange({ target: { value: 'branch-b' } }); h.render();
  find(h, 'Input').props.onChange({ target: { value: '2026-10-20' } }); h.render();
  const fresh = h.calls.slice(-7);
  for (const call of fresh.filter(call => call.name === 'bookings')) {
    assert.equal(call.args[0].branchId, 'branch-b'); assert.equal(call.args[0].dateFrom, '2026-10-20');
    assert.equal(call.args[0].dateTo, '2026-10-31');
  }
  h.complete(fresh); await h.settle();
  find(h, 'Input').props.onChange({ target: { value: '2026-09-01' } }); h.render();
  const start = h.calls.length;
  h.render().filter(node => node.type === 'Input')[1].props.onChange({ target: { value: '2026-09-30' } }); h.render();
  const historical = h.calls.slice(start);
  assert.equal(historical.filter(call => call.name === 'bookings').length, 3);
  assert.ok(historical.filter(call => call.name === 'bookings').every(call => call.args[0].limit === 1));
  h.complete(historical); await h.settle(); assert.equal(appointmentLinks(h).length, 0);
});

test('elapsed-page completions cannot start another page after auth, branch, date or unmount changes', async () => {
  for (const change of [
    h => { h.session.user = owner('business-b'); h.render(); },
    h => { h.session.accessToken = 'token-b'; h.render(); },
    h => { h.advance(); h.render(); },
    h => { h.session.user = null; h.session.accessToken = null; h.render(); },
    h => { find(h, 'Select').props.onChange({ target: { value: 'branch-b' } }); h.render(); },
    h => { find(h, 'Input').props.onChange({ target: { value: '2026-10-20' } }); h.render(); },
    h => h.unmount(),
  ]) {
    const h = harness(owner(), false, fixedNow); h.render(); h.calls[0].resolve([{ id: 'branch-a' }, { id: 'branch-b' }]); await h.settle();
    const old = h.calls.slice(1); change(h); const count = h.calls.length;
    h.complete(old, call => call.name !== 'bookings' ? [] : pageResponse(call, Array.from({ length: 12 }, (_, i) => appointment(`past-${i}`, 'PENDING', '09:00'))));
    await h.settle();
    assert.equal(h.calls.length, count);
    assert.equal(metric(h, 'Lịch trong kỳ'), undefined);
  }
});

test('missing or invalid meta totals are unavailable, preserving successful upcoming data', async () => {
  for (const meta of [undefined, { total: -1 }, { total: '100' }, { total: NaN }]) {
    const h = harness(owner(), false, fixedNow); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
    h.complete(h.calls.slice(1), call => call.name !== 'bookings' ? [] : call.args[0].limit === 1 ? { data: [{ id: 'one' }], meta }
      : pageResponse(call, call.args[0].status === 'unfinished' ? [appointment('active', 'CONFIRMED', '13:00')] : []));
    await h.settle();
    assert.equal(metric(h, 'Lịch trong kỳ'), '—'); assert.equal(metric(h, 'Lịch hoàn thành'), '—'); assert.equal(actionCount(h), '—');
    assert.equal(appointmentLinks(h).length, 1); assert.ok(find(h, 'InlineNotice'));
  }
});

test('one failed upcoming status group shows retry error instead of an incomplete earliest list or empty success', async () => {
  const h = harness(owner(), false, fixedNow); h.render(); h.calls[0].resolve([{ id: 'branch-a' }]); await h.settle();
  h.complete(h.calls.slice(1), call => call.name !== 'bookings' ? [] : call.args[0].limit === 6 && call.args[0].status === 'PENDING' ? new Error('pending list unavailable')
    : pageResponse(call, call.args[0].status === 'unfinished' ? [appointment('active', 'CONFIRMED', '13:00')] : []));
  await h.settle();
  assert.equal(appointmentLinks(h).length, 0); assert.ok(find(h, 'ErrorState')); assert.ok(find(h, 'InlineNotice'));
  assert.equal(find(h, 'EmptyState'), undefined); assert.equal(metric(h, 'Lịch trong kỳ'), 0);
  const start = h.calls.length; void find(h, 'ErrorState').props.onRetry(); h.render(); h.complete(h.calls.slice(start)); await h.settle();
  assert.equal(find(h, 'ErrorState'), undefined); assert.equal(find(h, 'EmptyState').props.title, 'Không có lịch sắp tới');
});
