import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/apiClient';

/**
 * RBAC + Scope shape carried from the backend. Each scoped role holds
 * the tenant (business) / branch id it was granted at.
 */
const PLATFORM_LIKE = new Set([
  'PLATFORM_ADMIN',
]);

const TENANT_WIDE = new Set(['BUSINESS_OWNER']);
const BRANCH_SCOPED = new Set([
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'STAFF',
]);

/**
 * Frontend mirror of the role→permission matrix declared in
 * `permission-catalog.ts#ROLE_PERMISSION_MATRIX`. The frontend uses this
 * to drive UI affordances (hide / disable controls) without round-tripping
 * for each decision. The BACKEND is always the source of truth.
 */
/**
 * Auth state — uses Zustand + persist localStorage to keep the session
 * after refresh. The access token remains in memory and the refresh token is
 * an HttpOnly cookie; only non-sensitive user metadata is persisted.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      initialized: false,

      isAuthenticated: () => !!get().accessToken,
      isAdmin: () => get().user?.sessionType === 'admin',
      isSalon: () => get().user?.sessionType === 'salon',
      isCustomer: () => get().user?.sessionType === 'customer',

      /**
       * RBAC + Scope check on the client.
       *
       *   can('booking:update:branch', { tenantId, branchId })
       *   can('booking:read:self', { ownerUserId })
       *
       * Use to drive UI affordances; the backend will still enforce.
       */
      can(code, ctx = {}) {
        const user = get().user;
        if (!user || !user.scopes || user.scopes.length === 0) return false;
        if (!user.permissions?.includes(code)) return false;

        const parts = code.split(':');
        const defaultScope = parts.length >= 3 ? parts[parts.length - 1] : 'platform';
        const hasContext = !!(ctx.tenantId || ctx.branchId || ctx.ownerUserId);
        if (!hasContext) return true;

        for (const sr of user.scopes) {
          if (sr.expiresAt && new Date(sr.expiresAt).getTime() <= Date.now()) continue;

          switch (defaultScope) {
            case 'platform':
              if (PLATFORM_LIKE.has(sr.code)) return true;
              break;
            case 'tenant':
              if (PLATFORM_LIKE.has(sr.code)) return true;
              if (sr.businessId && sr.businessId === ctx.tenantId) return true;
              break;
            case 'branch':
              if (PLATFORM_LIKE.has(sr.code)) return true;
              if (sr.branchId && sr.branchId === ctx.branchId) return true;
              if (sr.businessId && sr.businessId === ctx.tenantId && !sr.branchId) return true;
              break;
            case 'self':
            case 'own':
              if (ctx.ownerUserId && ctx.ownerUserId === user.id) return true;
              break;
            case 'public':
              return true;
          }
        }
        return false;
      },

      /**
       * Helper: does the user hold the role at the given scope?
       */
      hasRoleAt(roleCode, tenantId = null, branchId = null) {
        const user = get().user;
        if (!user?.scopes) return false;
        return user.scopes.some(
          (s) =>
            s.code === roleCode &&
            (tenantId == null || s.businessId === tenantId) &&
            (branchId == null || s.branchId === branchId),
        );
      },

      /**
       * Returns the list of tenant (business) ids the user can touch.
       * Returns ['__ALL__'] for platform roles.
       */
      accessibleTenantIds() {
        const user = get().user;
        if (!user?.scopes) return [];
        const ids = new Set();
        let hasPlatform = false;
        for (const s of user.scopes) {
          if (PLATFORM_LIKE.has(s.code)) hasPlatform = true;
          if (TENANT_WIDE.has(s.code) || BRANCH_SCOPED.has(s.code)) {
            if (s.businessId) ids.add(s.businessId);
          }
        }
        if (hasPlatform) return ['__ALL__'];
        return [...ids];
      },

      /**
       * Returns the best-guess active tenant/branch context to drive the
       * UI (X-Business-Id, X-Branch-Id headers). Returns null if no scope.
       */
      activeContext() {
        const user = get().user;
        if (!user?.scopes || user.scopes.length === 0) {
          return { tenantId: null, branchId: null };
        }
        const first = user.scopes[0];
        return { tenantId: first.businessId ?? null, branchId: first.branchId ?? null };
      },

      login: async (email, password, context = {}) => {
        const res = await authApi.login(email, password, context);
        set({
          user: res.user,
          accessToken: res.accessToken,
          initialized: true,
        });
        return res.user;
      },

      register: async (data) => {
        const res = await authApi.register(data);
        set({
          user: res.user,
          accessToken: res.accessToken,
          initialized: true,
        });
        return res.user;
      },

      clearSession: () => {
        set({ user: null, accessToken: null, initialized: true });
      },

      logout: async () => {
        try {
          if (get().accessToken) await authApi.logout();
        } finally {
          set({ user: null, accessToken: null, initialized: true });
        }
      },

      setAccessToken: (token) => set({ accessToken: token }),
      initialize: async () => {
        if (get().initialized) return;
        try {
          const result = await authApi.refresh();
          set({
            user: result.user,
            accessToken: result.accessToken,
            initialized: true,
          });
        } catch {
          set({ user: null, accessToken: null, initialized: true });
        }
      },
    }),
    {
      name: 'beautybook-auth',
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);
