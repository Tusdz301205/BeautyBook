import { API_BASE_URL } from '../config/api';
import type { ApiAuthResponse } from '../types/api';

type QueryValue = string | number | boolean | null | undefined;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionGeneration = 0;
const tokenListeners = new Set<(token: string | null) => void>();

export const getApiAccessToken = () => accessToken;
export const getApiSessionGeneration = () => sessionGeneration;
export function subscribeApiAccessToken(listener: (token: string | null) => void) {
  tokenListeners.add(listener);
  return () => { tokenListeners.delete(listener); };
}
function publishToken() {
  for (const listener of tokenListeners) listener(accessToken);
}
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
  // External session replacement/logout fences any in-flight refresh.
  sessionGeneration += 1;
  refreshPromise = null;
  accessToken = token;
  publishToken();
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
  let text: string;
  try { text = await response.text(); }
  catch (error) { throw new ApiError('Kết nối bị gián đoạn khi nhận phản hồi.', 0, error); }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  if (!refreshToken) {
    setApiAccessToken(null);
    unauthorizedHandler?.();
    return null;
  }
  const generation = sessionGeneration;
  const capturedRefreshToken = refreshToken;
  const pending = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: capturedRefreshToken,
          refreshTokenTransport: 'BODY',
        }),
      });
    } catch (error) {
      throw new ApiError('Không kết nối được để làm mới phiên. Vui lòng thử lại.', 0, error);
    }
    const payload = await parseResponse(response) as ApiAuthResponse | undefined;
    if (generation !== sessionGeneration) return null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setApiRefreshToken(null);
        setApiAccessToken(null);
        unauthorizedHandler?.();
        return null;
      }
      throw new ApiError('Chưa làm mới được phiên. Vui lòng thử lại.', response.status, payload);
    }
    if (!payload?.accessToken || !payload.user) {
      throw new ApiError('Phản hồi làm mới phiên không hợp lệ.', 502, payload);
    }
    // Rotation keeps the session generation; callers in this session may retry.
    accessToken = payload.accessToken;
    refreshToken = payload.refreshToken ?? capturedRefreshToken;
    sessionRefreshHandler?.(payload);
    publishToken();
    return accessToken;
  });
  refreshPromise = pending();
  const flight = refreshPromise;
  try { return await flight; }
  finally { if (refreshPromise === flight) refreshPromise = null; }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('Chưa cấu hình máy chủ cho bản thử nghiệm này.', 0);
  const generation = sessionGeneration;
  const sentToken = accessToken;
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

  if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi.', 401);
  if (response.status === 401 && retryOnUnauthorized && !path.startsWith('/auth/')) {
    const token = sentToken !== accessToken && accessToken ? accessToken : await refreshAccessToken();
    if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi.', 401);
    // Reuse the original generated idempotency key as well as explicit keys/body.
    if (token) return apiRequest<T>(path, { ...init, headers }, false);
  }

  const payload = await parseResponse(response);
  if (generation !== sessionGeneration) throw new ApiError('Phiên đăng nhập đã thay đổi.', 401);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, `Yêu cầu chưa được xử lý (mã ${response.status}). Vui lòng thử lại.`), response.status, payload);
  }
  return payload as T;
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
