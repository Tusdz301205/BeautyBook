// A local lease owns both list and count. Read operations invalidate that lease
// before transport starts and reconcile using the current query after it ends.
export function createNotificationCenter({ api, getQuery, isCurrent, onPage, onError, onReadAll }) {
  let active = true;
  let sequence = 0;
  let snapshot = { items: [], unread: 0, selected: null, loading: true, error: '', pending: [], allPending: false,
    pagination: { page: 1, total: 0, totalPages: 1 } };
  const listeners = new Set();
  const completed = new Set();
  const current = () => active && isCurrent();
  const update = values => {
    if (!current()) return;
    snapshot = { ...snapshot, ...values };
    listeners.forEach(listener => listener());
  };
  const load = async () => {
    if (!current()) return;
    const request = ++sequence;
    const query = { ...getQuery() };
    const valid = () => current() && request === sequence && JSON.stringify(query) === JSON.stringify(getQuery());
    update({ loading: true, error: '' });
    try {
      const [result, count] = await Promise.all([api.getAll(query), api.getUnreadCount()]);
      if (!valid()) return;
      const items = result?.data ?? result ?? [];
      const pagination = result?.pagination ?? { page: query.page, total: items.length, totalPages: 1 };
      const lastPage = Math.max(1, Number(pagination.totalPages) || 1);
      if (query.page > lastPage) {
        onPage(lastPage);
        // The component's page effect requests the bounded page. Never commit
        // the now-invalid empty final page or its paired count.
        return;
      }
      const unread = Number(count?.count ?? count ?? 0);
      update({ items, pagination: { ...pagination, totalPages: lastPage },
        unread: Number.isFinite(unread) ? Math.max(0, unread) : 0, loading: false });
    } catch (error) {
      if (valid()) update({ error: error.message, loading: false });
    }
  };
  const mutate = async (item, all = false) => {
    if (!current() || snapshot.allPending || (all ? snapshot.pending.length > 0
      : !item || item.isRead || item.readAt || completed.has(item.id) || snapshot.pending.includes(item.id)
        || snapshot.items.some(row => row.id === item.id && (row.isRead || row.readAt)))) return;
    ++sequence;
    update(all ? { allPending: true } : { pending: [...snapshot.pending, item.id] });
    try {
      await (all ? api.markAllAsRead() : api.markAsRead(item.id));
      if (!current()) return;
      if (!all) completed.add(item.id);
      const selected = snapshot.selected;
      if (selected && (all || selected.id === item.id)) {
        update({ selected: { ...selected, isRead: true, readAt: selected.readAt || new Date().toISOString() } });
      }
      if (all) onReadAll?.();
    } catch (error) {
      if (current()) onError?.(error);
    } finally {
      if (current()) {
        await load();
        update(all ? { allPending: false } : { pending: snapshot.pending.filter(id => id !== item.id) });
      }
    }
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    load,
    mark: item => mutate(item),
    markAll: () => mutate(null, true),
    select: item => update({ selected: item }),
    activate() { active = true; },
    dispose() { active = false; ++sequence; },
  };
}

const routes = {
  salon: [
    [/^\/salon$/, []],
    [/^\/salon\/services$/, ['business_service:update:tenant', 'branch_service_offering:status:tenant']],
    [/^\/salon\/combos$/, ['combo:manage:tenant']],
    [/^\/salon\/appointments$/, ['booking:read:tenant', 'booking:read:branch']],
    [/^\/salon\/staff$/, ['user:read:tenant', 'user:read:branch']],
    [/^\/salon\/staff\/schedule$/, ['booking:read:tenant', 'booking:read:branch']],
    [/^\/salon\/staff\/[^/]+$/, ['user:read:tenant', 'user:read:branch', 'user:read:self']],
    [/^\/salon\/branches\/new$/, ['branch:create:tenant']],
    [/^\/salon\/branches\/[^/]+\/setup$/, ['branch:update:tenant', 'branch:create:tenant']],
    [/^\/salon\/branches\/[^/]+\/preview$/, ['branch:read:tenant']],
    [/^\/salon\/profile$/, ['branch:update:tenant']],
    [/^\/salon\/promotions$/, ['promotion:manage:tenant']],
    [/^\/salon\/reviews$/, ['review:moderate:tenant']],
    [/^\/salon\/stats$/, ['report:revenue:tenant', 'report:revenue:branch']],
    [/^\/salon\/(security|account|incoming-ownership)$/, []],
    [/^\/salon\/notifications$/, ['notification:read:self']],
    [/^\/salon\/onboarding$/, ['business:create:self', 'business:update:tenant']],
    [/^\/salon\/payments$/, ['payment:read:tenant', 'payment:read:branch']],
    [/^\/salon\/operations$/, ['booking:read:tenant', 'booking:read:branch', 'payment:read:tenant', 'payment:read:branch']],
    [/^\/salon\/audit$/, ['audit:read:tenant']],
  ],
  platform: [
    [/^\/admin$/, []],
    [/^\/admin\/(salons|branches\/[^/]+|businesses\/[^/]+|violations|compliance)$/, ['branch:read:platform']],
    [/^\/admin\/users(?:\/[^/]+)?$/, ['user:read:platform']],
    [/^\/admin\/appointments$/, ['booking:read:platform']],
    [/^\/admin\/reports$/, ['report:overview:platform', 'report:revenue:platform', 'report:user_growth:platform']],
    [/^\/admin\/reviews$/, ['review:moderate:platform']],
    [/^\/admin\/ownership$/, ['business:review:platform']],
    [/^\/admin\/(security|profile)$/, []],
    [/^\/admin\/notifications$/, ['notification:read:self']],
    [/^\/admin\/payments$/, ['payment:read:platform']],
    [/^\/admin\/audit$/, ['audit:read:platform']],
    [/^\/admin\/settings$/, ['platform_setting:manage:platform']],
  ],
  customer: [
    // App.jsx protects this zone by customer session; these routes add no
    // PermissionGate. Do not invent action permissions for viewing a page.
    [/^\/customer\/appointments(?:\/[^/]+)?$/, []],
    [/^\/customer\/(profile|security|vouchers|reviews|benefits|notifications)$/, []],
    [/^\/book(?:\/(staff|time|info|confirm|success))?$/, []],
    [/^\/explore(?:\/(branches|services|staff)\/[^/]+)?$/, []],
  ],
};

export function allowedNotificationUrl(url, zone, can, item = {}, financeEnabled = false) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[\\\s]/.test(url)) return '';
  let pathname;
  try {
    pathname = decodeURIComponent(url.split(/[?#]/)[0]);
    if (new URL(url, 'https://notification.invalid').pathname !== url.split(/[?#]/)[0]
      || pathname.split('/').some(part => part === '.' || part === '..') || /[\\%]/.test(pathname)) return '';
  } catch { return ''; }
  if (!financeEnabled && /\/(payments)(\/|$)/.test(pathname)) return '';
  // These destinations remain retired even if a producer retains an old URL.
  if (/\/(privacy|data-requests)(\/|$)/.test(pathname)) return '';
  const route = routes[zone]?.find(([pattern]) => pattern.test(pathname));
  if (!route) return '';
  const booking = item.relatedBooking;
  const ctx = {
    tenantId: booking?.businessId || booking?.branch?.businessId || item.businessId || item.tenantId,
    branchId: booking?.branchId || item.branchId,
    ownerUserId: booking?.customerId || item.ownerUserId,
  };
  return route[1].length === 0 || route[1].some(code => can(code, ctx)) ? url : '';
}
