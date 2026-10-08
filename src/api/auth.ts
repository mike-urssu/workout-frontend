import { request, tokenStore } from './client';

export const login = async (loginId: string, pin: string) => {
  const { token } = await request<{ token: string }>('/api/v1/auth/login', { method: 'POST', body: { loginId, pin } });
  await tokenStore.set(token);
};

/** Resolves when the stored login is still valid (and extends it); throws ApiError otherwise. */
export const checkSession = () => request('/api/v1/auth/session');

/** Always clears the device token, even if the request fails (design 4.2). No menu calls this yet (D-TODO-AUTH-001). */
export const logout = async () => {
  try {
    await request('/api/v1/auth/logout', { method: 'POST' });
  } catch {}
  await tokenStore.clear();
};

/** Why the user is back on the login screen — shown as a notice (design 4.2 AUTH-001). */
export const REASON_NOTICE: Record<string, string> = {
  AUTH_SESSION_EXPIRED: '오랫동안 사용하지 않아 로그아웃되었습니다.',
  AUTH_SESSION_REPLACED: '다른 기기에서 로그인되어 로그아웃되었습니다.',
  AUTH_SESSION_REVOKED: '다시 로그인해 주세요.',
  UNAUTHORIZED: '다시 로그인해 주세요.',
};
