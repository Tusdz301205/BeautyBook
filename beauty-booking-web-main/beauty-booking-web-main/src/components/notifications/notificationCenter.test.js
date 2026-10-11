import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNotificationCenter, allowedNotificationUrl } from './notificationCenterState.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  let query = { page: 1, limit: 20, state: 'all', type: 'ALL', severity: 'ALL', search: '' };
  let session = 'A';
  const lists = [], counts = [], reads = [], all = [], errors = [], pages = [];
  const api = {
    getAll: value => { const d = deferred(); lists.push({ ...d, query: value }); return d.promise; },
    getUnreadCount: () => { const d = deferred(); counts.push(d); return d.promise; },
    markAsRead: id => { const d = deferred(); reads.push({ ...d, id }); return d.promise; },
    markAllAsRead: () => { const d = deferred(); all.push(d); return d.promise; },
  };
  const controller = createNotificationCenter({ api, getQuery: () => query, isCurrent: () => session === 'A',
    onPage: page => { pages.push(page); query = { ...query, page }; }, onError: error => errors.push(error.message) });
  const result = (index, items = [{ id: 'fresh' }], count = 2, total = items.length, totalPages = 1) => {
    lists[index].resolve({ data: items, pagination: { page: lists[index].query.page, total, totalPages } });
    counts[index].resolve({ count });
  };
  return { controller, lists, counts, reads, all, errors, pages, result, snapshot: controller.getSnapshot,
    query: value => { query = { ...query, ...value }; }, session: value => { session = value; } };
}

test('late list and count cannot overwrite newer filter/page results', async () => {
  const h = harness(); const old = h.controller.load();
  h.query({ state: 'unread', page: 2, type: 'SYSTEM', severity: 'WARNING', search: 'new' });
  const fresh = h.controller.load(); h.result(1, [{ id: 'fresh' }], 1, 21, 2); await fresh;
  h.result(0, [{ id: 'old' }], 99); await old;
  assert.equal(h.snapshot().items[0].id, 'fresh'); assert.equal(h.snapshot().unread, 1);
  assert.equal(h.snapshot().pagination.page, 2);
});

test('query changes fence responses even before the next effect starts', async () => {
  const h = harness(); const request = h.controller.load(); h.query({ search: 'changed' });
  h.result(0); await request; assert.equal(h.snapshot().items.length, 0);
});

test('late failure cannot replace current success or clear a newer loading state', async () => {
  const h = harness(); const old = h.controller.load(); const fresh = h.controller.load();
  h.lists[0].reject(Error('old failure')); h.counts[0].resolve({ count: 9 }); await old;
  assert.equal(h.snapshot().loading, true); assert.equal(h.snapshot().error, '');
  h.result(1); await fresh; assert.equal(h.snapshot().loading, false);
});

test('pending item locks duplicates through reconciliation and never locally decrements', async () => {
  const h = harness(); const initial = h.controller.load(); h.result(0, [{ id: 'one' }], 4); await initial;
  const item = h.snapshot().items[0]; h.controller.select(item);
  const read = h.controller.mark(item); await h.controller.mark(item); await h.controller.markAll();
  assert.equal(h.reads.length, 1); assert.equal(h.all.length, 0); assert.equal(h.snapshot().unread, 4);
  h.reads[0].resolve(); await settle(); await h.controller.mark(item);
  assert.equal(h.reads.length, 1); assert.deepEqual(h.snapshot().pending, ['one']);
  h.result(1, [{ id: 'one', isRead: true }], 2); await read;
  assert.equal(h.snapshot().unread, 2); assert.equal(h.snapshot().selected.isRead, true);
  assert.deepEqual(h.snapshot().pending, []); await h.controller.mark(item); assert.equal(h.reads.length, 1);
});

test('read invalidates in-flight loads and reconciles the current filter', async () => {
  const h = harness(); const old = h.controller.load(); const read = h.controller.mark({ id: 'one' });
  h.result(0, [{ id: 'old' }], 99); await old; assert.equal(h.snapshot().items.length, 0);
  h.query({ state: 'unread', type: 'SYSTEM', search: 'active' });
  h.reads[0].resolve(); await settle(); assert.equal(h.lists[1].query.search, 'active');
  h.result(1, [], 0, 0); await read;
  assert.equal(h.snapshot().items.length, 0); assert.equal(h.snapshot().pagination.total, 0);
});

test('removing the final unread on the last page requests the bounded page', async () => {
  const h = harness(); h.query({ page: 2, state: 'unread' });
  const initial = h.controller.load(); h.result(0, [{ id: 'last' }], 21, 21, 2); await initial;
  const read = h.controller.mark({ id: 'last' }); h.reads[0].resolve(); await settle();
  h.result(1, [], 20, 20, 1); await read;
  assert.deepEqual(h.pages, [1]); assert.equal(h.snapshot().loading, true);
  const bounded = h.controller.load(); h.result(2, [{ id: 'remaining' }], 20, 20, 1); await bounded;
  assert.equal(h.snapshot().pagination.page, 1); assert.equal(h.snapshot().pagination.total, 20);
});

test('mark all locks overlapping reads, reloads latest filters, and respects new arrivals', async () => {
  const h = harness(); const read = h.controller.markAll(); await h.controller.markAll();
  await h.controller.mark({ id: 'one' }); assert.equal(h.all.length, 1); assert.equal(h.reads.length, 0);
  h.query({ state: 'read', severity: 'CRITICAL' }); h.all[0].resolve(); await settle();
  assert.equal(h.lists[0].query.state, 'read'); h.result(0, [{ id: 'read', isRead: true }], 1); await read;
  assert.equal(h.snapshot().unread, 1); assert.equal(h.snapshot().allPending, false);
});

test('account/session changes fence list, count, mutation, dialog updates and errors', async () => {
  const h = harness(); const load = h.controller.load(); const mark = h.controller.mark({ id: 'one' });
  h.controller.select({ id: 'one' }); h.session('B');
  h.result(0, [{ id: 'private' }], 99); h.reads[0].reject(Error('old session')); await Promise.all([load, mark]);
  assert.equal(h.snapshot().items.length, 0); assert.equal(h.snapshot().unread, 0);
  assert.equal(h.snapshot().selected.isRead, undefined); assert.deepEqual(h.errors, []); assert.equal(h.lists.length, 1);
  const next = harness(); assert.equal(next.snapshot().selected, null); assert.equal(next.snapshot().unread, 0);
});

test('dispose fences outstanding work; strict effect reactivation starts a fresh lease', async () => {
  const h = harness(); const old = h.controller.load(); h.controller.dispose(); h.controller.activate();
  const fresh = h.controller.load(); h.result(1); await fresh; h.result(0, [{ id: 'old' }], 99); await old;
  assert.equal(h.snapshot().items[0].id, 'fresh');
});

test('failed read releases lock after authoritative reload and can be retried', async () => {
  const h = harness(); const read = h.controller.mark({ id: 'one' }); h.reads[0].reject(Error('try again'));
  await settle(); h.result(0, [{ id: 'one' }], 1); await read;
  assert.deepEqual(h.errors, ['try again']); assert.deepEqual(h.snapshot().pending, []);
  const retry = h.controller.mark({ id: 'one' }); assert.equal(h.reads.length, 2);
  h.reads[1].resolve(); await settle(); h.result(1, [{ id: 'one', isRead: true }], 0); await retry;
});

test('related links require route permissions including target tenant and branch', () => {
  const checked = [];
  const can = (code, ctx) => { checked.push([code, ctx]); return code === 'booking:read:branch' && ctx.branchId === 'mine'; };
  assert.equal(allowedNotificationUrl('/salon/appointments?bookingId=x', 'salon', can, { branchId: 'other' }), '');
  assert.equal(allowedNotificationUrl('/salon/appointments?bookingId=x', 'salon', can, { branchId: 'mine', businessId: 'tenant' }), '/salon/appointments?bookingId=x');
  assert.equal(checked.at(-1)[1].tenantId, 'tenant');
  assert.equal(allowedNotificationUrl('/salon/promotions', 'salon', can), '');
  assert.equal(allowedNotificationUrl('/admin/users/one', 'platform', () => false), '');
  assert.equal(allowedNotificationUrl('/admin/users/one', 'platform', code => code === 'user:read:platform'), '/admin/users/one');
  assert.equal(allowedNotificationUrl('/customer/appointments/one', 'customer', code => code === 'booking:read:self'), '/customer/appointments/one');
});

test('retired, foreign-zone, unknown and malformed related destinations stay hidden', () => {
  for (const url of ['/admin/payments', '/admin/audit/raw', '/admin/audit/one', '/admin/data-requests', '/admin/unknown', '//evil/admin/users',
    '/admin/../salon/staff', '/admin/%2e%2e/users', '/admin/users%5cfoo', '/admin/users/%ZZ']) {
    assert.equal(allowedNotificationUrl(url, 'platform', () => true), '', url);
  }
  assert.equal(allowedNotificationUrl('/customer/privacy', 'customer', () => true), '');
  assert.equal(allowedNotificationUrl('/admin/users', 'salon', () => true), '');
  assert.equal(allowedNotificationUrl('/explore', 'customer', () => false), '/explore');
  assert.equal(allowedNotificationUrl('/explorer', 'customer', () => true), '');
});

test('branch setup accepts either actual owner permission and rejects missing or foreign-tenant permission', () => {
  const url = '/salon/branches/branch/setup';
  for (const permission of ['branch:update:tenant', 'branch:create:tenant']) {
    const can = (code, ctx) => code === permission && ctx.tenantId === 'owned';
    assert.equal(allowedNotificationUrl(url, 'salon', can, { businessId: 'owned' }), url);
    assert.equal(allowedNotificationUrl(url, 'salon', can, { businessId: 'foreign' }), '');
  }
  assert.equal(allowedNotificationUrl(url, 'salon', () => false), '');
  assert.equal(allowedNotificationUrl(url, 'salon', code => code === 'branch:read:tenant'), '');
});

test('business details retain the actual branch read guard; history list is allowed but raw details remain hidden', () => {
  const url = '/admin/businesses/business?tab=compliance';
  assert.equal(allowedNotificationUrl(url, 'platform', code => code === 'branch:read:platform'), url);
  assert.equal(allowedNotificationUrl(url, 'platform', code => code === 'business:read:platform'), '');
  assert.equal(allowedNotificationUrl(url, 'platform', () => false), '');
  for (const [zone, url, permission] of [
    ['platform', '/admin/audit', 'audit:read:platform'],
    ['salon', '/salon/audit', 'audit:read:tenant'],
  ]) {
    assert.equal(allowedNotificationUrl(url, zone, code => code === permission), url);
    assert.equal(allowedNotificationUrl(url, zone, () => false), '');
    assert.equal(allowedNotificationUrl(`${url}/raw/one`, zone, () => true), '');
  }
});

test('staff list stays permission-sensitive; zone-only pages add no invented permission', () => {
  assert.equal(allowedNotificationUrl('/salon/staff', 'salon', code => code === 'user:read:self'), '');
  assert.equal(allowedNotificationUrl('/salon/staff', 'salon', code => code === 'user:read:branch'), '/salon/staff');
  for (const [zone, url] of [['salon', '/salon/security'], ['platform', '/admin/profile'],
    ['customer', '/customer/reviews'], ['customer', '/customer/vouchers'], ['customer', '/book']]) {
    assert.equal(allowedNotificationUrl(url, zone, () => false), url);
  }
});

test('every allowlisted PermissionGate mirrors current App.jsx route permissions', () => {
  const source = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
  for (const [zone, prefix, start, end] of [
    ['salon', '/salon/', '/* Salon routes */', '/* Admin routes */'],
    ['platform', '/admin/', '/* Admin routes */', '/* Customer authenticated zone */'],
  ]) {
    const startIndex = source.indexOf(start);
    assert.ok(startIndex >= 0);
    const endIndex = source.indexOf(end, startIndex + start.length);
    const section = source.slice(startIndex, endIndex < 0 ? undefined : endIndex);
    const guards = [...section.matchAll(/<Route path="([^"]+)" element=\{<PermissionGate[^>]*anyOf=\{\[([^\]]+)\]/g)];
    assert.ok(guards.length > 0);
    for (const [, route, codes] of guards) {
      const url = prefix + route.replace(/:[^/]+/g, 'example');
      const permissions = [...codes.matchAll(/'([^']+)'/g)].map(match => match[1]);
      const requested = [];
      assert.equal(allowedNotificationUrl(url, zone, code => { requested.push(code); return false; }, {}, true), '', url);
      assert.deepEqual([...requested].sort(), [...permissions].sort(), url);
      for (const permission of permissions) {
        assert.equal(allowedNotificationUrl(url, zone, code => code === permission, {}, true), url, `${url}: ${permission}`);
      }
    }
  }
});
