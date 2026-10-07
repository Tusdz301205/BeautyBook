const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, modules = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require(name) { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; }, console, setTimeout, clearTimeout, AbortController }, { filename: file });
  return module.exports;
}
const policy = load('operations/owner/policy.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const business = id(1), branch = id(2), otherBusiness = id(3), otherBranch = id(4), bookingId = id(5), requestId = id(6), impactId = id(7), itemId = id(8);
const scope = () => ({ userId: id(9), workspace: 'SALON', sessionType: 'salon', businessId: business, roles: ['BUSINESS_OWNER', 'STAFF'], scopes: [{ code: 'BUSINESS_OWNER', businessId: business, branchId: null }, { code: 'STAFF', businessId: otherBusiness, branchId: otherBranch }], branches: [{ id: branch, businessId: business, name: 'Chi nhánh A', timezone: 'Asia/Ho_Chi_Minh' }, { id: otherBranch, businessId: otherBusiness, name: 'Chi nhánh B' }], branchId: null });
const rawBooking = () => ({ id: bookingId, bookingCode: 'BB-0005', branchId: branch, branch: { id: branch, businessId: business, name: 'A', timezone: 'Asia/Ho_Chi_Minh' }, customer: { user: { fullName: 'Khách A', email: 'private', phone: 'private' }, healthNote: 'private' }, status: 'PENDING', appointmentDate: '2026-10-05T00:00:00.000Z', appointmentStartTime: '1970-01-01T10:00:00.000Z', appointmentEndTime: '1970-01-01T11:00:00.000Z', note: 'Ghi chú công việc', payments: [{ amount: 1000000 }], totalAmount: 1000000, bookingServices: [{ id: id(10), service: { name: 'Dịch vụ A' }, status: 'SCHEDULED', revision: 2, priceAtBooking: 1000000 }] });
const rawRequest = () => ({ id: requestId, booking: rawBooking(), requestType: 'CANCEL', status: 'PENDING', expiresAt: '2099-01-01T00:00:00.000Z', reason: 'Đổi kế hoạch' });
class ApiError extends Error { constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; } }
function apiHarness(handler) {
  let generation = 1;
  const calls = [];
  const client = { ApiError, getApiSessionGeneration: () => generation, createIdempotencyKey: () => 'stable-test-key', withQuery: (p, q) => `${p}?${new URLSearchParams(q)}`, apiRequest: async (p, init = {}) => { calls.push({ path: p, init }); return handler(p, init); } };
  return { ...load('api/ownerOperations.ts', { './client': client, '../operations/owner/policy': policy }), calls, client, replaceSession: () => generation++ };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Owner overview prioritizes real attention counts and never treats loading or failed reads as all clear', () => {
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
  const operations = { businessId: business, branchId: branch, date: '2026-10-06', branches: [{ id: branch, name: 'A', status: 'ACTIVE' }], refresh() {}, setBranchId() {} };
  const requests = { data: [{ id: requestId, booking: { branchId: branch } }], loading: false, reload() {} };
  const impacts = { data: [{ status: 'OPEN' }, { status: 'COMPLETED' }], loading: false, reload() {} };
  const dashboard = { data: { date: operations.date, branches: [{ id: branch, name: 'Chi nhánh tên dài', bookings: 3, completedBookings: 1, activeProfiles: 2 }], bookings: 3, completedBookings: 1, statuses: [] }, loading: false, reload() {} };
  const navigation = { navigate() {} };
  const mod = load('operations/owner/OwnerOverview.tsx', {
    react: React, 'react-native': { FlatList: 'FlatList', RefreshControl: 'RefreshControl', View: 'View', Text: 'Text', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '../../constants/colors': { colors: {} }, '@react-navigation/native': { useNavigation: () => navigation },
    '../../api/ownerOperations': { ownerOperationsApi: { dashboard() {}, requests() {}, impacts() {} } }, '../OperationsContext': { useOperations: () => operations },
    '../OperationPrimitives': { OperationPage: 'Page', OperationButton: 'Button', OperationState: 'State' },
    './hooks': { useOwnerData: (_, key) => key.startsWith('dashboard') ? dashboard : key === 'overview-requests' ? requests : impacts },
    './OwnerUI': { Body: 'Body', Card: 'Card', DesktopLink: 'Desktop', Heading: 'Heading', Meta: 'Meta', OwnerFilters: 'Filters', statusLabel: s => s, styles: {} }, './OwnerSetupState': 'Setup',
  });
  const nodes = t => t == null || typeof t === 'boolean' ? [] : Array.isArray(t) ? t.flatMap(nodes) : typeof t !== 'object' ? [t] : [t, ...t.children.flatMap(nodes), ...nodes(t.props.ListHeaderComponent)];
  let tree = nodes(mod.default());
  assert.ok(tree.includes('Cần bạn xử lý'));
  assert.ok(tree.indexOf('Cần bạn xử lý') < tree.indexOf('Ngày 2026-10-06'));
  const initialList = tree.find(n => n?.type === 'FlatList');
  const pendingBranch = nodes(initialList.props.renderItem({ item: dashboard.data.branches[0] }));
  assert.ok(pendingBranch.some(n => n?.type === 'Text' && n.children[0] === 1 && n.children[1] === ' mục cần xử lý'));
  requests.data = []; impacts.data = [];
  assert.ok(nodes(mod.default()).includes('Không có việc chờ xử lý'));
  requests.loading = true;
  assert.ok(!nodes(mod.default()).includes('Không có việc chờ xử lý'));
  requests.loading = false; requests.error = 'offline';
  assert.ok(!nodes(mod.default()).includes('Không có việc chờ xử lý'));
  const list = nodes(mod.default()).find(n => n?.type === 'FlatList');
  const branchCard = nodes(list.props.renderItem({ item: dashboard.data.branches[0] }));
  assert.ok(branchCard.some(n => n?.type === 'Meta' && n.children.includes(' hồ sơ nhân viên hoạt động · Không phải số người đang trong ca')));
  assert.ok(!branchCard.some(n => n?.type === 'Desktop'));
});

test('branch or mode change during preflight stops every Owner write without replacing the session', async () => {
  for (const action of ['review', 'booking', 'resolve', 'complete']) {
    const read = deferred(); let current = true;
    const h = apiHarness(() => read.promise);
    const captured = { ...scope(), isCurrent: () => current };
    const pending = action === 'review' ? h.ownerOperationsApi.review(captured, requestId, 'approve', '')
      : action === 'booking' ? h.ownerOperationsApi.bookingAction(captured, bookingId, 'confirm', '')
      : action === 'resolve' ? h.ownerOperationsApi.approveException(captured, impactId, itemId, 'Approved test exception')
      : h.ownerOperationsApi.completeImpact(captured, impactId);
    current = false;
    read.resolve(action === 'review' ? [rawRequest()] : action === 'booking' ? rawBooking()
      : { id: impactId, businessId: business, branchId: branch, status: action === 'resolve' ? 'OPEN' : 'READY_TO_COMPLETE',
        items: [{ id: itemId, bookingId, status: action === 'resolve' ? 'PENDING' : 'RESOLVED', booking: rawBooking() }] });
    await assert.rejects(pending, error => error.status === 409);
    assert.equal(h.calls.filter(call => call.init.method && call.init.method !== 'GET').length, 0);
  }
});

test('owner grant cannot be borrowed from another business, expired scope, staff role or customer session', () => {
  assert.equal(policy.ownsBusiness(scope()), true);
  for (const replacement of [{ businessId: otherBusiness }, { workspace: 'CUSTOMER' }, { sessionType: 'customer' }, { roles: ['STAFF'] }, { scopes: [{ code: 'BUSINESS_OWNER', businessId: business, branchId: null, expiresAt: '2000-01-01' }] }, { scopes: [{ code: 'BUSINESS_OWNER', businessId: business, branchId: branch }] }]) assert.equal(policy.ownsBusiness({ ...scope(), ...replacement }), false);
  assert.equal(policy.ownerBranches(scope()).length, 1);
  assert.equal(policy.permitsResource(scope(), otherBusiness, otherBranch), false);
  assert.equal(policy.permitsResource({ ...scope(), branchId: branch }, business, null), false);
});

test('owner projections drop finance/contact/health fields and reject cross business details', () => {
  const h = apiHarness(() => {});
  const projected = h.projectBooking(rawBooking(), scope());
  assert.equal(projected.id, bookingId); assert.equal(projected.code, 'BB-0005');
  for (const privateField of ['payments', 'totalAmount', 'priceAtBooking', 'email', 'phone', 'healthNote']) assert.ok(!JSON.stringify(projected).includes(privateField));
  assert.throws(() => h.projectBooking({ ...rawBooking(), branchId: otherBranch, branch: { id: otherBranch, businessId: otherBusiness } }, scope()), e => e.status === 403);
  assert.throws(() => h.projectBooking({ ...rawBooking(), id: 'BB-0005' }, scope()), e => e.status === 404);
  const projectedImpact = h.projectImpact({ id: impactId, businessId: business, branchId: branch, status: 'OPEN', reason: 'Ngoại lệ', items: [{ id: itemId, bookingId, booking: rawBooking(), financialSnapshot: { paid: 50000 } }] }, scope());
  assert.ok(!JSON.stringify(projectedImpact).includes('financialSnapshot'));
  const assignedWithoutName = rawBooking(); assignedWithoutName.bookingServices[0].staffId = id(42);
  assert.equal(h.projectBooking(assignedWithoutName, scope()).items[0].staffName, 'Đã phân công; chưa tải tên nhân viên');
});

test('dashboard uses only verified branch totals and fails instead of inventing zero on missing metrics', async () => {
  const h = apiHarness(p => {
    assert.ok(p.includes(`branchId=${branch}`)); assert.ok(!p.includes(otherBranch));
    return { range: { from: '2026-10-05', to: '2026-10-05' }, scope: { branchId: branch }, kpis: { netRevenue: 99 }, charts: { bookingStatus: [{ status: 'COMPLETED', count: 2 }], branchComparison: [{ branchId: branch, bookingCount: 5, completedBookings: 2, activeStaff: 3, netRevenue: 99 }] } };
  });
  const result = await h.ownerOperationsApi.dashboard(scope(), '2026-10-05');
  assert.equal(h.calls.length, 1); assert.equal(result.bookings, 5); assert.equal(result.completedBookings, 2); assert.equal(result.branches[0].activeProfiles, 3);
  assert.ok(!JSON.stringify(result).includes('Revenue'));
  const broken = apiHarness(() => ({ range: { from: '2026-10-05', to: '2026-10-05' }, scope: { branchId: branch }, charts: { branchComparison: [{ branchId: branch, completedBookings: 0, activeStaff: 0 }] } }));
  await assert.rejects(broken.ownerOperationsApi.dashboard(scope(), '2026-10-05'), e => e.status === 502);
  await assert.rejects(h.ownerOperationsApi.dashboard(scope(), '2026-02-30'), e => e.status === 400);
});

test('expired/already processed requests and valid late-cancellation rejection produce no writes', async () => {
  for (const patch of [{ status: 'APPROVED' }, { expiresAt: '2000-01-01T00:00:00Z' }, { violationEvent: { kind: 'LATE_CANCELLATION', voidedAt: null } }]) {
    const h = apiHarness(() => [{ ...rawRequest(), ...patch }]);
    await assert.rejects(h.ownerOperationsApi.review(scope(), requestId, 'reject', 'Lý do'), e => e.status === 409);
    assert.equal(h.calls.filter(c => c.init.method).length, 0);
  }
});

test('request review verifies displayed content and sends finance guard header; mutation payload is discarded', async () => {
  const h = apiHarness((p, init) => init.method ? { payments: ['private'] } : [rawRequest()]);
  await h.ownerOperationsApi.review(scope(), requestId, 'approve', 'Đã xem xét');
  const write = h.calls[1]; assert.equal(write.init.method, 'PATCH'); assert.equal(write.init.headers['X-Mobile-Owner-V1'], 'true'); assert.ok(write.init.headers['Idempotency-Key']); assert.equal(JSON.parse(write.init.body).reviewNote, 'Đã xem xét'); assert.ok(write.init.signal);
  const displayed = h.projectRequest(rawRequest(), scope()); displayed.booking.start = '1970-01-01T09:00:00.000Z';
  await assert.rejects(h.ownerOperationsApi.review(scope(), requestId, 'approve', '', displayed), e => e.status === 409);
  assert.equal(h.calls.filter(c => c.init.method).length, 1);
});

test('finance-required error directs desktop, with no retry or fallback cancellation', async () => {
  const h = apiHarness((p, init) => { if (init.method) throw new ApiError('finance', 409, { code: 'MOBILE_FINANCE_REVIEW_REQUIRED' }); return [rawRequest()]; });
  await assert.rejects(h.ownerOperationsApi.review(scope(), requestId, 'approve', ''), e => { assert.ok(policy.ownerError(e).includes('quản trị')); return true; });
  assert.equal(h.calls.length, 2);
});
test('ordinary reschedule approves explicit unchanged staff; mixed/new/unknown assignments require desktop', async () => {
  const assigned = id(20), different = id(21);
  const raw = { ...rawRequest(), requestType: 'RESCHEDULE', proposedStaffId: assigned, proposedStartTime: '2098-01-01T03:00:00Z', proposedEndTime: '2098-01-01T04:00:00Z' };
  raw.booking.bookingServices[0].staffId = assigned;
  const h = apiHarness((p, init) => init.method ? {} : [raw]);
  await h.ownerOperationsApi.review(scope(), requestId, 'approve', 'Giữ phân công');
  assert.equal(h.calls.filter(c => c.init.method).length, 1);
  for (const staffId of [different, null]) {
    raw.booking.bookingServices[0].staffId = staffId;
    await assert.rejects(h.ownerOperationsApi.review(scope(), requestId, 'approve', ''), e => e.status === 422);
  }
  raw.booking.bookingServices[0].staffId = assigned;
  raw.booking.bookingServices.push({ id: id(30), staffId: different, status: 'SCHEDULED' });
  await assert.rejects(h.ownerOperationsApi.review(scope(), requestId, 'approve', ''), e => e.status === 422);
  assert.equal(h.calls.filter(c => c.init.method).length, 1);
});

test('session changes during preflight prevent old-account mutation', async () => {
  const d = deferred(); const h = apiHarness(() => d.promise);
  const pending = h.ownerOperationsApi.review(scope(), requestId, 'approve', ''); h.replaceSession(); d.resolve([rawRequest()]);
  await assert.rejects(pending, e => e.status === 401);
  assert.equal(h.calls.filter(c => c.init.method).length, 0);
});

test('impact completion rejects unresolved/processing items; exception uses case endpoint only', async () => {
  const raw = { id: impactId, businessId: business, branchId: branch, status: 'READY_TO_COMPLETE', items: [{ id: itemId, bookingId, status: 'PROCESSING', booking: rawBooking() }] };
  const h = apiHarness(() => raw);
  await assert.rejects(h.ownerOperationsApi.completeImpact(scope(), impactId), e => e.status === 409);
  raw.status = 'OPEN'; raw.items[0].status = 'PENDING';
  await h.ownerOperationsApi.approveException(scope(), impactId, itemId, 'Đã xác minh phục vụ được');
  const write = h.calls.find(c => c.init.method); assert.equal(write.path, `/operational-impacts/${impactId}/items/${itemId}`); assert.equal(JSON.parse(write.init.body).resolution, 'APPROVED_EXCEPTION');
  raw.status = 'READY_TO_COMPLETE'; raw.items[0].status = 'RESOLVED';
  await h.ownerOperationsApi.completeImpact(scope(), impactId);
  assert.equal(h.calls.at(-1).path, `/operational-impacts/${impactId}/complete`);
});

test('booking exceptions reject lifecycle actions and stale check-in; confirm/reject use action router', async () => {
  let booking = rawBooking(); const h = apiHarness(() => booking);
  await assert.rejects(h.ownerOperationsApi.bookingAction(scope(), bookingId, 'START', ''), e => e.status === 403);
  await h.ownerOperationsApi.bookingAction(scope(), bookingId, 'confirm', 'Ngoại lệ');
  assert.equal(h.calls.at(-1).init.method, 'PUT'); assert.equal(JSON.parse(h.calls.at(-1).init.body).action, 'confirm');
  booking = { ...booking, status: 'CONFIRMED', transitionAvailability: { CHECKED_IN: { allowed: false } } };
  await assert.rejects(h.ownerOperationsApi.bookingAction(scope(), bookingId, 'checkin', ''), e => e.status === 409);
  booking.transitionAvailability.CHECKED_IN.allowed = true;
  await h.ownerOperationsApi.bookingAction(scope(), bookingId, 'checkin', '');
  assert.equal(h.calls.at(-1).path, `/bookings/${bookingId}/checkin`);
});

// Small deterministic hook host: exercise async/session races without a device or API writes.
function hookHost(component, modules) {
  const slots = [], effects = []; let cursor = 0, dirty = false, output;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { const next = typeof value === 'function' ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback(callback, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: callback, deps }; return slots[i].value; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); }); } },
  };
  const hooks = load('operations/owner/hooks.ts', { react: React, '../../context/AuthContext': modules.auth, '../../api/client': modules.client, '../OperationsContext': modules.operations, './policy': policy });
  return { render() { let cycles = 0; do { assert.ok(++cycles < 20); dirty = false; cursor = 0; output = component(hooks); effects.splice(0).forEach(fn => fn()); } while (dirty); return output; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function hookModules() {
  const op = { ...scope(), contextKey: 'sessionA', revision: 0, loading: false, error: null, refresh() { this.revision++; } };
  const user = { ...scope(), id: scope().userId }; let generation = 1;
  return { op, auth: { useAuth: () => ({ user }) }, operations: { useOperations: () => op }, client: { getApiSessionGeneration: () => generation }, replaceSession() { generation++; op.contextKey = 'sessionB'; } };
}

test('revision/session fencing rejects old response while foreground loads latest data', async () => {
  const modules = hookModules(), pending = [];
  const host = hookHost(hooks => hooks.useOwnerData(() => { const d = deferred(); pending.push(d); return d.promise; }, 'dashboard'), modules);
  assert.equal(host.render().loading, true);
  modules.op.revision++; host.render(); pending[0].resolve('stale'); await settle(); assert.equal(host.render().data, undefined);
  pending[1].resolve('current'); await settle(); assert.equal(host.render().data, 'current');
  modules.replaceSession(); assert.equal(host.render().data, undefined); pending[2].resolve('next-account'); await settle(); assert.equal(host.render().data, 'next-account'); host.unmount();
});

test('shared context loading/error never fabricates dashboard zero and permission loss removes cached data', async () => {
  const modules = hookModules(); let calls = 0, fail = false;
  const host = hookHost(hooks => hooks.useOwnerData(async () => { calls++; if (fail) throw new ApiError('forbidden', 403); return { bookings: 10 }; }, 'dashboard'), modules);
  modules.op.loading = true; host.render(); assert.equal(calls, 0);
  modules.op.loading = false; host.render(); await settle(); assert.equal(host.render().data.bookings, 10);
  fail = true; modules.op.revision++; host.render(); await settle(); assert.equal(host.render().data, undefined); assert.ok(host.render().error);
  modules.op.error = 'Chưa tải được ngữ cảnh'; host.render(); assert.equal(calls, 2); assert.equal(host.render().data, undefined); host.unmount();
});

test('double tap is blocked; uncertain mutation must reload successfully before retry', async () => {
  const modules = hookModules(), d = deferred(); let loaded = true, calls = 0, reloads = 0;
  const host = hookHost(hooks => hooks.useOwnerMutation(() => reloads++, loaded), modules);
  const first = host.render().run(async () => { calls++; await d.promise; });
  const second = host.render().run(async () => calls++); assert.equal(calls, 1);
  d.reject(new ApiError('timeout', 0)); await Promise.all([first, second]); assert.equal(reloads, 1);
  assert.equal(host.render().blocked, true); await host.render().run(async () => calls++); assert.equal(calls, 1);
  loaded = false; host.render(); loaded = true; assert.equal(host.render().blocked, false); host.unmount();
});

test('verified Owner success is distinguishable from uncertain delivery for safe navigation', async () => {
  const modules = hookModules();
  const success = hookHost(hooks => hooks.useOwnerMutation(() => {}, true), modules);
  assert.equal(await success.render().run(async () => {}), true); success.unmount();
  const unknown = hookHost(hooks => hooks.useOwnerMutation(() => {}, true), modules);
  assert.equal(await unknown.render().run(async () => { throw new ApiError('timeout', 0); }), false); unknown.unmount();
});

test('legacy unfinished rows keep booking code separate from UUID and prioritize appointment order', async () => {
  const raw = { id: 'BB-QA-LEGACY', bookingId, branchId: branch, statusEnum: 'CONFIRMED', customer_name: 'Khách kiểm thử', customer_phone: 'private-phone',
    appointment_time: '2026-10-06T00:00:00Z', appointment_start: '1970-01-01T22:00:00Z', appointment_end: '1970-01-01T22:30:00Z',
    services: [{ bookingServiceId: itemId, id: 'service', name: 'Dịch vụ', status: 'SCHEDULED', revision: 3, staffId: 'staff', staff: 'Chuyên viên', itemStartAt: '2026-10-06T15:00:00Z', itemEndAt: '2026-10-06T15:30:00Z' }] };
  const h = apiHarness(() => ({ data: [raw], meta: { total: 1 } }));
  const result = await h.ownerOperationsApi.unfinished({ ...scope(), branchId: branch });
  assert.equal(result.data[0].id, bookingId); assert.equal(result.data[0].code, 'BB-QA-LEGACY');assert.equal(result.data[0].items[0].id, itemId);
  assert.match(h.calls[0].path, /sortOrder=appointment/);assert.match(h.calls[0].path, /status=unfinished/);
  assert.ok(!JSON.stringify(result).includes('private-phone'));
});
