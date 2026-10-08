import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Dev: set EXPO_PUBLIC_API_URL (e.g. http://<LAN-IP>:8080) in .env
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://workout-api.jjoon.cloud';
const TOKEN_KEY = 'auth.token';

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
  ) {
    super(message);
  }
}

/** JSON request; sends the stored token when there is one. 2xx without a body resolves to undefined. */
export async function request<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '네트워크 연결을 확인해 주세요.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'UNKNOWN', data?.message ?? '요청에 실패했습니다.', data?.details);
  return data as T;
}
