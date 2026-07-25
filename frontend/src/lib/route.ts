import { OpenQueryParam } from '$lib/constants';

type QueryValue = number | string;
const asQueryString = (
  params?: Record<string, QueryValue | undefined>,
  options?: { skipEmptyStrings?: boolean; skipNullValues?: boolean },
) => {
  const { skipEmptyStrings = true, skipNullValues = true } = options ?? {};
  const items = Object.entries(params ?? {})
    .filter((item): item is [string, QueryValue] => {
      const value = item[1];

      if (value === undefined) {
        return false;
      }

      if (skipNullValues && value === null) {
        return false;
      }

      return !(skipEmptyStrings && value === '');
    })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  return items.length === 0 ? '' : `?${items.join('&')}`;
};

export const Route = {
  // auth
  login: (params?: { continue?: string }) => '/auth/login' + asQueryString(params),
  logout: (params?: { continue?: string }) => '/auth/logout' + asQueryString(params),
  register: () => '/auth/register',
  forgotPassword: () => '/auth/forgot-password',

  // photos
  photos: (params?: { at?: string }) => '/photos' + asQueryString(params),
  viewAsset: ({ id }: { id: string }) => `/photos/${id}`,

  // albums
  albums: () => '/albums',
  viewAlbum: ({ id }: { id: string }) => `/albums/${id}`,

  // library
  favorites: () => '/favorites',
  trash: () => '/trash',

  // public share (unauthenticated)
  viewSharedLink: ({ token }: { token: string }) => `/share/${token}`,

  // settings
  userSettings: (params?: { isOpen?: OpenQueryParam }) => '/user-settings' + asQueryString(params),

  // continue helper for ensuring same-origin URLs
  continue: (url: string | null, fallback: string): string | URL => {
    const resolved = new URL(url ?? fallback, document.baseURI);

    if (resolved.origin !== location.origin) {
      return fallback;
    }

    return resolved;
  },
};
