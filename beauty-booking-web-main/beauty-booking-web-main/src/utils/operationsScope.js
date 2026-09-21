import { activeScopes, canAt, roleAt } from './authScope.js';

// These controls follow actual API capabilities, not the union of all user roles.
export function operationsRights(user, { businessId, branchId } = {}) {
  const ctx = { tenantId: businessId, branchId };
  const owner = !!businessId && roleAt(user, 'BUSINESS_OWNER', businessId);
  const receptionist = !!businessId && !!branchId && roleAt(user, 'RECEPTIONIST', businessId, branchId);
  const ownerCan = (code) => owner && canAt(user, code, ctx);
  const counterCan = (action) => (owner && canAt(user, `${action}:tenant`, ctx))
    || (receptionist && canAt(user, `${action}:branch`, ctx));
  return {
    owner,
    operator: owner || receptionist,
    impact: ownerCan('booking:update:tenant'),
    waitlist: !!branchId && counterCan('booking:read'),
    cash: !!branchId && counterCan('payment:read'),
    loyalty: ownerCan('report:revenue:tenant'),
    ownership: ownerCan('business:update:tenant'),
    offer: !!branchId && counterCan('booking:update'),
    issueInvoice: !!branchId && counterCan('payment:create'),
    manageInvoices: ownerCan('payment:create:tenant'),
    configureLoyalty: ownerCan('promotion:manage:tenant'),
  };
}

export function operationsContext(user, accessibleBranches, preferredBranchId = '') {
  const branches = (accessibleBranches || []).filter((branch) => branch.id && operationsRights(user, {
    businessId: branch.businessId || branch.business?.id, branchId: branch.id,
  }).operator);
  const selected = branches.find((branch) => branch.id === preferredBranchId) || branches[0];
  const businessId = selected?.businessId || selected?.business?.id
    || activeScopes(user).find((scope) => scope.code === 'BUSINESS_OWNER' && scope.businessId)?.businessId || '';
  return { branches, branchId: selected?.id || '', businessId };
}

export function operationsTab(requested, rights) {
  const allowed = ['impact', 'waitlist', 'cash', 'loyalty', 'ownership'].filter((key) => rights[key]);
  return allowed.includes(requested) ? requested : allowed[0] || '';
}

// Endpoints return all authorized invoices; the selected branch is a UI filter.
export function operationRows(rows, context, kind = 'branch') {
  return (rows || []).filter((row) => kind === 'business'
    ? row.businessId === context.businessId
    : (row.branchId || row.branch?.id) === context.branchId);
}

export async function loadOperationsData(user, context, api) {
  const rights = operationsRights(user, context);
  const { businessId, branchId } = context;
  const [impacts, waitlist, invoices, invoiceRequests, loyalty, transfers, versions] = await Promise.all([
    rights.impact ? api.impactApi.list() : [],
    rights.waitlist ? api.waitlistApi.branch(branchId) : [],
    rights.cash ? api.financeOperationsApi.invoices() : [],
    rights.cash ? api.financeOperationsApi.invoiceRequests() : [],
    rights.loyalty ? api.loyaltyApi.liability(businessId) : null,
    rights.ownership ? api.ownershipApi.list(businessId) : [],
    rights.ownership ? api.ownershipApi.versions(businessId) : null,
  ]);
  return {
    impacts: operationRows(impacts, context, 'business'), waitlist,
    invoices: operationRows(invoices, context), invoiceRequests: operationRows(invoiceRequests, context),
    loyalty, transfers, versions,
  };
}
