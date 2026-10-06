const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Execute the real screen handlers/JSX with a small hook harness. Mount effects and
// native layout are deliberately outside these tests; no API or runtime is started.
function screenHarness(file, { create = async () => ({ id: 'saved' }), preview = async () => ({ finalAmount: 100 }), booking } = {}) {
  const source = readFileSync(path.join(__dirname, '../src/screens', file), 'utf8');
  const stateNames = [...source.matchAll(/const \[([^,]+),[^\]]+\] = useState/g)].map(match => match[1]);
  const initial = {
    selectedTime: '2026-12-20T03:00:00.000Z', pricePreview: { finalAmount: 100 },
    selectedApiServices: [{ id: 'service', name: 'Dịch vụ QA', price: 100 }],
    isLoadingServiceInfo: false, policy: { selfBookingAllowed: true }, isReviewVisible: true,
  };
  const states = [], refs = [];
  let stateIndex = 0, refIndex = 0, tree, preventRemove;
  const calls = [], alerts = [], navigations = [];
  const auth = { isLoggedIn: true, user: { id: 'customer' } };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = stateNames[index] in initial ? initial[stateNames[index]] : typeof value === 'function' ? value() : value;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef(value) { const index = refIndex++; return refs[index] ||= { current: value }; },
    useMemo: callback => callback(), useEffect() {},
  };
  const navigation = {
    navigate: (...args) => navigations.push(structuredClone(args)), goBack() {}, popToTop() {},
    getParent: () => ({ navigate: (...args) => navigations.push(args) }),
  };
  const modules = {
    react: { ...React, default: React },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name])), StyleSheet: { create: styles => styles }, Alert: { alert: (...args) => alerts.push(args) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@react-navigation/native': { usePreventRemove: enabled => { preventRemove = enabled; } },
    '../constants/colors': { colors: {} }, '../data/catalogModels': { formatCurrency: value => `${value} đ` },
    '../components/SelectListSheet': { default: 'SelectListSheet' },
    '../context/BookingsContext': { useBookings: () => ({ addBooking: async (body, key) => { calls.push({ body: structuredClone(body), key }); return create(body, key); }, getBooking: () => booking }) },
    '../api/bookings': { bookingsApi: { previewPrice: preview } },
    '../api/client': { ApiError, createIdempotencyKey: () => `key-${calls.length}` },
    '../api/services': { servicesApi: {} }, '../api/staff': { staffApi: {} },
    '../context/AuthContext': { useAuth: () => auth }, '../navigation/navigationRef': { navigationRef: {} },
  };
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; } });
  const render = () => {
    stateIndex = refIndex = 0;
    tree = module.exports.default({ route: { params: { branchId: 'branch', shopName: 'Cơ sở QA', addresses: ['Địa chỉ QA'], serviceIds: ['service'], service: { name: 'Dịch vụ QA', price: 100, originalPrice: 100 } } }, navigation });
    return tree;
  };
  function nodes(value) {
    if (arguments.length === 0) value = tree;
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    return [value, ...nodes(value.props?.children ?? [])];
  }
  const press = label => { const node = nodes().find(node => node.props?.accessibilityLabel === label); assert.ok(node, `Missing ${label}`); if (!node.props.disabled) node.props.onPress(); };
  const text = () => nodes().filter(node => node.type === 'Text').map(node => node.props.children.flat(Infinity).filter(value => typeof value === 'string').join('')).join('\n');
  const set = (name, value) => { const index = stateNames.indexOf(name); assert.notEqual(index, -1); states[index] = value; };
  render();
  return { render, press, text, set, nodes, calls, alerts, navigations, auth, get preventRemove() { return preventRemove; } };
}

const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
const confirm = 'Xác nhận gửi đặt lịch';
const retry = 'Thử lại yêu cầu đặt lịch đã gửi';

test('double press and slow response submit once; success waits for backend result', async () => {
  let resolveCreate;
  const h = screenHarness('BookingScreen.tsx', { create: () => new Promise(resolve => { resolveCreate = resolve; }) });
  h.press(confirm); h.press(confirm);
  await settle(); h.render();
  assert.equal(h.calls.length, 1);
  assert.equal(h.navigations.length, 0);
  assert.equal(h.preventRemove, true);
  resolveCreate({ id: 'backend-booking' });
  await settle(); h.render();
  assert.deepEqual(h.navigations, [['BookingSuccess', { bookingId: 'backend-booking' }]]);
  assert.equal(h.preventRemove, false);
});

for (const failure of [new ApiError('offline', 0), new ApiError('server', 503), new ApiError('timeout', 408), new ApiError('Request trùng đang được xử lý — vui lòng chờ', 409), new Error('response body interrupted')]) {
  test(`ambiguous ${failure.message}: retry keeps body/key despite edited form and skips preview`, async () => {
    let attempt = 0, previews = 0;
    const h = screenHarness('BookingScreen.tsx', {
      preview: async () => { previews++; return { finalAmount: 100 }; },
      create: async () => { if (++attempt === 1) throw failure; return { id: 'replayed-booking' }; },
    });
    h.press(confirm); await settle(); h.render();
    assert.match(h.text(), /Chưa rõ kết quả đặt lịch/);
    assert.equal(h.alerts.length, 0);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.preventRemove, true);
    assert.equal(h.nodes().find(node => node.type === 'ScrollView').props.pointerEvents, 'none');
    h.set('note', 'changed after send'); h.set('selectedTime', null); h.set('pricePreview', null);
    h.render(); h.press(retry); h.press(retry); await settle(); h.render();
    assert.equal(h.calls.length, 2);
    assert.equal(previews, 1);
    assert.deepEqual(h.calls[1], h.calls[0]);
    assert.deepEqual(h.navigations, [['BookingSuccess', { bookingId: 'replayed-booking' }]]);
    assert.equal(h.preventRemove, false);
  });
}

test('rejected replay does not turn an unknown original result into definite failure', async () => {
  let attempt = 0;
  const h = screenHarness('BookingScreen.tsx', { create: async () => { throw new ApiError('rejected', ++attempt === 1 ? 0 : 401); } });
  h.press(confirm); await settle(); h.render();
  h.press(retry); await settle(); h.render();
  assert.match(h.text(), /Chưa rõ kết quả đặt lịch/);
  assert.equal(h.alerts.length, 0);
  assert.deepEqual(h.calls[1], h.calls[0]);
});

test('unknown request cannot be replayed by a different account', async () => {
  const h = screenHarness('BookingScreen.tsx', { create: async () => { throw new ApiError('offline', 0); } });
  h.press(confirm); await settle(); h.auth.user = { id: 'other-customer' }; h.render();
  h.press(retry); await settle(); h.render();
  assert.equal(h.calls.length, 1);
  assert.equal(h.alerts[0][0], 'Tài khoản đã thay đổi');
  assert.match(h.text(), /Chưa rõ kết quả đặt lịch/);
});

test('definitive initial slot conflict preserves existing reselect feedback', async () => {
  const h = screenHarness('BookingScreen.tsx', { create: async () => { throw new ApiError('Khung giờ này vừa có người đặt', 409); } });
  h.press(confirm); await settle(); h.render();
  assert.equal(h.alerts[0][0], 'Khung giờ không còn trống');
  assert.doesNotMatch(h.text(), /Chưa rõ kết quả đặt lịch/);
  assert.equal(h.preventRemove, false);
});

test('failed preview never submits or claims the booking outcome is uncertain', async () => {
  const h = screenHarness('BookingScreen.tsx', { preview: async () => { throw new ApiError('offline preview', 0); } });
  h.press(confirm); await settle(); h.render();
  assert.equal(h.calls.length, 0);
  assert.equal(h.alerts[0][0], 'Không thể đặt lịch');
  assert.doesNotMatch(h.text(), /Chưa rõ kết quả đặt lịch/);
});

test('price change requires another review before any booking is sent', async () => {
  const h = screenHarness('BookingScreen.tsx', { preview: async () => ({ finalAmount: 150 }) });
  h.press(confirm); await settle(); h.render();
  assert.equal(h.calls.length, 0);
  assert.equal(h.alerts[0][0], 'Giá đã thay đổi');
  assert.equal(h.preventRemove, false);
});

test('account change during price revalidation does not submit as the new account', async () => {
  let resolvePreview;
  const h = screenHarness('BookingScreen.tsx', { preview: () => new Promise(resolve => { resolvePreview = resolve; }) });
  h.press(confirm); h.auth.user = { id: 'other-customer' }; h.render();
  resolvePreview({ finalAmount: 100 }); await settle(); h.render();
  assert.equal(h.calls.length, 0);
  assert.equal(h.navigations.length, 0);
});

test('missing create response remains uncertain rather than claiming success or failure', async () => {
  const h = screenHarness('BookingScreen.tsx', { create: async () => undefined });
  h.press(confirm); await settle(); h.render();
  assert.match(h.text(), /Chưa rõ kết quả đặt lịch/);
  assert.equal(h.navigations.length, 0);
  assert.equal(h.alerts.length, 0);
});

for (const rawStatus of ['PENDING', 'CONFIRMED']) {
  test(`${rawStatus} success preserves status copy and displays code/summary/appointment link`, () => {
    const h = screenHarness('BookingSuccessScreen.tsx', { booking: { rawStatus, bookingCode: 'BB-QA-123', shopName: 'Cơ sở QA', serviceName: 'Dịch vụ QA', date: '20/12/2026', time: '10:00', totalPrice: 100 } });
    assert.match(h.text(), rawStatus === 'PENDING' ? /Đã gửi yêu cầu đặt lịch/ : /Lịch hẹn đã được xác nhận/);
    if (rawStatus === 'PENDING') assert.doesNotMatch(h.text(), /Lịch hẹn đã được xác nhận/);
    for (const value of ['Mã lịch: BB-QA-123', 'Cơ sở QA', 'Dịch vụ QA', '20/12/2026', '10:00', 'Xem lịch hẹn của tôi']) assert.ok(h.text().includes(value));
    h.nodes().find(node => node.type === 'TouchableOpacity').props.onPress();
    assert.deepEqual(h.navigations, [['LichHen']]);
  });
}

test('missing booking code does not invent one', () => {
  const h = screenHarness('BookingSuccessScreen.tsx', { booking: { rawStatus: 'PENDING' } });
  assert.doesNotMatch(h.text(), /Mã lịch:/);
});
