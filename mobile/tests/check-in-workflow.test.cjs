const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, Intl, Number });
  return module.exports;
}
const schedule = load('utils/bookingSchedule.ts');
const mapper = load('mappers/booking.ts', { '../utils/bookingSchedule': schedule });
const theme = load('theme/index.ts');
const appointments = load('data/appointments.ts', { '../theme': theme });
const timing = load('utils/bookingTiming.ts');
const raw = extra => ({ id: 'booking', status: 'CHECKED_IN', appointmentDate: '2026-10-07', appointmentStartTime: '10:00',
  attendanceWorkflow: 'CHECK_IN_ONLY', scheduledStartAt: '2026-10-07T03:00:00Z', scheduledEndAt: '2026-10-07T04:00:00Z',
  scheduleElapsed: true, scheduleBucket: 'HISTORY', canReview: true, serverNow: '2026-10-07T04:00:01Z',
  bookingServices: [{ id: 'service', status: 'SCHEDULED', actualStartedAt: null, actualCompletedAt: null, actualStoppedAt: null, actualTimingSource: 'UNAVAILABLE' }], ...extra });

test('checked-in HISTORY uses completed wire group while retaining raw label, metadata and null actuals', () => {
  const booking = raw(), mapped = mapper.mapBooking(booking);
  assert.equal(mapped.status, 'completed'); assert.equal(mapped.rawStatus, 'CHECKED_IN');
  for (const key of ['attendanceWorkflow', 'scheduledStartAt', 'scheduledEndAt', 'scheduleElapsed', 'scheduleBucket', 'canReview', 'serverNow']) assert.equal(mapped[key], booking[key]);
  const appointment = appointments.mapBookingsToAppointments([mapped])[0];
  assert.equal(appointments.bookingStatusMeta(appointment.status, appointment.rawStatus).label, 'Đã đến · Lịch đã qua');
  assert.equal(appointments.STATUS_META.completed.label, 'Lịch sử');
  assert.equal(appointments.isPastUpcoming(appointment), false);
  assert.ok(timing.serviceTimingLines(mapped.bookingServices[0]).includes('Chưa có mốc thời gian thực tế được ghi nhận'));
  assert.equal(mapped.bookingServices[0].actualStartedAt, null); assert.equal(mapped.bookingServices[0].actualCompletedAt, null);
  assert.equal(booking.status, 'CHECKED_IN'); assert.equal(booking.bookingServices[0].status, 'SCHEDULED');
});
test('rolling missing metadata is conservative; cancellation and legacy IN_PROGRESS never become elapsed history', () => {
  assert.equal(mapper.mapBookingStatus('CHECKED_IN'), 'upcoming');
  assert.equal(mapper.mapBookingStatus('CHECKED_IN', { scheduleElapsed: true }), 'completed');
  assert.equal(mapper.mapBookingStatus('CHECKED_IN', { scheduleBucket: 'UPCOMING', scheduleElapsed: false }), 'upcoming');
  assert.equal(mapper.mapBookingStatus('CHECKED_IN', { scheduleBucket: 'CANCELLED', scheduleElapsed: true }), 'upcoming');
  for (const status of ['CANCELLED', 'NO_SHOW', 'REJECTED', 'EXPIRED']) assert.equal(mapper.mapBooking(raw({ status })).status, 'cancelled');
  assert.equal(mapper.mapBooking(raw({ status: 'IN_PROGRESS' })).status, 'upcoming');
  assert.equal(mapper.mapBooking(raw({ status: 'COMPLETED' })).status, 'completed');
  assert.equal(appointments.bookingStatusMeta('completed', 'COMPLETED').label, 'Hoàn thành');
});
test('refresh uses booking scheduled end and server clock, never item ends or device time', () => {
  const row = raw({ scheduleElapsed: false, scheduleBucket: 'UPCOMING', serverNow: '2026-10-07T03:59:00Z', itemEndAt: '2026-10-07T03:10:00Z' });
  assert.equal(schedule.nextScheduleRefresh([row]), 60001);
  assert.equal(schedule.nextScheduleRefresh([{ ...row, serverNow: row.scheduledEndAt }]), 1);
  assert.equal(schedule.nextScheduleRefresh([{ ...row, scheduledEndAt: null }]), null);
  assert.equal(schedule.nextScheduleRefresh([{ ...row, scheduledEndAt: '2026-10-07T04:00:00' }]), null);
  assert.equal(schedule.nextScheduleRefresh([{ ...row, serverNow: undefined }]), null);
  assert.equal(schedule.nextScheduleRefresh([raw()]), null);
  assert.equal(schedule.nextScheduleRefresh([{ ...row, status: 'CANCELLED' }]), null);
});
test('legacy actual audit survives the new projection and correction source remains explicit', () => {
  for (const source of ['SERVICE_ADJUSTMENT', 'ACTUAL_TIME_CORRECTION']) {
    const original = raw({ status: 'COMPLETED', bookingServices: [{ id: 'service', status: 'COMPLETED', actualStartedAt: '2026-10-07T03:10:00Z',
      actualCompletedAt: '2026-10-07T03:50:00Z', actualStoppedAt: null, actualTimingSource: source }] });
    const mapped = mapper.mapBooking(original);
    assert.equal(mapped.bookingServices[0].actualTimingSource, source);
    assert.equal(mapped.bookingServices[0].actualStartedAt, original.bookingServices[0].actualStartedAt);
    const lines = timing.serviceTimingLines(mapped.bookingServices[0], 'Asia/Bangkok');
    assert.ok(lines.some(line => /Bắt đầu thực tế:.*10:10:00/.test(line)));
    assert.ok(lines.some(line => /Hoàn thành thực tế:.*10:50:00/.test(line)));
  }
});

function detailHarness(booking) {
  const creates = [];
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState: x => [x, () => {}], useEffect() {}, useCallback: fn => fn };
  const screen = load('screens/AppointmentDetailScreen.tsx', {
    react: React, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: x => x }, Alert: { alert() {} }, Linking: {} },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Icon' }, '@react-navigation/native': { useFocusEffect() {} },
    '../theme': theme, '../data/catalogModels': { formatCurrency: String }, '../data/appointments': appointments,
    '../context/BookingsContext': { useBookings: () => ({ getBooking: () => booking, reload: async () => {}, isLoading: false }) },
    '../components/WriteReviewSheet': { __esModule: true, default: 'Review' }, '../api/reviews': { reviewsApi: { create: async body => creates.push(body) } },
    '../utils/reviewForm': load('utils/reviewForm.ts'),
    '../api/platformSettings': { platformSettingsApi: {} }, '../utils/bookingTiming': timing,
    '../hooks/useOperationalTime': { useOperationalTime: () => NaN }, '../utils/bookingOperationalTime': load('utils/bookingOperationalTime.ts'),
  }).default;
  const tree = screen({ route: { params: { id: 'booking', isReal: true } }, navigation: {} });
  function nodes(tree) { return tree == null || typeof tree === 'boolean' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree !== 'object' ? [tree] : [tree, ...tree.children.flatMap(nodes)]; }
  return { nodes: nodes(tree), creates };
}
test('customer review action and submit handler require server canReview and eligible raw status', async () => {
  for (const [extra, allowed] of [[{}, true], [{ status: 'COMPLETED' }, true], [{ canReview: false }, false], [{ canReview: undefined }, false],
    [{ status: 'CANCELLED' }, false], [{ status: 'IN_PROGRESS' }, false], [{ scheduleBucket: 'UPCOMING', scheduleElapsed: false }, false], [{ review: { id: 'review' } }, false]]) {
    const h = detailHarness(mapper.mapBooking(raw(extra)));
    assert.equal(h.nodes.includes('Viết đánh giá'), allowed);
    await h.nodes.find(node => node?.type === 'Review').props.onSubmit(5, 'Trải nghiệm', { service: { rating: 4, comment: 'Nhận xét riêng' } });
    assert.equal(h.creates.length, allowed ? 1 : 0);
    if (allowed) {
      assert.equal(h.creates[0].overallRating, 5);
      assert.equal(h.creates[0].serviceRatings[0].rating, 4);
      assert.equal(h.creates[0].serviceRatings[0].comment, 'Nhận xét riêng');
    }
    assert.ok(!h.nodes.some(node => typeof node === 'string' && /Lịch hẹn đã hoàn thành/.test(node) && extra.status !== 'COMPLETED'));
  }
});
