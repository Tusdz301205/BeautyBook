import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { apiRequest, ApiError, getApiAccessToken, refreshAccessToken, subscribeApiAccessToken } from '../api/client';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { bindBookingSocket, createInvalidationQueue, schedulerOrigin } from '../utils/bookingSync';
import { dateInZone, mobileShell, operationContextKey, usableRole } from '../utils/operationSession';

export interface OperationBranch { id: string; name: string; businessId: string; timezone?: string; status?: string }
export interface OperationProfile { id: string; fullName?: string; status?: string; professionalTitle?: string; branchId?: string; position?: string; branch?: { id: string; businessId: string } }
interface OperationsValue {
  branches: OperationBranch[]; branchId: string | null; setBranchId: (id: string | null) => void;
  date: string; setDate: (date: string) => void; businessId: string | null; contextKey: string;
  revision: number; refresh: () => void; loading: boolean; error: string | null;
  staffProfile: OperationProfile | null; canWorkAsStaff: boolean;
  mode: 'STAFF' | 'OWNER'; setMode: (mode: 'STAFF' | 'OWNER') => void;
}
const Context = createContext<OperationsValue | null>(null);

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<'STAFF' | 'OWNER'>(mobileShell(user) === 'OWNER' ? 'OWNER' : 'STAFF');
  const [branches, setBranches] = useState<OperationBranch[]>([]);
  const [staffProfile, setProfile] = useState<OperationProfile | null>(null);
  const [branchId, setBranch] = useState<string | null>(user?.branchId ?? null);
  const [date, setDate] = useState(() => dateInZone());
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const identity = operationContextKey(user, null, 'SESSION');
  const identityRef = useRef(identity); identityRef.current = identity;
  const businessId = user?.businessId ?? null;
  const queueRef = useRef<{ invalidate: () => Promise<void> } | null>(null);
  const bump = useCallback(() => setRevision(value => value + 1), []);
  const refresh = useCallback(() => { bump(); void queueRef.current?.invalidate(); }, [bump]);
  const profileBranch = staffProfile?.branchId ?? staffProfile?.branch?.id;
  const canWorkAsStaff = staffProfile?.status === 'ACTIVE' && Boolean(profileBranch && branches.some(branch => branch.id === profileBranch && branch.businessId === businessId)) &&
    (usableRole(user, 'BUSINESS_OWNER') || (usableRole(user, 'STAFF') && Boolean(user?.scopes?.some(scope => scope.code === 'STAFF' && scope.businessId === businessId && scope.branchId === profileBranch && (!scope.expiresAt || Date.parse(scope.expiresAt) > Date.now())))));

  useEffect(() => {
    let active = true;
    setBranches([]); setProfile(null); setBranch(user?.branchId ?? null); setError(null); setLoading(true);
    setModeState(mobileShell(user) === 'OWNER' ? 'OWNER' : 'STAFF');
    const queue = createInvalidationQueue({
      fetch: async () => {
        const rows = await apiRequest<OperationBranch[]>('/branches/accessible');
        let profile: OperationProfile | null = null;
        if (usableRole(user, 'STAFF') || usableRole(user, 'BUSINESS_OWNER')) {
          try { profile = await apiRequest<OperationProfile>('/staff/me'); }
          catch (reason) {
            // Personal work is optional for Owner. An unrelated Staff profile
            // must not prevent loading authorized Owner branches.
            if (!(reason instanceof ApiError && (reason.status === 404 || (reason.status === 403 && usableRole(user, 'BUSINESS_OWNER'))))) throw reason;
          }
        }
        return { rows, profile };
      },
      commit: ({ rows, profile }) => {
        if (!active || identityRef.current !== identity) return;
        const scoped = rows.filter(row => row.businessId === businessId && (!user?.branchId || row.id === user.branchId));
        setBranches(scoped); setProfile(profile ? { ...profile, branchId: profile.branchId ?? profile.branch?.id, professionalTitle: profile.professionalTitle ?? profile.position } : null); setError(null);
        setBranch(previous => previous === null && mobileShell(user) === 'OWNER' ? null : scoped.some(row => row.id === previous) ? previous : scoped[0]?.id ?? null);
        setLoading(false); bump();
      },
      fail: reason => {
        if (!active || identityRef.current !== identity) return;
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) { setBranches([]); setProfile(null); }
        setError(reason instanceof ApiError && reason.status === 0 ? 'Đang mất kết nối. Kết nối lại để cập nhật công việc.' : 'Chưa tải được ngữ cảnh làm việc. Vui lòng thử lại.');
        setLoading(false); bump();
      },
    });
    queueRef.current = queue;
    const invalidate = () => { bump(); void queue.invalidate(); };
    // SchedulerGateway uses Socket.IO's root namespace, as Customer does.
    const socket = io(schedulerOrigin(API_BASE_URL), {
      autoConnect: false, forceNew: true, auth: { token: getApiAccessToken() },
      reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 10000,
    });
    const binding = bindBookingSocket(socket, {
      token: getApiAccessToken, subscribeToken: subscribeApiAccessToken, refreshToken: refreshAccessToken,
      invalidate, clear: () => { setBranches([]); setProfile(null); bump(); },
      suspend: value => queue.suspend(value), active: AppState.currentState === 'active' || AppState.currentState == null,
    });
    const state = AppState.addEventListener('change', next => binding.setActive(next === 'active'));
    void queue.invalidate();
    return () => { active = false; state.remove(); binding.dispose(); queue.dispose(); if (queueRef.current === queue) queueRef.current = null; };
  }, [identity, businessId, bump]);

  // Expired grants are re-evaluated without waiting for a navigation action.
  useEffect(() => {
    const ends = user?.scopes?.map(scope => Date.parse(scope.expiresAt ?? '')).filter(value => value > Date.now()) ?? [];
    if (!ends.length) return;
    const timeout = setTimeout(() => { setBranches([]); setProfile(null); refresh(); void refreshAccessToken().catch(() => {}); }, Math.min(Math.min(...ends) - Date.now() + 10, 2_147_483_647));
    return () => clearTimeout(timeout);
  }, [identity, revision, refresh]);
  const selectBranch = (id: string | null) => {
    if (id !== null && !branches.some(row => row.id === id)) return;
    if (user?.branchId && id !== user.branchId) return;
    setBranch(id); refresh();
  };
  const setMode = (next: 'STAFF' | 'OWNER') => {
    if ((next === 'STAFF' && !canWorkAsStaff) || (next === 'OWNER' && !usableRole(user, 'BUSINESS_OWNER'))) return;
    if (next === 'STAFF' && profileBranch && branches.some(row => row.id === profileBranch)) setBranch(profileBranch);
    setModeState(next); refresh();
  };
  return <Context.Provider value={{ branches, branchId, setBranchId: selectBranch, date, setDate, businessId,
    contextKey: operationContextKey(user, branchId, mode), revision, refresh, loading, error, staffProfile, canWorkAsStaff, mode, setMode }}>{children}</Context.Provider>;
}

export function useOperations() { const value = useContext(Context); if (!value) throw new Error('OperationsProvider required'); return value; }
