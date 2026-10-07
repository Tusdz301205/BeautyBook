const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date, Intl, Number, Object, Map, Set, Promise, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
  } });
  return module.exports;
}

test('login omits workspace until explicitly required by server; business selection retained', async () => {
  const calls = [];
  const { authApi } = load('api/auth.ts', { './client': { apiRequest: async (...args) => { calls.push(args); return {}; } } });
  await authApi.login('person@example.invalid', 'unit-only');
  assert.equal(Object.hasOwn(JSON.parse(calls[0][1].body), 'workspace'), false);
  await authApi.login('person@example.invalid', 'unit-only', { workspace: 'SALON', businessId: 'allowed-business' });
  assert.equal(JSON.parse(calls[1][1].body).businessId, 'allowed-business');
  assert.equal(JSON.parse(calls[1][1].body).workspace, 'SALON');
});

test('public branch mapping tolerates absent media, keeps branch identity and raw TIME', () => {
  const { mapBranchDetail } = load('mappers/catalog.ts');
  const today = new Date().getDay();
  const value = mapBranchDetail({ id: 'branch', businessId: 'business', name: 'Chi nhánh A', business: { name: 'Doanh nghiệp B' }, images: [{ media: null }, null, { media: { url: 'https://example.invalid/image.webp' } }], workingHours: [{ dayOfWeek: today, openTime: '1970-01-01T08:30:00.000Z', closeTime: '19:00:00' }] });
  assert.equal(value.id, 'branch'); assert.equal(value.name, 'Chi nhánh A');
  assert.equal(value.openingHours, '08:30 - 19:00');
  assert.deepEqual(Array.from(value.imageUrls), ['https://example.invalid/image.webp']);
  assert.equal(value.address, 'Chưa cập nhật địa chỉ');
});

test('all backend appointment statuses retain distinct visible labels', () => {
  const { bookingStatusMeta } = load('data/appointments.ts', { '../constants/colors': { colors: {} } });
  const statuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'NO_SHOW'];
  const labels = statuses.map(raw => bookingStatusMeta(raw === 'COMPLETED' ? 'completed' : ['CANCELLED', 'EXPIRED', 'REJECTED', 'NO_SHOW'].includes(raw) ? 'cancelled' : 'upcoming', raw).label);
  assert.equal(new Set(labels).size, statuses.length);
  assert.equal(labels[3], 'Đang thực hiện');
});

test('active check-in and service stay in upcoming even after planned start', () => {
  const { isPastUpcoming } = load('data/appointments.ts', { '../constants/colors': { colors: {} } });
  const old = { status: 'upcoming', date: '01/01/2020', time: '08:30' };
  assert.equal(isPastUpcoming({ ...old, rawStatus: 'CHECKED_IN' }), false);
  assert.equal(isPastUpcoming({ ...old, rawStatus: 'IN_PROGRESS' }), false);
  assert.equal(isPastUpcoming({ ...old, rawStatus: 'CONFIRMED' }), true);
});

test('combined search filters and pagination are sent to server, never reduced locally', async () => {
  let received;
  const { servicesApi } = load('api/services.ts', { './client': { withQuery: (url, query) => { received = query; return url; }, apiRequest: async () => ({ data: [], hasMore: false }) } });
  await servicesApi.search({ query: 'da', location: 'Hà Nội', canonicalServiceId: 'canonical', maxPrice: 500000, minRating: 4, sort: 'price_desc', page: 2, limit: 50 });
  assert.equal(received.page, 2); assert.equal(received.sort, 'price_desc'); assert.equal(received.minRating, 4); assert.equal(received.canonicalServiceId, 'canonical');
});

test('branch detail remains usable when optional offers or reviews fail', async () => {
  const states = [], effects = []; let index = 0;
  const react = { useState: initial => { const i = index++; states[i] = initial; return [initial, value => { states[i] = value; }]; }, useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  const { useBranchDetail } = load('hooks/useBranchDetail.ts', {
    react,
    '../api/branches': { branchesApi: { detail: async () => ({ id: 'branch', businessId: 'business', name: 'Chi nhánh' }) } },
    '../api/combos': { combosApi: { listPublic: async () => { throw Error('optional offers unavailable'); } } },
    '../api/reviews': { reviewsApi: { byBusiness: async () => { throw Error('optional reviews unavailable'); } } },
    '../mappers/catalog': { mapBranchDetail: value => value, groupServices: () => [], mapStaff: () => [], mapCombo: value => value, mapReview: value => value },
  });
  await useBranchDetail('branch').reload();
  assert.equal(states[0].id, 'branch'); assert.equal(states[5], false); assert.equal(states[6], null);
});

test('slow optional content never blocks core branch details', async () => {
  const states = []; let index = 0, release;
  const optional = new Promise(resolve => { release = resolve; });
  const react = { useState: initial => { const i = index++; states[i] = initial; return [initial, value => { states[i] = value; }]; }, useRef: value => ({ current: value }), useCallback: fn => fn, useEffect() {} };
  const { useBranchDetail } = load('hooks/useBranchDetail.ts', {
    react,
    '../api/branches': { branchesApi: { detail: async () => ({ id: 'branch', businessId: 'business', name: 'Chi nhánh' }) } },
    '../api/combos': { combosApi: { listPublic: () => optional.then(() => []) } },
    '../api/reviews': { reviewsApi: { byBusiness: () => optional.then(() => ({ data: [] })) } },
    '../mappers/catalog': { mapBranchDetail: value => value, groupServices: () => [], mapStaff: () => [], mapCombo: value => value, mapReview: value => value },
  });
  const request = useBranchDetail('branch').reload();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(states[0].id, 'branch'); assert.equal(states[5], false);
  release(); await request;
});
