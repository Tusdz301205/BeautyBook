import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { savedServicesApi, type SavedService } from '../api/savedServices';
import { useAuth } from './AuthContext';
import { navigationRef } from '../navigation/navigationRef';

interface FavoritesContextValue {
  favorites: Record<string, boolean>;
  savedItems: SavedService[];
  isLoading: boolean;
  error: string | null;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, isRestoring } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [savedItems, setSavedItems] = useState<SavedService[]>([]);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUserIdRef = useRef(userId);
  const requestRef = useRef(0);
  currentUserIdRef.current = userId;
  const visibleFavorites = dataOwnerId === userId ? favorites : {};
  const visibleSavedItems = dataOwnerId === userId ? savedItems : [];

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!userId || isRestoring) {
      setFavorites({});
      setSavedItems([]);
      setDataOwnerId(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await savedServicesApi.list();
      if (currentUserIdRef.current !== userId || requestRef.current !== requestId) return;
      setSavedItems(items);
      setFavorites(Object.fromEntries(items.map((item) => [item.branchServiceOfferingId, true])));
      setDataOwnerId(userId);
      setError(null);
    } catch (reason) {
      if (currentUserIdRef.current === userId && requestRef.current === requestId) {
        setError(reason instanceof Error ? reason.message : 'Không tải được dịch vụ đã lưu');
      }
    } finally {
      if (currentUserIdRef.current === userId && requestRef.current === requestId) setLoading(false);
    }
  }, [userId, isRestoring]);

  useEffect(() => {
    if (!isRestoring) void reload();
  }, [isRestoring, reload]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!userId) {
      if (navigationRef.isReady()) navigationRef.navigate('Login', { returnTo: 'previous' });
      return;
    }
    try {
      if (visibleFavorites[id]) await savedServicesApi.remove(id);
      else await savedServicesApi.save(id);
      await reload();
    } catch (reason) {
      Alert.alert('Không thể cập nhật dịch vụ đã lưu', reason instanceof Error ? reason.message : 'Vui lòng thử lại.');
    }
  }, [visibleFavorites, userId, reload]);

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites: visibleFavorites, savedItems: visibleSavedItems, isLoading, error,
    isFavorite: (id) => !!visibleFavorites[id],
    toggleFavorite, reload,
  }), [visibleFavorites, visibleSavedItems, isLoading, error, toggleFavorite, reload]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
