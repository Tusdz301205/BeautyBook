const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports,
    require: name => { assert.ok(name in modules, name); return modules[name]; },
  });
  return module.exports;
}
const form = load('utils/reviewForm.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const services = [
  { id: 'booked-cut', serviceName: 'Cắt tóc', staffId: 'staff-a', staffName: 'An', status: 'COMPLETED' },
  { id: 'booked-wash', serviceName: 'Gội đầu', staffId: 'staff-b', staffName: 'Bình', status: 'SCHEDULED' },
];

test('overall score never fills item scores; each booked line requires its own integer score', () => {
  const drafts = form.createServiceReviewDrafts(services);
  assert.deepEqual(plain(drafts), {
    'booked-cut': { rating: 0, comment: '' }, 'booked-wash': { rating: 0, comment: '' },
  });
  assert.equal(form.buildReviewInput('booking', 5, '', services, drafts), null);
  drafts['booked-cut'].rating = 2;
  assert.equal(form.buildReviewInput('booking', 5, '', services, drafts), null);
  for (const invalid of [0, -1, 6, 2.5, NaN]) {
    drafts['booked-wash'].rating = invalid;
    assert.equal(form.buildReviewInput('booking', 5, '', services, drafts), null);
  }
  assert.equal(drafts['booked-cut'].rating, 2);
});

test('two services submit distinct scores and comments with their own booked line and provider IDs', () => {
  const drafts = {
    'booked-cut': { rating: 2, comment: '  Cắt chưa đều  ' },
    'booked-wash': { rating: 5, comment: '  Gội rất tốt  ' },
  };
  assert.deepEqual(plain(form.buildReviewInput('booking', 4, '  Trải nghiệm chung  ', services, drafts)), {
    bookingId: 'booking', overallRating: 4, comment: 'Trải nghiệm chung',
    serviceRatings: [
      { bookingServiceId: 'booked-cut', staffId: 'staff-a', rating: 2, comment: 'Cắt chưa đều' },
      { bookingServiceId: 'booked-wash', staffId: 'staff-b', rating: 5, comment: 'Gội rất tốt' },
    ],
  });
  assert.equal(drafts['booked-cut'].comment, '  Cắt chưa đều  ');
});

test('same service/provider on multiple booked lines stays independent, and reordered lines keep their IDs', () => {
  const repeated = services.map(item => ({ ...item, serviceName: 'Cắt tóc', staffId: 'staff-a' }));
  const drafts = { 'booked-cut': { rating: 1, comment: 'Lần đầu' }, 'booked-wash': { rating: 4, comment: 'Lần sau' } };
  const payload = form.buildReviewInput('booking', 3, '', [...repeated].reverse(), drafts);
  assert.deepEqual(plain(payload.serviceRatings).map(item => [item.bookingServiceId, item.rating, item.comment]),
    [['booked-wash', 4, 'Lần sau'], ['booked-cut', 1, 'Lần đầu']]);
});

test('missing staff produces no invented provider; optional blank comments are omitted', () => {
  const items = [{ id: 'unassigned', serviceName: 'Dịch vụ', status: 'SCHEDULED' }];
  const payload = form.buildReviewInput('booking', 5, ' ', items, { unassigned: { rating: 3, comment: '  ' } });
  assert.deepEqual(plain(payload), {
    bookingId: 'booking', overallRating: 5, serviceRatings: [{ bookingServiceId: 'unassigned', rating: 3 }],
  });
  assert.equal(Object.hasOwn(payload.serviceRatings[0], 'staffId'), false);
});

test('only explicitly skipped/cancelled lines are excluded; scheduled check-in lines still require scores', () => {
  const items = [...services,
    { id: 'skip', serviceName: 'Bỏ qua', status: 'SKIPPED' },
    { id: 'cancel', serviceName: 'Đã hủy', status: 'CANCELLED' }];
  assert.deepEqual(Object.keys(form.createServiceReviewDrafts(items)), ['booked-cut', 'booked-wash']);
  const drafts = { 'booked-cut': { rating: 4, comment: '' }, 'booked-wash': { rating: 3, comment: '' }, skip: { rating: 5, comment: 'stale' } };
  assert.deepEqual(plain(form.buildReviewInput('booking', 4, '', items, drafts).serviceRatings).map(item => item.bookingServiceId),
    ['booked-cut', 'booked-wash']);
  assert.equal(form.buildReviewInput('booking', 4, '', items, { 'booked-cut': drafts['booked-cut'] }), null);
});

test('overall comment minimum is trimmed and enforced independently of optional service comments', () => {
  const drafts = { 'booked-cut': { rating: 4, comment: '' }, 'booked-wash': { rating: 3, comment: '' } };
  assert.equal(form.buildReviewInput('booking', 4, '  abc  ', services, drafts, 4), null);
  assert.ok(form.buildReviewInput('booking', 4, '  abcd  ', services, drafts, 4));
  assert.equal(form.buildReviewInput('booking', 0, 'abcd', services, drafts, 4), null);
  assert.equal(form.buildReviewInput('booking', 4, 'abcd', services), null);
  // Newly fetched booked lines cannot inherit a removed line's score.
  assert.equal(form.buildReviewInput('booking', 4, '', [...services, { id: 'new', serviceName: 'Mới' }], drafts), null);
});

function sheetHarness() {
  const slots = [];
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) { slots[index] = deps; effect(); }
    },
  };
  const sheet = load('components/WriteReviewSheet.tsx', {
    react: React,
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../theme': { colors: {}, layout: { touch: 44 }, space: {}, type: {} },
    '../ui': { AppButton: 'Button', SheetModal: 'Sheet', TextField: 'Field' },
    '../utils/reviewForm': form,
  }).default;
  function nodes(tree) {
    return tree == null || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...tree.children.flatMap(nodes)];
  }
  const submissions = [];
  const props = { visible: true, services, onClose() {}, onSubmit: (...args) => submissions.push(args) };
  return {
    props, submissions,
    render() { cursor = 0; const tree = sheet(props); return { nodes: nodes(tree), submit: tree.props.footer.props }; },
  };
}

test('sheet selection and comments are independent; submit is locked until every item is selected', () => {
  const h = sheetHarness();
  h.render();
  const select = (label, score) => {
    h.render().nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel.startsWith(`${label}: ${score} sao`)).props.onPress();
  };
  select('Đánh giá chung', 4);
  assert.equal(h.render().submit.disabled, true);
  select('Cắt tóc · An', 2);
  assert.equal(h.render().submit.disabled, true);
  select('Gội đầu · Bình', 5);
  h.render().nodes.find(node => node.type === 'Field' && node.props.label === 'Nhận xét · Cắt tóc · An').props.onChangeText('Chưa đều');
  h.render().nodes.find(node => node.type === 'Field' && node.props.label === 'Nhận xét · Gội đầu · Bình').props.onChangeText('Rất tốt');
  assert.equal(h.render().submit.disabled, false);
  h.render().submit.onPress();
  const [score, comment, drafts] = h.submissions[0];
  const payload = form.buildReviewInput('booking', score, comment, services, drafts);
  assert.deepEqual(plain(payload.serviceRatings).map(item => [item.bookingServiceId, item.staffId, item.rating, item.comment]),
    [['booked-cut', 'staff-a', 2, 'Chưa đều'], ['booked-wash', 'staff-b', 5, 'Rất tốt']]);
  h.props.isSubmitting = true;
  assert.equal(h.render().submit.disabled, true);
  assert.ok(h.render().nodes.filter(node => node.type === 'Pressable').every(node => node.props.disabled));
  h.props.isSubmitting = false;
  h.props.visible = false; h.render();
  h.props.visible = true; h.render();
  assert.equal(h.render().submit.disabled, true);
  assert.ok(h.render().nodes.filter(node => node.type === 'Pressable').every(node => !node.props.accessibilityState.checked));
});

function detailHarness(overrides = {}, context = {}) {
  const creates = [];
  const theme = load('theme/index.ts');
  const booking = {
    id: 'booking', rawStatus: 'CHECKED_IN', status: 'completed', canReview: true, reviewed: false,
    bookingServices: services, totalPrice: 100, ...overrides,
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => [initial, () => {}], useEffect() {}, useCallback: fn => fn,
  };
  const screen = load('screens/AppointmentDetailScreen.tsx', {
    react: React,
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'Touch', StyleSheet: { create: x => x }, Alert: { alert() {} }, Linking: {} },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/native': { useFocusEffect() {} }, '../theme': theme,
    '../data/catalogModels': { formatCurrency: String }, '../data/appointments': { bookingStatusMeta: () => ({ tone: 'neutral' }) },
    '../context/BookingsContext': { useBookings: () => ({ getBooking: () => booking, reload: async () => {}, isLoading: false, ...context }) },
    '../components/WriteReviewSheet': { __esModule: true, default: 'Review' },
    '../api/reviews': { reviewsApi: { create: async input => creates.push(input) } },
    '../api/platformSettings': { platformSettingsApi: {} }, '../utils/bookingTiming': { serviceTimingLines: () => [] },
    '../hooks/useOperationalTime': { useOperationalTime: () => NaN },
    '../utils/bookingOperationalTime': { operationalTimeLabel: () => '' }, '../utils/reviewForm': form,
  }).default;
  const tree = screen({ route: { params: { id: 'booking', isReal: true } }, navigation: {} });
  function findReview(tree) {
    if (!tree || typeof tree !== 'object') return undefined;
    if (Array.isArray(tree)) return tree.map(findReview).find(Boolean);
    return tree.type === 'Review' ? tree : findReview(tree.children);
  }
  return { creates, review: findReview(tree) };
}

test('detail submit sends separate fields to API and retains server/status/loading/account guards', async () => {
  const drafts = { 'booked-cut': { rating: 1, comment: 'Cắt chưa tốt' }, 'booked-wash': { rating: 5, comment: 'Rất tốt' } };
  for (const [overrides, context, allowed] of [
    [{}, {}, true], [{ rawStatus: 'COMPLETED' }, {}, true],
    [{ canReview: false }, {}, false], [{ canReview: undefined }, {}, false],
    [{ rawStatus: 'CANCELLED' }, {}, false], [{ rawStatus: 'IN_PROGRESS' }, {}, false],
    [{ status: 'upcoming' }, {}, false], [{ reviewed: true }, {}, false],
    [{}, { isLoading: true }, false], [{}, { error: 'Access denied' }, false],
  ]) {
    const h = detailHarness(overrides, context);
    await h.review.props.onSubmit(4, 'Chung', drafts);
    assert.equal(h.creates.length, allowed ? 1 : 0);
    if (allowed) assert.deepEqual(plain(h.creates[0]), {
      bookingId: 'booking', overallRating: 4, comment: 'Chung', serviceRatings: [
        { bookingServiceId: 'booked-cut', staffId: 'staff-a', rating: 1, comment: 'Cắt chưa tốt' },
        { bookingServiceId: 'booked-wash', staffId: 'staff-b', rating: 5, comment: 'Rất tốt' },
      ],
    });
  }
  const incomplete = detailHarness();
  await incomplete.review.props.onSubmit(5, 'Chung', { 'booked-cut': drafts['booked-cut'] });
  assert.equal(incomplete.creates.length, 0);
  const signedOut = detailHarness({}, { getBooking: () => undefined });
  assert.equal(signedOut.review, undefined);
});
