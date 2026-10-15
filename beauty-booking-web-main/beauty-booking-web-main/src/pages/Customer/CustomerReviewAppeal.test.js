import * as bookingAffordances from '../../utils/bookingAffordances.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { formatBookingWallDate } from '../../utils/bookingWallTime.js';

function harness(pending = false, lostResponse = false, attendance = null, options = {}) {
  const review = { id: 'own-review', status: 'HIDDEN', overallRating: 4, comment: 'QA review', hasPendingAppeal: pending };
  const booking = { id: 'own-booking', bookingCode: 'BB-QA', appointmentDate: '2026-10-03', bookingServices: [], review, ...attendance };
  const cells = []; let cursor = 0, sends = 0, reads = 0, generation = 0;
  let state = { accessToken: 'A', user: { id: 'A' } }, boundary, response;
  const calls = [], requests = [];
  const store = fn => fn(state); store.getState = () => state;
  const initialRows = options.rows || [booking];
  const jsx = (type, props) => ({ type, props });
  const react = { useState(initial) { const index = cursor++; cells[index] ??= { value: index === 0 ? initialRows : index === 7 ? false : initial };
    return [cells[index].value, value => { cells[index].value = typeof value === 'function' ? value(cells[index].value) : value; }]; },
    useEffect() {},
    useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
    useCallback(fn, deps) { const index = cursor++; const old = cells[index];
      if (!old || deps.some((dep, i) => dep !== old.deps[i])) cells[index] = { fn, deps };
      return cells[index].fn;
    }, useMemo: fn => fn() };
  const api = { bookingsApi: { async myAppointments(tab) { reads++; calls.push(tab); if (options.deferred) return new Promise((resolve, reject) => requests.push({ resolve, reject })); return response || { data: [{ ...booking, review: { ...review, hasPendingAppeal: true } }] }; } },
    platformPolicyApi: { async getPublic() { return {}; } }, reviewsApi: { async appeal() { sends++; if (lostResponse) throw new Error('Controlled lost response after commit'); } } };
  const module = { exports: {} };
  const modules = { '../../utils/bookingAffordances': bookingAffordances, react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'lucide-react': { MessageSquareText: 'Icon', Star: 'Star' },
    '../../store/authStore': { useAuthStore: store }, '../../utils/sessionGeneration': { captureSessionGeneration: () => generation, isSessionGenerationCurrent: lease => lease === generation },
    '../../hooks/useCustomerBookingRefresh': { useCustomerBookingRefresh: (refresh, rows) => { boundary = { refresh, rows }; } },
    'react-hot-toast': { default: { success() {}, error() {} }, __esModule: true }, '../../api/apiClient': api,
    '../../components/customer/ReviewModal': { ReviewModal: 'ReviewModal' }, '../../utils/bookingWallTime': { formatBookingWallDate },
    '../../components/ui': Object.fromEntries(['Badge','Button','Card','Dialog','EmptyState','ErrorState','Field','Page','PageHeader','Select','Skeleton','Textarea'].map(x => [x, x])) };
  vm.runInNewContext(transformSync(readFileSync(new URL('./CustomerReviews.jsx', import.meta.url), 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code,
    { module, exports: module.exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; } });
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children), ...nodes(value.props?.footer), ...nodes(value.props?.actions)];
  const render = () => { cursor = 0; return nodes(module.exports.CustomerReviews()); };
  const open = () => {
    render().find(n => n.type === 'Button' && n.props.children === 'Khiếu nại').props.onClick();
    render().find(n => n.type === 'Textarea').props.onChange({ target: { value: 'QA explanation retained' } });
  };
  return { render, open, sends: () => sends, reads: () => reads, calls, requests,
    boundary: () => boundary, response: value => { response = value; },
    switchAccount: () => { generation++; state = { accessToken: 'B', user: { id: 'B' } }; },
  };
}

test('pending appeal loaded from server removes duplicate invitation after reload', () => {
  const h = harness(true), nodes = h.render();
  assert.ok(!nodes.some(n => n.type === 'Button' && n.props.children === 'Khiếu nại'));
  assert.ok(nodes.some(n => n.type === 'p' && String(n.props.children).includes('Khiếu nại đang chờ xử lý')));
});

test('successful appeal refetches persisted state before presenting further actions', async () => {
  const h = harness(); h.open();
  await h.render().find(n => n.type === 'Button' && n.props.children === 'Gửi khiếu nại').props.onClick();
  assert.equal(h.sends(), 1); assert.equal(h.reads(), 1);
  assert.ok(!h.render().some(n => n.type === 'Button' && n.props.children === 'Khiếu nại'));
});

test('lost committed response retains reason but disables resubmission after server reconciliation', async () => {
  const h = harness(false, true); h.open();
  await h.render().find(n => n.type === 'Button' && n.props.children === 'Gửi khiếu nại').props.onClick();
  assert.equal(h.sends(), 1); assert.equal(h.reads(), 1);
  const nodes = h.render();
  assert.equal(nodes.find(n => n.type === 'Textarea').props.value, 'QA explanation retained');
  assert.equal(nodes.find(n => n.type === 'Button' && n.props.children === 'Gửi khiếu nại').props.disabled, true);
  assert.ok(nodes.find(n => n.type === 'Dialog').props.open);
});


test('actual reviews JSX invites elapsed attendance only when server canReview permits it', () => {
  const count = attendance => harness(false, false, { status: 'CHECKED_IN', scheduleElapsed: true, scheduleBucket: 'HISTORY', review: null, ...attendance }).render()
    .filter(node => node.type === 'Button' && node.props.children?.includes('Viết đánh giá')).length;
  assert.equal(count({ canReview: true }), 1);
  assert.equal(count({ canReview: false }), 0);
  assert.equal(count({}), 0);
  assert.equal(count({ status: 'COMPLETED' }), 1);
  assert.equal(count({ status: 'COMPLETED', canReview: false }), 0);
});


test('reviews retains upcoming attendance for the boundary hook while hiding it from history', async () => {
  const arriving = { id: 'next', status: 'CHECKED_IN', scheduleBucket: 'UPCOMING', scheduleElapsed: false, scheduledEndAt: '2026-10-13T03:00:01Z', canReview: false, review: null };
  const h = harness(false, false, null, { rows: [arriving] });
  const cards = () => h.render().filter(n => n.type === 'Card' && n.props.as === 'article');
  assert.equal(cards().length, 0);
  const refresh = h.boundary().refresh;
  h.render(); assert.equal(h.boundary().refresh, refresh, 'GET callback remains stable across rerenders');
  h.response({ data: [arriving], serverNow: '2026-10-13T03:00:00Z' });
  await refresh(); cards();
  assert.deepEqual(h.calls, ['all']);
  assert.equal(h.boundary().rows.length, 1);
  assert.equal(h.boundary().rows[0].serverNow, '2026-10-13T03:00:00Z');
  h.response({ data: [{ ...arriving, scheduleBucket: 'HISTORY', scheduleElapsed: true, canReview: true }], serverNow: '2026-10-13T03:00:01.001Z' });
  await h.boundary().refresh();
  assert.equal(cards().length, 1);
  assert.equal(h.render().filter(n => n.type === 'Button' && n.props.children?.includes('Viết đánh giá')).length, 1);
  assert.equal(h.boundary().rows[0].status, 'CHECKED_IN');
  assert.deepEqual(h.calls, ['all', 'all']);
});

test('reviews refresh fences older success and failure after new reads or account changes', async () => {
  for (const failure of [false, true]) {
    const h = harness(false, false, null, { rows: [], deferred: true }); h.render();
    const old = h.boundary().refresh();
    const next = h.boundary().refresh();
    h.requests[1].resolve({ data: [{ id: 'new', status: 'COMPLETED', canReview: true }], serverNow: '2026-10-13T03:00:00Z' });
    await next;
    if (failure) h.requests[0].reject(Error('stale error')); else h.requests[0].resolve({ data: [{ id: 'old', status: 'COMPLETED' }] });
    await old; h.render(); assert.equal(h.boundary().rows[0].id, 'new');
    const previousAccount = h.boundary().refresh(); h.switchAccount();
    if (failure) h.requests[2].reject(Error('old account')); else h.requests[2].resolve({ data: [{ id: 'foreign', status: 'COMPLETED' }] });
    await previousAccount; h.render(); assert.equal(h.boundary().rows.length, 0);
    assert.ok(!h.render().some(n => n.type === 'Card' && n.props.as === 'article'));
  }
});

test('reviews display filters exclude unarrived and cancelled rows but retain existing review/audit history', () => {
  const rows = [
    { id: 'future', status: 'CONFIRMED', canReview: false },
    { id: 'cancelled', status: 'CANCELLED', scheduleBucket: 'CANCELLED', canReview: false },
    { id: 'history', status: 'CHECKED_IN', scheduleBucket: 'HISTORY', canReview: false },
    { id: 'legacy', status: 'COMPLETED' },
    { id: 'reviewed', status: 'CHECKED_IN', review: { id: 'review', status: 'HIDDEN' } },
  ];
  const h = harness(false, false, null, { rows });
  const cards = () => h.render().filter(n => n.type === 'Card' && n.props.as === 'article');
  assert.equal(cards().length, 3);
  h.render().find(n => n.type === 'Select').props.onChange({ target: { value: 'PENDING_REVIEW' } });
  assert.equal(cards().length, 1);
  h.render().find(n => n.type === 'Select').props.onChange({ target: { value: 'REVIEWED' } });
  assert.equal(cards().length, 1);
  assert.equal(h.boundary().rows.length, 5);
});
