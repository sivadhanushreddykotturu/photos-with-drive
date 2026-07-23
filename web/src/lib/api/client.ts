import { PUBLIC_API_URL } from '$env/static/public';
import type { ApiErrorBody } from './types';

// Base URL of the custom backend. Empty string = same origin.
export const apiBaseUrl = (PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorBody['details'],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Cross-site clients (Android WebView) cannot use the httpOnly cookie, so the
// refresh token is also persisted client-side and sent in the request body.
const REFRESH_TOKEN_KEY = 'photodrive_refresh_token';

export const setRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const storedToken = getStoredRefreshToken();
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // httpOnly refresh cookie (browser path)
        headers: storedToken ? { 'Content-Type': 'application/json' } : undefined,
        body: storedToken ? JSON.stringify({ refreshToken: storedToken }) : undefined,
      });
      if (!response.ok) {
        setAccessToken(null);
        setRefreshToken(null);
        return null;
      }
      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken); // rotated token
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      // Allow the next expiry window to refresh again.
      setTimeout(() => (refreshPromise = null), 0);
    }
  })();
  return refreshPromise;
}

type ApiFetchOptions = RequestInit & { skipAuthRetry?: boolean };

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRetry, ...init } = options;
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: 'include' });

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: 'include' });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.code ?? 'UNKNOWN_ERROR',
      body?.message ?? `Request failed with status ${response.status}`,
      body?.details,
    );
  }

  return (await response.json()) as T;
}

/**
 * Media tags (<img>/<video>/<a download>) cannot send Authorization headers, so the
 * backend accepts the short-lived access token as a query param on GET media routes.
 */
export function buildMediaUrl(path: string, parameters: Record<string, string> = {}): string {
  const searchParameters = new URLSearchParams(parameters);
  if (accessToken) {
    searchParameters.set('access_token', accessToken);
  }
  const query = searchParameters.toString();
  return `${apiBaseUrl}${path}${query ? `?${query}` : ''}`;
}
