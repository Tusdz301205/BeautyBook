import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadAllManagedBranches, servicesForCanonicalGroup } from './adminFilterRequests.js';

test('loads management branches past the server cap, with stable deduplication', async () => {
  const calls = [];
  const rows = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
  const result = await loadAllManagedBranches(async (params) => {
    calls.push(params);
    return params.page === 1 ? rows : [{ id: '99' }, { id: '100' }];
  });
  assert.deepEqual(calls, [{ page: 1, limit: 100 }, { page: 2, limit: 100 }]);
  assert.equal(result.length, 101);
  assert.equal(result.at(-1).id, '100');
});

test('propagates paging failure instead of accepting a partial branch scope', async () => {
  await assert.rejects(loadAllManagedBranches(async ({ page }) => {
    if (page > 1) throw new Error('page failed');
    return Array.from({ length: 100 }, (_, id) => ({ id }));
  }), /page failed/);
});

test('service options compare canonical IDs rather than tenant category IDs', () => {
  const rows = [{ id: 'a', canonicalServiceId: 'public', categoryId: 'tenant' },
    { id: 'b', canonicalServiceId: 'other', categoryId: 'public' }, { id: 'unmapped' }];
  assert.deepEqual(servicesForCanonicalGroup(rows, 'public'), [rows[0]]);
  assert.deepEqual(servicesForCanonicalGroup(rows, ''), rows);
});

test('actual API wrappers serialize canonical and compatible category filters without renaming IDs', () => {
  const source = readFileSync(new URL('./apiClient.js', import.meta.url), 'utf8');
  const api = (name) => {
    const block = source.match(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\n\\});`));
    assert.ok(block);
    return vm.runInNewContext(`(${block[1]})`, { URLSearchParams, request: (url) => url });
  };
  const admin = api('adminApi');
  const bookings = api('bookingsApi');
  for (const request of [admin.getBusinessDirectory, admin.getBranchDirectory, bookings.getAll]) {
    const url = new URL(request({ canonicalServiceId: 'public group', categoryId: 'legacy', page: 2 }), 'https://test.invalid');
    assert.equal(url.searchParams.get('canonicalServiceId'), 'public group');
    assert.equal(url.searchParams.get('categoryId'), 'legacy');
    assert.equal(url.searchParams.get('page'), '2');
  }
  const options = new URL(admin.getBookingFilterServices('branch-a,branch-b'), 'https://test.invalid');
  assert.equal(options.pathname, '/admin/booking-filter-services');
  assert.equal(options.searchParams.get('branchIds'), 'branch-a,branch-b');
});
