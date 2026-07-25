import { apiFetch, setAccessToken, setRefreshToken } from './client';
import type { ApiLoginResponse, ApiUser } from './types';

export async function login(email: string, password: string): Promise<ApiUser> {
  const data = await apiFetch<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuthRetry: true,
  });
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.user;
}

export async function register(name: string, email: string, password: string): Promise<void> {
  // Account starts unverified; session begins after /auth/verify-email.
  await apiFetch<{ status: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
    skipAuthRetry: true,
  });
}

export async function verifyEmail(email: string, code: string): Promise<ApiUser> {
  const data = await apiFetch<ApiLoginResponse>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    skipAuthRetry: true,
  });
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.user;
}

export async function resendVerification(email: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/verify-email/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuthRetry: true,
  });
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ status: string }>('/auth/logout', { method: 'POST', skipAuthRetry: true });
  } finally {
    setAccessToken(null);
    setRefreshToken(null);
  }
}

export async function getMe(): Promise<ApiUser> {
  const data = await apiFetch<{ user: ApiUser }>('/auth/me');
  return data.user;
}

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuthRetry: true,
  });
}

export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
    skipAuthRetry: true,
  });
}

export async function requestOtp(email: string): Promise<void> {
  await apiFetch<{ status: string }>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuthRetry: true,
  });
}

export async function verifyOtp(email: string, code: string): Promise<ApiUser> {
  const data = await apiFetch<ApiLoginResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    skipAuthRetry: true,
  });
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.user;
}
