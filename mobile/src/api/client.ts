import { API_BASE_URL } from '../config/api';
import type { ApiAuthResponse } from '../types/api';

type QueryValue = string | number | boolean | null | undefined;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;
let sessionRefreshHandler: ((session: ApiAuthResponse) => void) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setApiRefreshToken(token: string | null) {
  refreshToken = token;
}

export function setApiUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setApiSessionRefreshHandler(handler: ((session: ApiAuthResponse) => void) | null) {
  sessionRefreshHandler = handler;
}

export function withQuery(path: string, query: object): string {
  const params = Object.entries(query as Record<string, QueryValue>)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return params ? `${path}?${params}` : path;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('\n');
  return typeof message === 'string' ? message : fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: refreshToken ?? undefined,
          refreshTokenTransport: 'BODY',
        }),
      });
    } catch {
      return null;
    }
    if (!response.ok) {
      setApiAccessToken(null);
      setApiRefreshToken(null);
      unauthorizedHandler?.();
      return null;
    }
    const payload = await parseResponse(response) as ApiAuthResponse | undefined;
    const token = payload?.accessToken ?? null;
    setApiAccessToken(token);
    setApiRefreshToken(payload?.refreshToken ?? null);
    if (payload?.user && token) sessionRefreshHandler?.(payload);
    return token;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('Chưa cấu hình máy chủ cho bản thử nghiệm này.', 0);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if ((init.method ?? 'GET').toUpperCase() === 'POST' && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', createIdempotencyKey('mobile'));
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch (error) {
    throw new ApiError(
      'Không kết nối được. Hãy kiểm tra mạng rồi thử lại.',
      0,
      error,
    );
  }

  if (response.status === 401 && retryOnUnauthorized && !path.startsWith('/auth/')) {
    const token = await refreshAccessToken();
    if (token) return apiRequest<T>(path, init, false);
    unauthorizedHandler?.();
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, `Yêu cầu chưa được xử lý (mã ${response.status}). Vui lòng thử lại.`), response.status, payload);
  }
  return payload as T;
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
