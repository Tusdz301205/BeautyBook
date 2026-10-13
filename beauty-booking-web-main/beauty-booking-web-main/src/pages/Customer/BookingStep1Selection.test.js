import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as dates from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBookingStore } from '../../store/bookingStore.js';
import { createLatestRequest } from '../../utils/latestRequest.js';
import { normalizeNameSearch } from '../../utils/nameSearch.js';

// Same source-execution pattern as SalonOverview.test.js: actual components,
// resource hook, request gate and Zustand actions, with controlled API promises
// and a React hook scheduler. This is mocked source testing, not live UI.
const compile = path => transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;
const sources = [1, 2, 3].map(step => compile(`./BookingStep${step}.jsx`));
const resourceSource = compile('../../hooks/useAsyncResource.js');
const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value)
  ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];

function harness(step, query = '') {
  useBookingStore.getState().reset();
  useBookingStore.getState().setBranch('branch-a', 'Branch A');
  const cells = [], effects = [], calls = [], navigations = [];
  let cursor = 0, dirty = false, mounted = true, lateWrites = 0, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      cells[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [cells[i].value, update => {
        if (!mounted) { lateWrites++; return; }
        const value = typeof update === 'function' ? update(cells[i].value) : update;
        if (!Object.is(value, cells[i].value)) { cells[i].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { deps, value: fn() }; return cells[i].value; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(cells[i]?.deps, deps)) effects.push(() => {
        cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() };
      });
    },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const unsubscribe = useBookingStore.subscribe(() => { dirty = true; });
  const defer = name => (...args) => new Promise((resolve, reject) => calls.push({ name, args, resolve, reject }));
  const api = {
    branchesApi: { getAll: defer('branches') }, servicesApi: { getAll: defer('services') },
    combosApi: { getPublic: defer('combos') }, staffApi: { getPublic: defer('staff') },
    bookingsApi: { availableSlots: defer('slots') },
  };
  const jsx = (type, props) => ({ type, props });
  const names = new Proxy({}, { get: (_, name) => name });
  const session = { user: { id: 'customer-a' } };
  const navigate = (...args) => navigations.push(args);
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'lucide-react': names,
    'react-router-dom': { useNavigate: () => navigate, useSearchParams: () => [new URLSearchParams(query)] },
    'date-fns': dates, 'date-fns/locale': { vi }, '../../api/apiClient': api,
    '../../store/bookingStore': { useBookingStore: () => useBookingStore.getState() },
    '../../store/authStore': { useAuthStore: selector => selector(session) },
    '../../components/ui': { ...Object.fromEntries(['Button', 'Card', 'EmptyState', 'ErrorState', 'Field', 'InlineNotice', 'Input', 'Select', 'Skeleton'].map(name => [name, name])), cx: (...values) => values.filter(Boolean).join(' ') },
    '../../components/customer/BookingLayout': names,
    '../../utils/nameSearch': { normalizeNameSearch }, '../utils/latestRequest': { createLatestRequest },
  };
  const load = compiled => {
    const module = { exports: {} };
    vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
      assert.ok(name in modules, `Unexpected import ${name}`); return modules[name];
    } });
    return module.exports;
  };
  modules['../../hooks/useAsyncResource'] = load(resourceSource);
  const Component = load(sources[step - 1]).default;
  const render = () => {
    assert.ok(mounted, 'Cannot render an unmounted component');
    let passes = 0;
    do {
      assert.ok(++passes < 30, 'No uncontrolled render/fetch loop');
      cursor = 0; dirty = false; tree = Component();
      while (effects.length) effects.shift()();
    } while (dirty);
    return nodes(tree);
  };
  const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    calls, navigations, session, render, drain, state: () => useBookingStore.getState(),
    settle: async () => { await drain(); return render(); },
    find: type => render().find(node => node.type === type),
    choose: title => { const card = render().find(node => node.type === 'SelectionCard' && node.props.title === title); assert.ok(card, `Missing ${title}`); card.props.onClick(); render(); },
    unmount: () => { mounted = false; cells.forEach(cell => cell.cleanup?.()); unsubscribe(); },
    lateWrites: () => lateWrites,
  };
}

const service = (id, variants) => ({ id, name: id, durationMinutes: 30, variants });
const person = id => ({ id, fullName: id });
const slot = hour => ({ start: `2026-10-20T${hour}:00:00+07:00`, end: `2026-10-20T${hour}:30:00+07:00` });
const slotLabel = hour => dates.format(new Date(slot(hour).start), 'HH:mm');
const prepareTime = h => {
  h.state().toggleService('service-a'); h.state().setStaff('staff-a'); h.state().setDate('2026-10-20');
  h.render(); return h.calls[0];
};
const next = h => h.find('BookingActions').props;

test('actual Step1 selections invalidate staff/time and gate missing, quoted and valid variants', async () => {
  const h = harness(1);
  try {
    h.render(); assert.equal(h.find('BookingActions'), undefined); assert.ok(h.find('Skeleton'));
    h.calls.find(call => call.name === 'branches').resolve([{ id: 'branch-a', name: 'Branch A' }]);
    h.calls.find(call => call.name === 'services').resolve([service('service-a'), service('service-b', [
      { id: 'priced', name: 'Priced', priceType: 'FIXED' }, { id: 'quote', name: 'Quote', priceType: 'QUOTE' },
    ])]);
    h.calls.find(call => call.name === 'combos').resolve([]); await h.settle();
    h.choose('service-a'); assert.equal(next(h).disabled, false);
    h.state().setStaff('staff-a'); h.state().setDate('2026-10-20'); h.state().setSlot(slot('10'));
    h.choose('service-b');
    assert.equal(h.state().staffId, null); assert.equal(h.state().date, null); assert.equal(h.state().slot, null);
    assert.equal(next(h).disabled, true);
    h.find('Select').props.onChange({ target: { value: 'quote' } }); assert.equal(next(h).disabled, true);
    h.find('Select').props.onChange({ target: { value: 'priced' } }); assert.equal(next(h).disabled, false);
    next(h).onNext(); assert.deepEqual(h.navigations, [['/book/staff']]);
    h.choose('service-a'); h.choose('service-b'); assert.equal(next(h).disabled, true);
    assert.equal(h.calls.length, 3, 'Service selection uses loaded catalog, not a fictitious availability request');
  } finally { h.unmount(); }
});

test('Step1 service/staff deep link is applied in order only once and later user choices survive', async () => {
  const h = harness(1, 'branchId=branch-a&serviceId=service-a&staffId=staff-a');
  try {
    h.render();
    h.calls.find(call => call.name === 'branches').resolve([{ id: 'branch-a' }]);
    h.calls.find(call => call.name === 'services').resolve([service('service-a'), service('service-b')]);
    h.calls.find(call => call.name === 'combos').resolve([]); await h.settle();
    assert.deepEqual(h.state().serviceIds, ['service-a']); assert.equal(h.state().staffId, 'staff-a');
    h.choose('service-a'); h.choose('service-b'); h.render();
    assert.deepEqual(h.state().serviceIds, ['service-b']); assert.equal(h.state().staffId, null);
    assert.equal(next(h).disabled, false);
  } finally { h.unmount(); }
});

for (const staleFailure of [false, true]) test(`staff eligibility for old service cannot replace newer selection (${staleFailure ? 'error' : 'success'})`, async () => {
  const h = harness(2);
  try {
    h.state().toggleService('service-a'); h.render(); const old = h.calls[0];
    h.state().toggleService('service-a'); h.state().toggleService('service-b'); h.render();
    const fresh = h.calls[1];
    assert.deepEqual(old.args, ['branch-a', ['service-a']]); assert.deepEqual(fresh.args, ['branch-a', ['service-b']]);
    assert.equal(next(h).disabled, true);
    fresh.resolve([person('staff-b')]); await h.settle(); h.choose('staff-b');
    if (staleFailure) old.reject(new Error('stale staff error')); else old.resolve([person('staff-a')]);
    await h.settle();
    assert.equal(h.state().staffId, 'staff-b'); assert.equal(h.state().staffName, 'staff-b');
    assert.equal(h.find('InlineNotice'), undefined);
    assert.ok(!h.render().some(node => node.type === 'SelectionCard' && node.props.title === 'staff-a'));
    assert.equal(next(h).disabled, false); next(h).onNext(); assert.deepEqual(h.navigations, [['/book/time']]);
    assert.equal(h.calls.length, 2);
  } finally { h.unmount(); }
});

for (const input of ['service', 'staff', 'variant']) for (const staleFailure of [false, true]) {
  test(`availability fences old ${input} selection after new slots (${staleFailure ? 'error' : 'success'})`, async () => {
    const h = harness(3);
    try {
      const old = prepareTime(h);
      h.state().setSlot(slot('10'));
      if (input === 'service') { h.state().toggleService('service-a'); h.state().toggleService('service-b'); }
      if (input === 'staff') h.state().setStaff('staff-b');
      if (input === 'variant') h.state().setVariant('service-a', 'variant-b');
      assert.equal(h.state().slot, null);
      h.state().setDate('2026-10-20'); h.render(); const fresh = h.calls[1];
      assert.equal(old.args[0].staffId, 'staff-a');
      assert.deepEqual(old.args[0].serviceIds, ['service-a']);
      if (input === 'service') assert.deepEqual(fresh.args[0].serviceIds, ['service-b']);
      if (input === 'staff') assert.equal(fresh.args[0].staffId, 'staff-b');
      if (input === 'variant') assert.equal(fresh.args[0].variantSelections['service-a'], 'variant-b');
      assert.equal(next(h).disabled, true);
      fresh.resolve({ slots: [slot('11')] }); await h.settle();
      const button = h.render().find(node => node.type === 'button' && node.props.children === slotLabel('11'));
      assert.ok(button); button.props.onClick(); assert.equal(next(h).disabled, false);
      if (staleFailure) old.reject(new Error('stale availability error')); else old.resolve({ slots: [slot('10')] });
      await h.settle();
      assert.equal(h.state().slot.start, slot('11').start); assert.equal(h.find('ErrorState'), undefined);
      assert.ok(!h.render().some(node => node.type === 'button' && node.props.children === slotLabel('10')));
      assert.equal(next(h).disabled, false); next(h).onNext(); assert.deepEqual(h.navigations, [['/book/info']]);
      assert.equal(h.calls.length, 2);
    } finally { h.unmount(); }
  });
}

test('old availability completion while newer staff request is pending cannot unlock next; current error/retry stays actionable', async () => {
  const h = harness(3);
  try {
    const old = prepareTime(h);
    h.state().setStaff('staff-b'); h.state().setDate('2026-10-20'); h.render();
    old.resolve({ slots: [slot('10')] }); await h.settle();
    assert.equal(next(h).disabled, true); assert.ok(h.find('Skeleton'));
    h.calls[1].reject(new Error('current availability failure')); await h.settle();
    assert.equal(h.find('ErrorState').props.message, 'current availability failure'); assert.equal(next(h).disabled, true);
    h.find('ErrorState').props.onRetry(); h.render(); assert.equal(next(h).disabled, true);
    h.calls[2].resolve({ slots: [slot('11')] }); await h.settle();
    // Even an injected persisted slot must be in the latest availability response.
    h.state().setSlot(slot('10')); assert.equal(next(h).disabled, true);
    h.state().setSlot(slot('11')); assert.equal(next(h).disabled, false);
    h.state().setSlot(null); assert.equal(next(h).disabled, true);
  } finally { h.unmount(); }
});

test('late staff success cannot end newer service loading; current eligibility removes invalid staff', async () => {
  const h = harness(2);
  try {
    h.state().toggleService('service-a'); h.render(); const old = h.calls[0];
    h.state().toggleService('service-a'); h.state().toggleService('service-b');
    h.state().setStaff('staff-a', 'Old staff'); h.render();
    old.resolve([person('staff-a')]); await h.settle();
    assert.ok(h.find('Skeleton')); assert.equal(next(h).disabled, true);
    assert.ok(!h.render().some(node => node.type === 'SelectionCard' && node.props.title === 'staff-a'));
    h.calls[1].resolve([person('staff-b')]); await h.settle();
    assert.equal(h.state().staffId, null); assert.equal(h.state().staffName, '');
    assert.equal(next(h).disabled, false, 'Validated empty selection permits automatic assignment');
    h.choose('staff-b'); assert.equal(h.state().staffId, 'staff-b'); assert.equal(next(h).disabled, false);
  } finally { h.unmount(); }
});

test('late success cannot erase current staff or availability failure', async () => {
  for (const step of [2, 3]) {
    const h = harness(step);
    try {
      h.state().toggleService('service-a');
      if (step === 3) h.state().setDate('2026-10-20');
      h.render(); const old = h.calls[0];
      h.state().toggleService('service-a'); h.state().toggleService('service-b');
      if (step === 3) h.state().setDate('2026-10-20');
      h.render(); h.calls[1].reject(new Error('current selection failure')); await h.settle();
      old.resolve(step === 2 ? [person('staff-a')] : { slots: [slot('10')] }); await h.settle();
      if (step === 2) {
        assert.ok(h.find('InlineNotice').props.children.includes('current selection failure'));
        assert.equal(next(h).disabled, false, 'Staff read failure retains documented automatic assignment fallback');
        assert.ok(!h.render().some(node => node.type === 'SelectionCard' && node.props.title === 'staff-a'));
      } else {
        assert.equal(h.find('ErrorState').props.message, 'current selection failure');
        assert.equal(next(h).disabled, true);
        assert.ok(!h.render().some(node => node.type === 'button' && node.props.children === slotLabel('10')));
      }
      assert.equal(h.calls.length, 2);
    } finally { h.unmount(); }
  }
});

test('service clear/reset invalidates pending staff and availability without accepting late success/error', async () => {
  for (const step of [2, 3]) for (const reset of [false, true]) for (const failure of [false, true]) {
    const h = harness(step);
    try {
      h.state().toggleService('service-a');
      if (step === 3) h.state().setDate('2026-10-20');
      h.render(); const old = h.calls[0];
      if (reset) h.state().reset(); else h.state().toggleService('service-a');
      h.render();
      if (failure) old.reject(new Error('stale after clear')); else old.resolve(step === 2 ? [person('staff-a')] : { slots: [slot('10')] });
      await h.settle();
      assert.equal(h.calls.length, 1); assert.equal(h.state().staffId, null); assert.equal(h.state().slot, null);
      assert.ok(h.navigations.some(([path, options]) => path === '/book' && options.replace));
      assert.equal(h.find('ErrorState'), undefined); assert.equal(h.find('InlineNotice')?.props.tone === 'warning', false);
      if (step === 3) assert.equal(next(h).disabled, true);
    } finally { h.unmount(); }
  }
});

test('unmount cleanup fences outstanding catalog, staff and slot success/error without state writes', async () => {
  for (const step of [1, 2, 3]) for (const failure of [false, true]) {
    const h = harness(step);
    if (step > 1) h.state().toggleService('service-a');
    if (step === 3) h.state().setDate('2026-10-20');
    h.render(); const count = h.calls.length; h.unmount();
    for (const call of h.calls) {
      if (failure) call.reject(new Error('late after unmount'));
      else call.resolve(call.name === 'slots' ? { slots: [slot('10')] } : []);
    }
    await h.drain(); assert.equal(h.lateWrites(), 0); assert.equal(h.calls.length, count);
  }
});
