import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth';
import {
  ApiError,
  apiRequest,
  getApiAccessToken,
  setApiAccessToken,
  setApiRefreshToken,
  setApiSessionRefreshHandler,
  setApiUnauthorizedHandler,
} from '../api/client';
import type { ApiAuthUser } from '../types/api';
import { clearAuthSession, loadAuthSession, saveAuthSession } from '../utils/authStorage';

interface AuthContextValue {
  isLoggedIn: boolean;
  isRestoring: boolean;
  isSubmitting: boolean;
  user: ApiAuthUser | null;
  userName: string;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string, context?: { workspace?: 'CUSTOMER' | 'SALON' | 'PLATFORM'; businessId?: string; branchId?: string }) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [isRestoring, setRestoring] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef(0);
  const storageRef = useRef(Promise.resolve());
  // Keep persistent writes ordered so a slow save cannot resurrect logout.
  const persist = useCallback((write: () => Promise<void>) => {
    storageRef.current = storageRef.current.catch(() => {}).then(write);
    return storageRef.current;
  }, []);

  useEffect(() => {
    let active = true;
    const clearLocalSession = () => {
      operationRef.current += 1;
      setApiAccessToken(null);
      setApiRefreshToken(null);
      setUser(null);
      void persist(clearAuthSession).catch(() => {});
    };
    setApiUnauthorizedHandler(clearLocalSession);
    setApiSessionRefreshHandler((session) => {
      if (!active) return;
      setUser(session.user);
      void persist(() => saveAuthSession(session)).catch(() => {});
    });

    void (async () => {
      const operation = operationRef.current;
      const cached = await loadAuthSession();
      if (!active || operation !== operationRef.current) return;
      if (cached && active) {
        setApiAccessToken(cached.accessToken);
        setApiRefreshToken(cached.refreshToken ?? null);
        setUser(cached.user);
      }
      try {
        if (!cached?.refreshToken) {
          if (cached) clearLocalSession();
          return;
        }
        const response = await authApi.restore(cached.refreshToken);
        if (!active || operation !== operationRef.current) return;
        setApiAccessToken(response.accessToken);
        setApiRefreshToken(response.refreshToken ?? null);
        setUser(response.user);
        await persist(() => saveAuthSession(response));
      } catch (reason) {
        if (!active || operation !== operationRef.current) return;
        if (!cached || (reason instanceof ApiError && reason.status === 401)) {
          clearLocalSession();
        }
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
      setApiUnauthorizedHandler(null);
      setApiSessionRefreshHandler(null);
    };
  }, [persist]);

  const authenticate = useCallback(async (request: () => ReturnType<typeof authApi.login>) => {
    const operation = ++operationRef.current;
    setSubmitting(true);
    setError(null);
    try {
      const response = await request();
      if (operation !== operationRef.current) return;
      setApiAccessToken(response.accessToken);
      setApiRefreshToken(response.refreshToken ?? null);
      setUser(response.user);
      await persist(() => saveAuthSession(response));
    } catch (reason) {
      if (operation !== operationRef.current) return;
      setError(reason instanceof Error ? reason.message : 'Không thể xác thực tài khoản');
      throw reason;
    } finally {
      if (operation === operationRef.current) setSubmitting(false);
    }
  }, [persist]);

  const clearError = useCallback(() => setError(null), []);
  const updateName = useCallback((fullName: string) => {
    setUser((current) => current ? { ...current, fullName } : current);
  }, []);

  const logout = useCallback(async () => {
    const token = getApiAccessToken();
    operationRef.current += 1;
    // Clear locally before waiting for storage or a potentially offline server.
    setApiRefreshToken(null);
    setApiAccessToken(null);
    setUser(null);
    setError(null);
    setSubmitting(false);
    setRestoring(false);
    const cleared = persist(clearAuthSession);
    try {
      // apiRequest starts synchronously and captures the old Authorization header.
      if (token) await apiRequest('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, false);
    } catch {
      // Local logout must still succeed when the API is temporarily unavailable.
    } finally {
      await cleared;
    }
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoggedIn: Boolean(user),
    isRestoring,
    isSubmitting,
    user,
    userName: user?.fullName ?? '',
    error,
    clearError,
    login: (email, password, context) => authenticate(() => authApi.login(email.trim(), password, context)),
    register: (fullName, email, password) => authenticate(() => authApi.register(fullName.trim(), email.trim(), password)),
    logout,
    updateName,
  }), [authenticate, clearError, error, isRestoring, isSubmitting, logout, updateName, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
