import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { loadOperationsData, operationRows, operationsContext, operationsRights, operationsTab } from './operationsScope.js';

const permissions = ['booking:read:tenant', 'booking:update:tenant', 'booking:read:branch', 'booking:update:branch', 'payment:read:tenant', 'payment:create:tenant', 'payment:read:branch', 'payment:create:branch', 'promotion:manage:tenant', 'report:revenue:tenant', 'business:update:tenant'];
const grant = (code, businessId, branchId = null) => ({ code, businessId, branchId });
const actor = (scopes) => ({ id: 'user', scopes, permissions });
const branches = [
  { id: 'owned-one', businessId: 'owned' }, { id: 'owned-two', business: { id: 'owned' } },
  { id: 'counter', businessId: 'other' }, { id: 'staff-only', businessId: 'other' },
  { id: 'no-business' },
];
const mixed = actor([grant('BUSINESS_OWNER', 'owned'), grant('RECEPTIONIST', 'other', 'counter'), grant('STAFF', 'other', 'staff-only')]);

test('operational branch selector excludes staff-only grants and derives the selected business', () => {
  const context = operationsContext(mixed, branches, 'counter');
  assert.deepEqual(context.branches.map((branch) => branch.id), ['owned-one', 'owned-two', 'counter']);
  assert.equal(context.branchId, 'counter');
  assert.equal(context.businessId, 'other');
  assert.equal(operationsContext(mixed, branches, 'staff-only').branchId, 'owned-one');
  assert.equal(operationsContext(mixed, branches, 'owned-two').businessId, 'owned');
});

test('receptionist cannot borrow owner impact, loyalty or invoice-management controls', () => {
  const rights = operationsRights(mixed, operationsContext(mixed, branches, 'counter'));
  assert.equal(rights.waitlist, true);
  assert.equal(rights.offer, true);
  assert.equal(rights.issueInvoice, true);
  for (const key of ['impact', 'loyalty', 'ownership', 'manageInvoices', 'configureLoyalty']) assert.equal(rights[key], false, key);
  assert.equal(operationsTab('impact', rights), 'waitlist');
  assert.equal(operationsTab('ownership', rights), 'waitlist');
  assert.equal(operationsTab('cash', rights), 'cash');
});

test('owner keeps all real operational controls within the owned business', () => {
  const rights = operationsRights(mixed, operationsContext(mixed, branches, 'owned-two'));
  for (const value of Object.values(rights)) assert.equal(value, true);
  assert.equal(operationsTab('impact', rights), 'impact');
});

test('expired or retired scopes cannot render stale panels or select stale branches', () => {
  const user = actor([grant('BRANCH_MANAGER', 'owned', 'owned-one'), { ...grant('RECEPTIONIST', 'other', 'counter'), expiresAt: '2000-01-01' }]);
  const context = operationsContext(user, branches, 'counter');
  assert.equal(context.branchId, '');
  assert.deepEqual(context.branches, []);
  assert.equal(operationsTab('cash', operationsRights(user, context)), '');
});

test('a new owner without a branch cannot operate a counter or receive a fictitious branch', () => {
  const context = operationsContext(actor([grant('BUSINESS_OWNER', 'owned')]), []);
  const rights = operationsRights(mixed, context);
  assert.equal(context.businessId, 'owned');
  assert.equal(rights.ownership, true);
  assert.equal(rights.waitlist, false);
  assert.equal(rights.cash, false);
  assert.equal(rights.issueInvoice, false);
});

test('missing permissions hide actions even when the role exists', () => {
  const user = { ...mixed, permissions: ['payment:read:tenant', 'report:revenue:tenant'] };
  const rights = operationsRights(user, operationsContext(user, branches));
  assert.equal(rights.cash, true);
  assert.equal(rights.loyalty, true);
  assert.equal(rights.issueInvoice, false);
  assert.equal(rights.manageInvoices, false);
  assert.equal(rights.configureLoyalty, false);
});

function apiFixture() {
  const fn = () => mock.fn(async () => []);
  return {
    impactApi: { list: fn() }, waitlistApi: { branch: fn() },
    financeOperationsApi: { invoices: fn(), invoiceRequests: fn() },
    loyaltyApi: { liability: fn() }, ownershipApi: { list: fn(), versions: fn() },
  };
}

test('receptionist loader never invokes owner-only or removed cash-shift endpoints', async () => {
  const api = apiFixture();
  await loadOperationsData(mixed, operationsContext(mixed, branches, 'counter'), api);
  assert.equal(api.waitlistApi.branch.mock.calls[0].arguments[0], 'counter');
  assert.equal(api.financeOperationsApi.invoices.mock.callCount(), 1);
  for (const fn of [api.impactApi.list, api.loyaltyApi.liability, api.ownershipApi.list, api.ownershipApi.versions]) assert.equal(fn.mock.callCount(), 0);
});

test('staff-only loader sends no requests even if stale flattened permissions remain', async () => {
  const api = apiFixture();
  const user = actor([grant('STAFF', 'other', 'staff-only')]);
  await loadOperationsData(user, { businessId: 'other', branchId: 'staff-only' }, api);
  for (const group of Object.values(api)) for (const fn of Object.values(group)) assert.equal(fn.mock.callCount(), 0);
});

test('owner requests use the actual selected business and invoices use the selected branch', async () => {
  const api = apiFixture();
  api.financeOperationsApi.invoices = mock.fn(async () => [{ id: 'a', branchId: 'owned-two' }, { id: 'b', branchId: 'counter' }]);
  const result = await loadOperationsData(mixed, operationsContext(mixed, branches, 'owned-two'), api);
  assert.deepEqual(api.loyaltyApi.liability.mock.calls[0].arguments, ['owned']);
  assert.deepEqual(api.ownershipApi.list.mock.calls[0].arguments, ['owned']);
  assert.deepEqual(result.invoices.map((row) => row.id), ['a']);
  assert.deepEqual(operationRows([{ id: 'a', businessId: 'owned' }, { id: 'b', businessId: 'other' }], { businessId: 'owned' }, 'business').map((row) => row.id), ['a']);
});
