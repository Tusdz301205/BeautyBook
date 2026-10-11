import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/apiClient';
import { useBookingStore } from './bookingStore';
import { activeContextFor, activeScopes, canAt, isCustomerAccount, roleAt, sessionState } from '../utils/authScope';
import { advanceSessionGeneration, assertSessionGeneration, isSessionGenerationCurrent, sameSessionIdentity } from '../utils/sessionGeneration';

let initialization = null;

/**
 * RBAC + Scope shape carried from the backend. Each scoped role holds
 * the tenant (business) / branch id it was granted at.
 */
const PLATFORM_LIKE = new Set([
  'PLATFORM_ADMIN',
]);

const TENANT_WIDE = new Set(['BUSINESS_OWNER']);
const BRANCH_SCOPED = new Set([
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
      isCustomer: () => isCustomerAccount(get().user),

      /**
       * RBAC + Scope check on the client.
       *
       *   can('booking:update:branch', { tenantId, branchId })
       *   can('booking:read:self', { ownerUserId })
       *
       * Use to drive UI affordances; the backend will still enforce.
       */
      can(code, ctx = {}) {
        return canAt(get().user, code, ctx);
      },

      /**
       * Helper: does the user hold the role at the given scope?
       */
      hasRoleAt(roleCode, tenantId = null, branchId = null) {
        return roleAt(get().user, roleCode, tenantId, branchId);
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
        for (const s of activeScopes(user)) {
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
        return activeContextFor(get().user);
      },

      login: async (email, password, context = {}) => {
        const lease = advanceSessionGeneration();
        set({ initialized: true });
        const res = await authApi.login(email, password, context);
        assertSessionGeneration(lease);
        const state = sessionState(res);
        advanceSessionGeneration();
        useBookingStore.getState().reset();
        set(state);
        if (!state.user) throw new Error('Tài khoản không còn quyền truy cập không gian này.');
        return state.user;
      },

      register: async (data) => {
        const lease = advanceSessionGeneration();
        set({ initialized: true });
        const res = await authApi.register(data);
        assertSessionGeneration(lease);
        const state = sessionState(res);
        advanceSessionGeneration();
        useBookingStore.getState().reset();
        set(state);
        if (!state.user) throw new Error('Tài khoản không còn quyền truy cập không gian này.');
        return state.user;
      },

      clearSession: (lease) => {
        if (lease !== undefined && !isSessionGenerationCurrent(lease)) return;
        advanceSessionGeneration();
        useBookingStore.getState().reset();
        set({ user: null, accessToken: null, initialized: true });
      },

      logout: async () => {
        advanceSessionGeneration();
        // Dispatch with the captured credential, then revoke local access now.
        // Completion has no authority to clear a subsequent login.
        const pending = get().accessToken ? authApi.logout() : Promise.resolve();
        useBookingStore.getState().reset();
        set({ user: null, accessToken: null, initialized: true });
        await pending;
      },

      setAccessToken: (token) => { advanceSessionGeneration(); set({ accessToken: token }); },
      setSession: (result, lease) => {
        if (lease !== undefined) assertSessionGeneration(lease);
        const state = sessionState(result);
        if (!state.user || !sameSessionIdentity(state.user, get().user)) {
          advanceSessionGeneration();
          useBookingStore.getState().reset();
        }
        set(state);
        return state.user;
      },
      initialize: async () => {
        if (get().initialized) return;
        if (initialization && isSessionGenerationCurrent(initialization.lease)) return initialization.promise;
        const entry = { lease: advanceSessionGeneration(), promise: null };
        entry.promise = (async () => {
          try {
            const result = await authApi.refresh();
            if (isSessionGenerationCurrent(entry.lease)) get().setSession(result, entry.lease);
          } catch {
            if (isSessionGenerationCurrent(entry.lease)) get().clearSession(entry.lease);
          }
        })().finally(() => { if (initialization === entry) initialization = null; });
        initialization = entry;
        return entry.promise;
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
