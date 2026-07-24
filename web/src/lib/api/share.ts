import { apiFetch } from './client';

export type ShareLink = {
  id: string;
  file: { id?: string; _id?: string; name: string; mimeType: string } | null;
  album: { id?: string; _id?: string; name: string } | null;
  expiresAt: string | null;
  createdAt: string;
};

export type PublicSharedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isVideo: boolean;
  createdTime: string;
};

export async function createShareLink(options: {
  fileId?: string;
  albumId?: string;
  expiresInHours?: number | null;
}): Promise<{ token: string; url: string; expiresAt: string | null }> {
  return apiFetch<{ token: string; url: string; expiresAt: string | null }>('/share', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const data = await apiFetch<{ links: ShareLink[] }>('/share');
  return data.links;
}

export async function deleteShareLink(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/share/${id}`, { method: 'DELETE' });
}

// Public endpoints (no auth — called from the /share/:token page or anywhere)
export async function getPublicSharedFile(token: string, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/public/files/${token}`);
  if (!response.ok) {
    throw new Error(response.status === 410 ? 'expired' : 'invalid');
  }
  return (await response.json()) as { file: PublicSharedFile; expiresAt: string | null };
}

export async function getPublicSharedAlbum(token: string, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/public/albums/${token}`);
  if (!response.ok) {
    throw new Error(response.status === 410 ? 'expired' : 'invalid');
  }
  return (await response.json()) as {
    album: { name: string; assetCount: number };
    files: PublicSharedFile[];
    expiresAt: string | null;
  };
}
