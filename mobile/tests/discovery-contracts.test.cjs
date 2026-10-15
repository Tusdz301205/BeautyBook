const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, modules = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require(name) {
    assert.ok(name in modules, `Unexpected import ${name}`);
    return modules[name];
  } });
  return module.exports;
}

test('discovery uses public detail/review routes and the complete branch promotion contract', async () => {
  const calls = [];
  const response = { ratings: [{ rating: 4, comment: 'Actual service rating' }], averageRating: 4, totalRatings: 1 };
  const client = { apiRequest: async url => { calls.push(url); return response; } };
  const modules = { './client': client };
  const id = 'id/with spaces';
  const { servicesApi } = load('api/services.ts', modules);
  const { staffApi } = load('api/staff.ts', modules);
  const { reviewsApi } = load('api/reviews.ts', modules);
  const { promotionsApi } = load('api/promotions.ts', modules);
  await servicesApi.detail(id);
  await staffApi.detail(id);
  assert.equal(await reviewsApi.byService(id), response);
  assert.equal(await reviewsApi.byStaff(id), response);
  await promotionsApi.byBranch(id);
  assert.deepEqual(calls, [
    '/services/id%2Fwith%20spaces', '/staff/public/id%2Fwith%20spaces',
    '/reviews/service/id%2Fwith%20spaces', '/reviews/public/staff/id%2Fwith%20spaces',
    '/promotions/branch/id%2Fwith%20spaces',
  ]);
});

test('service promotion discovery preserves target scope and branch-wide offers', () => {
  const { promotionsForService } = load('components/promotionDiscovery.ts');
  const rows = [
    { id: 'branch', serviceIds: [], comboIds: [] },
    { id: 'matching', serviceIds: ['service-1'], comboIds: [] },
    { id: 'other', serviceIds: ['service-2'], comboIds: [] },
    { id: 'combo-only', serviceIds: [], comboIds: ['combo-1'] },
    { id: 'both', serviceIds: ['service-1'], comboIds: ['combo-1'] },
  ];
  assert.deepEqual(Array.from(promotionsForService(rows, 'service-1'), row => row.id), ['branch', 'matching']);
  assert.equal(promotionsForService(rows).length, rows.length);
  assert.equal(promotionsForService([], 'service-1').length, 0);
});

test('restricted audiences have explicit public labels without customer identities', () => {
  const { promotionAudienceLabel } = load('components/promotionDiscovery.ts');
  assert.match(promotionAudienceLabel('SELECTED'), /được cơ sở chọn/);
  assert.match(promotionAudienceLabel('VIP'), /VIP/);
  assert.match(promotionAudienceLabel('BIRTHDAY'), /sinh nhật/);
  assert.notEqual(promotionAudienceLabel('FUTURE_AUDIENCE'), promotionAudienceLabel('ALL'));
});
