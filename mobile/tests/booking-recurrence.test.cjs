const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies = {}, runtime = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, Date, Intl, Number, ...runtime, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return module.exports;
}
const { recurringInput, recurringPreviewReady, validOccurrenceCount } = load('src/utils/bookingRecurrence.ts', {
  './bookingClock': { BOOKING_ZONE: 'Asia/Ho_Chi_Minh' },
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const base = { branchId: 'branch', serviceIds: ['service'], slot: '2026-10-31T18:15:00Z',
  staffMode: 'ANY_AVAILABLE', frequency: 'WEEKLY', occurrenceCount: 4 };

test('recurrence uses booking wall date across UTC midnight, independent of device timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      const payload = recurringInput(base);
      assert.equal(payload.startDate, '2026-11-01');
      assert.equal(payload.preferredTime, '01:15');
      assert.equal(payload.slot, undefined);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('payload honors all frequencies, only pins selected staff in SAME_STAFF, and uses combo OR services', () => {
  for (const frequency of ['WEEKLY', 'BIWEEKLY', 'MONTHLY']) {
    assert.equal(recurringInput({ ...base, frequency }).frequency, frequency);
  }
  assert.equal(recurringInput({ ...base, staffMode: 'SAME_STAFF' }), null);
  assert.equal(recurringInput({ ...base, staffId: 'selected' }).staffId, undefined);
  assert.equal(recurringInput({ ...base, staffMode: 'SAME_STAFF', staffId: 'selected' }).staffId, 'selected');
  const combo = plain(recurringInput({ ...base, comboId: 'combo' }));
  assert.equal(combo.comboId, 'combo');
  assert.equal('serviceIds' in combo, false);
  assert.deepEqual(plain(recurringInput(base)).serviceIds, ['service']);
  assert.equal('voucherCode' in combo, false);
  assert.equal('variantSelections' in combo, false);
});

test('occurrence count requires a whole number within 2–52 and invalid slots are rejected', () => {
  for (const value of ['', '1', '53', '-2', '2.5', '2e1', 'NaN', ' 4 ']) assert.equal(validOccurrenceCount(value), null);
  assert.equal(validOccurrenceCount('2'), 2);
  assert.equal(validOccurrenceCount('52'), 52);
  for (const occurrenceCount of [1, 53, 2.5, NaN]) assert.equal(recurringInput({ ...base, occurrenceCount }), null);
  assert.equal(recurringInput({ ...base, slot: 'invalid' }), null);
});

test('preview must exist and have an available occurrence; conflicts require explicit skip consent', () => {
  assert.equal(recurringPreviewReady(null, true), false);
  assert.equal(recurringPreviewReady({ availableCount: 0, conflictCount: 4 }, true), false);
  assert.equal(recurringPreviewReady({ availableCount: 3, conflictCount: 1 }, false), false);
  assert.equal(recurringPreviewReady({ availableCount: 3, conflictCount: 1 }, true), true);
  assert.equal(recurringPreviewReady({ availableCount: 4, conflictCount: 0 }, false), true);
});

test('preview/create use distinct endpoints and uncertain retries preserve explicit key and body', async () => {
  const calls = [];
  const { recurringApi } = load('src/api/recurring.ts', { './client': {
    apiRequest: async (url, init) => { calls.push({ url, ...plain(init) }); return {}; },
  } });
  const preview = recurringInput(base);
  await recurringApi.preview(preview);
  const input = { ...preview, skipConflicts: true, note: 'Da nhạy cảm', violationAcknowledged: true };
  await recurringApi.create(input, 'same-attempt-key');
  await recurringApi.create(input, 'same-attempt-key');
  assert.equal(calls[0].url, '/recurring/preview');
  assert.equal(calls[1].url, '/recurring');
  assert.equal(calls[1].headers['Idempotency-Key'], 'same-attempt-key');
  assert.deepEqual(calls[1], calls[2]);
  assert.deepEqual(JSON.parse(calls[1].body), plain(input));
});

function checkoutHarness(create, refresh = () => new Promise(() => {})) {
  const slots = [], timers = new Map(), alerts = [], navigations = [], remembered = [], requests = [];
  let cursor = 0, effects = [], timerId = 0, key = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  class ApiError extends Error { constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; } }
  const clock = load('src/utils/bookingClock.ts');
  const screen = load('src/screens/BookingScreen.tsx', {
    react: React,
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(x => [x, x])),
      StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/native': { usePreventRemove() {} }, '../theme': load('src/theme/index.ts'),
    '../data/catalogModels': { formatCurrency: String }, '../components/SelectListSheet': { __esModule: true, default: 'SelectList' },
    '../components/BookingRecurrence': { __esModule: true, default: 'Recurrence' },
    '../context/BookingsContext': { useBookings: () => ({ addBooking: () => assert.fail('must use recurring endpoint'), reload: refresh,
      rememberBookings: (rows, generation) => remembered.push({ rows, generation }) }) },
    '../context/AuthContext': { useAuth: () => ({ isLoggedIn: true, user: { id: 'customer' } }) },
    '../api/client': { ApiError, createIdempotencyKey: () => `key-${++key}`, getApiSessionGeneration: () => 1, subscribeApiAccessToken: () => () => {} },
    '../api/bookings': { bookingsApi: {
      availableSlots: async () => ({ slots: [{ start: '2099-11-01T03:00:00Z', available: true }] }),
      previewPrice: async () => ({ finalAmount: 100 }), selfBookingPolicy: async () => ({ selfBookingAllowed: true }),
    } },
    '../api/recurring': { recurringApi: { preview: async () => ({ availableCount: 4, conflictCount: 0, occurrences: [] }),
      create: async (body, idempotencyKey) => { requests.push({ body: plain(body), idempotencyKey }); return create(ApiError, requests.length); } } },
    '../api/services': { servicesApi: { list: async () => [{ id: 'service', name: 'Chăm sóc da', price: 100, variants: [] }] } },
    '../api/staff': { staffApi: { publicByServices: async () => [] } },
    '../navigation/navigationRef': { navigationRef: {} }, '../utils/bookingClock': clock,
    '../utils/bookingRecurrence': load('src/utils/bookingRecurrence.ts', { './bookingClock': clock }),
  }, { setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) }).default;
  const props = { route: { params: { branchId: 'branch', shopName: 'Salon', addresses: ['Địa chỉ'], serviceIds: ['service'],
    service: { id: 'service', name: 'Chăm sóc da', price: 100, originalPrice: 100, duration: '30 phút' } } },
    navigation: { navigate: (...args) => navigations.push(args) } };
  let tree;
  function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...node.children.flatMap(nodes)]; }
  const render = () => { cursor = 0; tree = screen(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return nodes(tree); };
  const find = predicate => render().find(predicate);
  const pump = async () => { for (let i = 0; i < 7; i++) { render(); const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await new Promise(setImmediate); } };
  const press = async label => { const node = find(node => node.props.accessibilityLabel === label); assert.ok(node, label); assert.ok(!node.props.disabled, label); node.props.onPress(); await pump(); };
  return { alerts, navigations, remembered, requests, find, pump, press,
    async ready() { await pump(); await press('10:00, còn trống'); find(node => node.type === 'Recurrence').props.onEnabled(true); await pump(); },
    async submit() { const next = find(node => node.type === 'TouchableOpacity' && node.children.some(child => child?.children?.includes('Xem lại đặt lịch'))); assert.ok(next && !next.props.disabled); next.props.onPress(); await pump(); await press('Xác nhận chuỗi lịch'); },
  };
}

test('settled recurring quota failure unlocks an uncertain retry while retaining its exact request', async () => {
  const h = checkoutHarness((ApiError, call) => {
    if (call === 1) throw new ApiError('offline', 0);
    throw new ApiError('Combo đã hết lượt sử dụng', 409, { code: 'RECURRING_CREATE_ROLLED_BACK' });
  });
  await h.ready(); await h.submit();
  await h.press('Thử lại yêu cầu đặt lịch đã gửi');
  assert.deepEqual(h.requests[0], h.requests[1]);
  assert.equal(h.find(node => node.props.accessibilityLabel === 'Thử lại yêu cầu đặt lịch đã gửi'), undefined);
  assert.equal(h.find(node => node.props.accessibilityLabel === 'Ghi chú cho cơ sở, không bắt buộc').props.editable, true);
  assert.match(h.alerts.at(-1)[1], /hoàn tác/);
});

test('confirmed recurring bookings reach success even when the list refresh stalls or fails', async () => {
  for (const refresh of [() => new Promise(() => {}), () => Promise.reject(new Error('offline'))]) {
    const rows = [{ id: 'booking-1', status: 'PENDING', appointmentDate: '2099-11-01', appointmentStartTime: '10:00' }];
    const h = checkoutHarness(() => ({ id: 'plan', createdOccurrenceCount: 1, bookings: rows }), refresh);
    await h.ready(); await h.submit();
    assert.deepEqual(h.remembered, [{ rows, generation: 1 }]);
    assert.deepEqual(plain(h.navigations), [['BookingSuccess', { bookingId: 'booking-1' }]]);
    assert.equal(h.requests.length, 1);
  }
});
