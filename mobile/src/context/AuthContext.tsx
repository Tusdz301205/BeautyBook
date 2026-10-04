import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import {
  ApiError,
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
  login: (email: string, password: string) => Promise<void>;
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

  useEffect(() => {
    let active = true;
    const clearLocalSession = () => {
      setApiAccessToken(null);
      setApiRefreshToken(null);
      setUser(null);
      void clearAuthSession();
    };
    setApiUnauthorizedHandler(clearLocalSession);
    setApiSessionRefreshHandler((session) => {
      if (!active) return;
      setUser(session.user);
      void saveAuthSession(session);
    });

    void (async () => {
      const cached = await loadAuthSession();
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
        if (!active) return;
        setApiAccessToken(response.accessToken);
        setApiRefreshToken(response.refreshToken ?? null);
        setUser(response.user);
        await saveAuthSession(response);
      } catch (reason) {
        if (!active) return;
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
  }, []);

  const authenticate = useCallback(async (request: () => ReturnType<typeof authApi.login>) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await request();
      setApiAccessToken(response.accessToken);
      setApiRefreshToken(response.refreshToken ?? null);
      setUser(response.user);
      await saveAuthSession(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xác thực tài khoản');
      throw reason;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const updateName = useCallback((fullName: string) => {
    setUser((current) => current ? { ...current, fullName } : current);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (user) await authApi.logout();
    } catch {
      // Local logout must still succeed when the API is temporarily unavailable.
    } finally {
      setApiAccessToken(null);
      setApiRefreshToken(null);
      setUser(null);
      setError(null);
      await clearAuthSession();
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    isLoggedIn: Boolean(user),
    isRestoring,
    isSubmitting,
    user,
    userName: user?.fullName ?? '',
    error,
    clearError,
    login: (email, password) => authenticate(() => authApi.login(email.trim(), password)),
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
