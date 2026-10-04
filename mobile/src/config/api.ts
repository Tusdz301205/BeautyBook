import { Platform } from 'react-native';

const DEFAULT_API_ORIGIN = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000'
  : 'http://localhost:3000';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || `${DEFAULT_API_ORIGIN}/api/v1`
).replace(/\/$/, '');

