import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { ApiAuthResponse } from '../types/api';

const SESSION_KEY = 'beautybook.customer.session';

function webStorage() {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) return null;
  return globalThis.localStorage;
}

export async function saveAuthSession(session: ApiAuthResponse): Promise<void> {
  const serialized = JSON.stringify(session);
  if (Platform.OS === 'web') {
    webStorage()?.setItem(SESSION_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadAuthSession(): Promise<ApiAuthResponse | null> {
  try {
    const serialized = Platform.OS === 'web'
      ? webStorage()?.getItem(SESSION_KEY) ?? null
      : await SecureStore.getItemAsync(SESSION_KEY);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Partial<ApiAuthResponse>;
    if (!parsed.accessToken || !parsed.user?.id || !parsed.user.email) return null;
    return parsed as ApiAuthResponse;
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
