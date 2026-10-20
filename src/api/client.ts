import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { Platform } from 'react-native';

// Dev: set EXPO_PUBLIC_API_URL (e.g. http://<LAN-IP>:8080) in .env
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://workout-api.jjoon.cloud';
const TOKEN_KEY = 'auth.token';
const REQUEST_TIMEOUT_MS = 10_000;

/** Login token lives in the device's secure storage (NFR-SEC-003). Web has no secure store: localStorage (dev only). */
export const tokenStore =
  Platform.OS === 'web'
    ? {
        get: async () => localStorage.getItem(TOKEN_KEY),
        set: async (token: string) => localStorage.setItem(TOKEN_KEY, token),
        clear: async () => localStorage.removeItem(TOKEN_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
        clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    /** Per-field reasons, only on 400 VALIDATION_FAILED (architecture 8.1). */
    readonly errors?: { field: string; reason: string }[],
  ) {
    super(message);
  }
}

type Init = { method?: string; body?: unknown; headers?: Record<string, string> };

/** Session codes that mean "log in again" (auth design 4.2); any other 401 is handled by the caller. */
const SESSION_CODES = ['AUTH_SESSION_EXPIRED', 'AUTH_SESSION_REPLACED', 'AUTH_SESSION_REVOKED', 'UNAUTHORIZED'];

/**
 * JSON (or FormData) request; sends the stored token when there is one. 2xx without a body resolves to undefined.
 * A 401 on an authenticated call clears the token and goes back to the login screen with the reason.
 */
export async function request<T = void>(path: string, init: Init = {}): Promise<T> {
  const token = await tokenStore.get();
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  // An unreachable server otherwise hangs for ~60s+ (e.g. the startup session check leaves a blank screen).
  // Uploads are exempt: a video can legitimately take longer.
  const controller = new AbortController();
  const timer = isForm ? undefined : setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      body: init.body ? (isForm ? (init.body as FormData) : JSON.stringify(init.body)) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
  return handleResponse<T>(path, token, res.status, await res.text());
}

export const networkError = () => new ApiError(0, 'NETWORK_ERROR', '네트워크 연결을 확인해 주세요.');

/** Body of a finished response, or an ApiError. Shared by `request` and native uploads (which don't go through fetch). */
export async function handleResponse<T>(path: string, token: string | null, status: number, text: string): Promise<T> {
  const data = text ? JSON.parse(text) : undefined;
  if (status < 200 || status >= 300) {
    const err = new ApiError(status, data?.code ?? 'UNKNOWN', data?.message ?? '요청에 실패했습니다.', data?.details, data?.errors);
    if (status === 401 && token && SESSION_CODES.includes(err.code) && !path.startsWith('/api/v1/auth/')) {
      await tokenStore.clear();
      router.replace({ pathname: '/', params: { reason: err.code } });
    }
    throw err;
  }
  return data as T;
}

/** Headers for loading protected files (photos/videos) outside `request`. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
