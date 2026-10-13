import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { formatBookingWallDate } from '../../utils/bookingWallTime.js';

function harness(pending = false, lostResponse = false) {
  const review = { id: 'own-review', status: 'HIDDEN', overallRating: 4, comment: 'QA review', hasPendingAppeal: pending };
  const booking = { id: 'own-booking', bookingCode: 'BB-QA', appointmentDate: '2026-10-03', bookingServices: [], review };
  const cells = []; let cursor = 0, sends = 0, reads = 0;
  const jsx = (type, props) => ({ type, props });
  const react = { useState(initial) { const index = cursor++; cells[index] ??= { value: index === 0 ? [booking] : index === 7 ? false : initial };
    return [cells[index].value, value => { cells[index].value = typeof value === 'function' ? value(cells[index].value) : value; }]; },
    useEffect() {}, useMemo: fn => fn() };
  const api = { bookingsApi: { async myAppointments() { reads++; return { data: [{ ...booking, review: { ...review, hasPendingAppeal: true } }] }; } },
    platformPolicyApi: { async getPublic() { return {}; } }, reviewsApi: { async appeal() { sends++; if (lostResponse) throw new Error('Controlled lost response after commit'); } } };
  const module = { exports: {} };
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'lucide-react': { MessageSquareText: 'Icon', Star: 'Star' },
    'react-hot-toast': { default: { success() {}, error() {} }, __esModule: true }, '../../api/apiClient': api,
    '../../components/customer/ReviewModal': { ReviewModal: 'ReviewModal' }, '../../utils/bookingWallTime': { formatBookingWallDate },
    '../../components/ui': Object.fromEntries(['Badge','Button','Card','Dialog','EmptyState','ErrorState','Field','Page','PageHeader','Select','Skeleton','Textarea'].map(x => [x, x])) };
  vm.runInNewContext(transformSync(readFileSync(new URL('./CustomerReviews.jsx', import.meta.url), 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code,
    { module, exports: module.exports, require: name => { assert.ok(name in modules, `Unexpected import ${name}`); return modules[name]; } });
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children), ...nodes(value.props?.footer)];
  const render = () => { cursor = 0; return nodes(module.exports.CustomerReviews()); };
  const open = () => {
    render().find(n => n.type === 'Button' && n.props.children === 'Khiếu nại').props.onClick();
    render().find(n => n.type === 'Textarea').props.onChange({ target: { value: 'QA explanation retained' } });
  };
  return { render, open, sends: () => sends, reads: () => reads };
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
