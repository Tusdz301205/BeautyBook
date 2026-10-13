import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as product from '../../utils/operationsProduct.js';
import { FINANCE_WORKSPACE_ENABLED } from '../../config/featureAvailability.js';

const nodes = (value) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
const textOf = (value) => value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : Array.isArray(value) ? value.map(textOf).join(' ') : textOf(value.props?.children);
const branch = (id, businessId = 'biz', extra = {}) => ({ id, name: `Chi nhánh ${id}`, businessId, status: 'ACTIVE', operationalStatus: 'ACTIVE', ...extra });
const branches = [branch('a'), branch('b'), branch('c'), branch('external', 'other'), branch('paused', 'biz', { operationalStatus: 'PAUSED' })];
const item = (id = 'i', branchId = 'a', serviceId = 's') => ({ id, status: 'PENDING', bookingId: 'private-booking-uuid', booking: { branchId, bookingServices: [{ serviceId, businessServiceId: 'catalog', durationMinutes: 30, status: 'SCHEDULED' }] } });
const staff = (id = 'private', branchId = 'a', serviceIds = ['s'], extra = {}) => ({ id, fullName: `Tên ${id}`, status: 'ACTIVE', isBookable: true, publicVisible: false, branch: { id: branchId, name: `Chi nhánh ${branchId}`, businessId: 'biz' }, services: serviceIds.map(id => ({ id })), ...extra });
const baseForm = (extra = {}) => ({ itemId: 'i', resolution: 'REASSIGN', reason: 'Lý do', replacementStaffId: '', replacementBranchId: '', proposedStartAt: '', ...extra });

// Real compiled JSX, dependency-aware effects and deferred API reads; no server
// or browser writes. Components remain opaque until deliberately executed.
function harness(file, name = 'default', finance = false) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
  const cells = [], effects = [], calls = [], errors = [], submissions = []; let cursor = 0, dirty = false, props, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [cells[i].value, update => { const v = typeof update === 'function' ? update(cells[i].value) : update; if (!Object.is(v, cells[i].value)) { cells[i].value = v; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { deps, value: fn() }; return cells[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(cells[i]?.pendingDeps || cells[i]?.deps, deps)) { cells[i] = { ...cells[i], pendingDeps: deps }; effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() }; }); } },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const defer = name => (...args) => new Promise((resolve, reject) => calls.push({ name, args, resolve, reject }));
  const api = { staffApi: { getAll: defer('staff') }, servicesApi: { getManage: defer('services') }, impactApi: { detail: defer('detail'), resolve: defer('resolve'), resolveBatch: defer('batch') }, branchesApi: {} };
  const jsx = (type, props) => ({ type, props }); const names = new Proxy({}, { get: (_, name) => name });
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'lucide-react': names,
    'react-hot-toast': { error: message => errors.push(message) }, 'react-router-dom': {},
    '../../api/apiClient': api, '../../config/featureAvailability': { FINANCE_WORKSPACE_ENABLED: finance },
    '../../utils/operationsProduct': product, '../../utils/operationsScope': {}, '../../store/authStore': {},
    '../../components/salon/OperationsResolutionForm': { __esModule: true, default: 'OperationsResolutionForm' },
    '../ui': names, '../../components/ui': names,
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, require: key => { assert.ok(key in modules, key); return modules[key]; } });
  function render(next = props, flush = true) {
    props = next; let passes = 0;
    do { assert.ok(++passes < 20, 'bounded render loop'); dirty = false; cursor = 0; tree = module.exports[name](props); if (flush) while (effects.length) effects.shift()(); } while (dirty && flush);
    return nodes(tree);
  }
  const setForm = update => { props = { ...props, form: typeof update === 'function' ? update(props.form) : update }; dirty = true; };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); return render(); };
  return { render, settle, calls, errors, submissions, setForm, get props() { return props; }, get tree() { return tree; }, submit: payload => submissions.push(payload), unmount: () => cells.forEach(cell => cell.cleanup?.()) };
}
const formHarness = (extra = {}, finance = false) => {
  const h = harness('../../components/salon/OperationsResolutionForm.jsx', 'default', finance);
  h.render({ businessId: 'biz', branches, items: [item()], form: baseForm(extra), setForm: h.setForm, submit: h.submit, submitLabel: 'Xác nhận' }); return h;
};
const select = (h, label) => nodes(h.tree).find(n => n.type === 'Field' && n.props.label === label)?.props.children[0] || nodes(h.tree).find(n => n.type === 'Field' && n.props.label === label)?.props.children;
const submit = h => nodes(h.tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
const staffSelect = h => nodes(h.tree).find(n => n.type === 'Field' && n.props.label?.startsWith('Nhân viên'))?.props.children[0] || nodes(h.tree).find(n => n.type === 'Field' && n.props.label?.startsWith('Nhân viên'))?.props.children;

test('actual impact panel still renders its empty state after ownership UI is removed', () => {
  const h = harness('./SalonOperations.jsx', 'ImpactPanel');
  const view = h.render({ rows: [], selectedId: '', businessId: 'biz', branches: [], busy: '', run() {} });
  const empty = view.find(node => node.type === 'EmptyState');
  assert.ok(empty);
  assert.equal(empty.props.icon, 'AlertTriangle');
  assert.ok(empty.props.title);
});

test('actual finance flag excludes refund option, rejects stale refund submit and retains reopen code', () => {
  assert.equal(FINANCE_WORKSPACE_ENABLED, false);
  const h = formHarness({ resolution: 'CANCEL_REFUND' });
  assert.ok(!nodes(h.tree).some(n => n.type === 'option' && n.props.value === 'CANCEL_REFUND'));
  submit(h); assert.equal(h.submissions.length, 0); assert.equal(h.errors.length, 1);
  const enabled = formHarness({ resolution: 'CANCEL_REFUND' }, true);
  assert.ok(nodes(enabled.tree).some(n => n.type === 'option' && n.props.value === 'CANCEL_REFUND'));
  submit(enabled); assert.equal(enabled.submissions[0].resolution, 'CANCEL_REFUND');
});


test('actual named staff selector filters scope/profile/service; private bookable staff remains selectable', async () => {
  const h = formHarness(); assert.equal(h.calls[0].args[0], 'a'); assert.equal(staffSelect(h).props.disabled, true);
  h.calls[0].resolve([staff(), staff('wrong', 'external'), staff('off', 'a', ['s'], { status: 'INACTIVE' }), staff('unbookable', 'a', ['s'], { isBookable: false }), staff('service', 'a', ['other']), staff('tenant', 'a', ['s'], { branch: { id: 'a', businessId: 'other' } }), staff('user-off', 'a', ['s'], { user: { isActive: false } })]);
  await h.settle(); const options = nodes(staffSelect(h)).filter(n => n.type === 'option' && n.props.value);
  assert.deepEqual(options.map(n => n.props.value), ['private']); assert.ok(textOf(staffSelect(h)).includes('Tên private'));
  assert.ok(!nodes(h.tree).some(n => n.type === 'Input' && n.props.value === 'private'));
  staffSelect(h).props.onChange({ target: { value: 'private' } }); h.render(); submit(h);
  assert.equal(h.submissions[0].replacementStaffId, 'private');
  assert.ok(textOf(h.tree).includes('kiểm tra khả năng nhận lịch'));
});

test('branch changes immediately fence choices, clear ID, and discard late response', async () => {
  const h = formHarness({ resolution: 'TRANSFER_BRANCH', replacementBranchId: 'b', replacementStaffId: 'stale' });
  assert.equal(h.props.form.replacementStaffId, '');
  const branchSelector = select(h, 'Chi nhánh đích');
  assert.deepEqual(nodes(branchSelector).filter(n => n.type === 'option' && n.props.value).map(n => n.props.value), ['b', 'c']);
  branchSelector.props.onChange({ target: { value: 'c' } }); h.render(); submit(h); assert.equal(h.submissions.length, 0);
  h.calls[1].resolve([staff('new', 'c', ['c-service'])]); await h.settle();
  const offering = { id: 'c-service', branchId: 'c', branch: { businessId: 'biz' }, businessServiceId: 'catalog', status: 'ACTIVE', bookable: true, durationMinutes: 30 };
  h.calls.find(c => c.name === 'services' && c.args[0] === 'c').resolve([offering]); await h.settle();
  h.calls[0].resolve([staff('old', 'b', ['b-service'])]); await h.settle();
  h.calls.find(c => c.name === 'services' && c.args[0] === 'b').resolve([{ ...offering, id: 'b-service', branchId: 'b' }]); await h.settle();
  assert.deepEqual(nodes(staffSelect(h)).filter(n => n.type === 'option' && n.props.value).map(n => n.props.value), ['new']);
  staffSelect(h).props.onChange({ target: { value: 'new' } }); h.render(); submit(h);
  assert.equal(h.submissions[0].replacementBranchId, 'c'); assert.equal(h.submissions[0].replacementStaffId, 'new');
});

test('context change fences before effect; errors support retry and empty choice cannot submit', async () => {
  const h = formHarness(); h.calls[0].resolve([staff()]); await h.settle();
  staffSelect(h).props.onChange({ target: { value: 'private' } }); h.render();
  h.render({ ...h.props, items: [item('other-item', 'b')] }, false); submit(h);
  assert.equal(h.submissions.length, 0); assert.equal(staffSelect(h).props.value, '');
  h.render(); assert.equal(h.props.form.replacementStaffId, '');
  h.calls[1].reject(new Error('private technical failure')); await h.settle();
  const error = nodes(h.tree).find(n => n.type === 'ErrorState'); assert.ok(error); assert.ok(!textOf(h.tree).includes('private technical failure'));
  error.props.onRetry(); h.render(); h.calls[2].resolve([]); await h.settle();
  assert.ok(textOf(h.tree).includes('Không có nhân viên')); submit(h); assert.equal(h.submissions.length, 0);
});

test('revoked branch/context clears stale IDs without external or unscoped reads', async () => {
  const h = formHarness({ resolution: 'TRANSFER_BRANCH', replacementBranchId: 'b' });
  h.calls[0].resolve([staff('b-staff', 'b', ['target'])]); await h.settle();
  h.calls[1].resolve([{ id: 'target', branchId: 'b', branch: { businessId: 'biz' }, businessServiceId: 'catalog', durationMinutes: 30, status: 'ACTIVE', bookable: true }]); await h.settle();
  staffSelect(h).props.onChange({ target: { value: 'b-staff' } }); h.render();
  h.render({ ...h.props, branches: branches.filter(branch => branch.id !== 'b') }, false); submit(h);
  assert.equal(h.submissions.length, 0); assert.equal(staffSelect(h).props.value, '');
  h.render(); await h.settle(); assert.equal(h.props.form.replacementBranchId, ''); assert.equal(h.props.form.replacementStaffId, '');
  assert.equal(h.calls.length, 2);
  const reassign = formHarness(); reassign.calls[0].resolve([staff()]); await reassign.settle();
  reassign.render({ ...reassign.props, businessId: 'external-business' }); await reassign.settle();
  assert.equal(reassign.calls.length, 1); assert.ok(nodes(reassign.tree).find(n => n.type === 'ErrorState').props.message.includes('phạm vi'));
});

test('batch staff choices are intersection of actual per-item services and branches', async () => {
  const calls = []; const api = { getAll: async id => { calls.push(id); return [staff('both', id, ['s', 's2']), staff('first', id, ['s'])]; } };
  const args = { businessId: 'biz', items: [item(), item('i2', 'a', 's2')], resolution: 'REASSIGN', branches, staffApi: api };
  assert.deepEqual((await product.loadStaffChoices(args)).map(s => s.id), ['both']); assert.deepEqual(calls, ['a']);
  assert.deepEqual(await product.loadStaffChoices({ ...args, items: [item(), item('i2', 'b', 's2')], staffApi: { getAll: async id => [staff(`staff-${id}`, id, ['s', 's2'])] } }), []);
  await assert.rejects(product.loadStaffChoices({ ...args, items: [{ id: 'missing', booking: { branchId: 'a' } }] }), /Thiếu thông tin/);
});

test('transfer checks per-service business mapping, duration, availability and batch intersection', async () => {
  const args = { businessId: 'biz', items: [item()], resolution: 'TRANSFER_BRANCH', targetBranchId: 'b', branches, staffApi: { getAll: async () => [staff('b-staff', 'b', ['target'])] } };
  const offering = { id: 'target', branchId: 'b', branch: { businessId: 'biz' }, businessServiceId: 'catalog', durationMinutes: 30, status: 'ACTIVE', bookable: true };
  for (const overrides of [{ businessServiceId: 'unrelated' }, { durationMinutes: 45 }, { bookable: false }, { status: 'INACTIVE' }, { branchId: 'c' }, { branch: { businessId: 'other' } }]) {
    assert.deepEqual(await product.loadStaffChoices({ ...args, servicesApi: { getManage: async () => [{ ...offering, ...overrides }] } }), []);
  }
  assert.equal((await product.loadStaffChoices({ ...args, items: [item(), item('i2')], servicesApi: { getManage: async () => [offering] } }))[0].id, 'b-staff');
  await assert.rejects(product.loadStaffChoices({ ...args, targetBranchId: 'external' }), /doanh nghiệp/);
  await assert.rejects(product.loadStaffChoices({ ...args, servicesApi: { getManage: async () => [offering, { ...offering, id: 'duplicate' }] } }), /duy nhất/);
});

test('actual impact JSX uses human labels, safe UUID fallback, truthful empty detail and retry', async () => {
  const h = harness('./SalonOperations.jsx', 'ImpactPanel');
  h.render({ businessId: 'biz', branches, selectedId: 'case', rows: [{ id: 'case', subjectType: 'BRANCH', action: 'PAUSE', status: 'OPEN' }] });
  assert.ok(textOf(h.tree).includes('Chi nhánh')); assert.ok(textOf(h.tree).includes('Tạm dừng')); assert.ok(!textOf(h.tree).includes('BRANCH'));
  h.calls[0].resolve({ id: 'case', items: [item()] }); await h.settle();
  assert.ok(textOf(h.tree).includes('Lịch hẹn chưa có mã')); assert.ok(!textOf(h.tree).includes('private-booking-uuid')); assert.ok(!textOf(h.tree).includes('PENDING'));
  const open = nodes(h.tree).find(n => n.type === 'Button' && n.props.children === 'Mở danh sách'); open.props.onClick();
  h.calls[1].reject(new Error('failure')); await h.settle();
  nodes(h.tree).find(n => n.type === 'ErrorState').props.onRetry(); h.calls[2].resolve({ id: 'case', items: [] }); await h.settle();
  assert.ok(nodes(h.tree).some(n => n.type === 'EmptyState' && n.props.title === 'Chưa có lịch trong hồ sơ'));
  nodes(h.tree).find(n => n.type === 'Button' && n.props.children === 'Mở danh sách').props.onClick();
  h.calls[3].resolve({ id: 'case' }); await h.settle();
  assert.ok(nodes(h.tree).some(n => n.type === 'ErrorState' && n.props.message === 'Chưa tải được danh sách lịch trong hồ sơ.'));
  assert.ok(!nodes(h.tree).some(n => n.type === 'EmptyState' && n.props.title === 'Chưa có lịch trong hồ sơ'));
  assert.equal(product.operationLabel('status', 'FUTURE_CODE'), 'Chưa có thông tin trạng thái');
});

test('actual page routes individual and batch forms through shared guarded form with real item scope', async () => {
  for (const batch of [false, true]) {
    const h = harness('./SalonOperations.jsx', 'ImpactPanel');
    const items = [item('first'), item('second', 'b')];
    h.render({ businessId: 'biz', branches, selectedId: 'case', rows: [{ id: 'case' }], run: async (_key, action) => action() });
    h.calls[0].resolve({ id: 'case', items }); await h.settle();
    const button = nodes(h.tree).find(n => n.type === 'Button' && (batch ? textOf(n).includes('Xử lý hàng loạt') : n.props.children === 'Chọn phương án'));
    button.props.onClick(); h.render();
    const form = nodes(h.tree).find(n => n.type === 'OperationsResolutionForm');
    assert.ok(form); assert.deepEqual(Array.from(form.props.items, row => row.id), batch ? ['first', 'second'] : ['first']);
    assert.equal(form.props.businessId, 'biz'); assert.equal(form.props.branches, branches);
    form.props.submit({ resolution: 'APPROVED_EXCEPTION', reason: 'Đã xác minh ngoại lệ' });
    const request = h.calls[1]; assert.equal(request.name, batch ? 'batch' : 'resolve'); assert.equal(request.args[0], 'case');
    if (batch) { assert.deepEqual(Array.from(request.args[1].itemIds), ['first', 'second']); request.resolve({ impact: { id: 'case', items: [] }, results: [{ ok: true }, { ok: true }] }); }
    else { assert.equal(request.args[1], 'first'); assert.equal(request.args[2].resolution, 'APPROVED_EXCEPTION'); request.resolve({ id: 'case', items: [] }); }
    await h.settle();
  }
});

test('late impact detail response cannot reopen a previously selected case', async () => {
  const h = harness('./SalonOperations.jsx', 'ImpactPanel');
  h.render({ businessId: 'biz', branches, rows: [{ id: 'a' }, { id: 'b' }] });
  nodes(h.tree).filter(n => n.type === 'Button' && n.props.children === 'Mở danh sách')[0].props.onClick();
  nodes(h.tree).filter(n => n.type === 'Button' && n.props.children === 'Mở danh sách')[1].props.onClick();
  h.calls[1].resolve({ id: 'b', items: [item('b-item')] }); await h.settle();
  h.calls[0].resolve({ id: 'a', items: [] }); await h.settle();
  assert.ok(textOf(h.tree).includes('Lịch hẹn chưa có mã'));
  assert.ok(!nodes(h.tree).some(n => n.type === 'EmptyState' && n.props.title === 'Chưa có lịch trong hồ sơ'));
});
