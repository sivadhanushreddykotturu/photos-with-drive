import { apiFetch } from './client';
import type { FileRecord } from './types';

export type Album = {
  id: string;
  name: string;
  assetCount: number;
  coverAssetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listAlbums(): Promise<Album[]> {
  const data = await apiFetch<{ albums: Album[] }>('/albums');
  return data.albums;
}

export async function createAlbum(name: string): Promise<Album> {
  const data = await apiFetch<{ album: Album }>('/albums', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.album;
}

export async function getAlbum(id: string): Promise<{ album: Album; files: FileRecord[] }> {
  return apiFetch<{ album: Album; files: FileRecord[] }>(`/albums/${id}`);
}

export async function patchAlbum(id: string, update: { name?: string; coverAssetId?: string | null }): Promise<Album> {
  const data = await apiFetch<{ album: Album }>(`/albums/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
  return data.album;
}

export async function deleteAlbum(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/albums/${id}`, { method: 'DELETE' });
}

export async function addAssetsToAlbum(albumId: string, assetIds: string[]): Promise<Album> {
  const data = await apiFetch<{ album: Album }>(`/albums/${albumId}/assets`, {
    method: 'PUT',
    body: JSON.stringify({ assetIds }),
  });
  return data.album;
}

export async function removeAssetsFromAlbum(albumId: string, assetIds: string[]): Promise<Album> {
  const data = await apiFetch<{ album: Album }>(`/albums/${albumId}/assets`, {
    method: 'DELETE',
    body: JSON.stringify({ assetIds }),
  });
  return data.album;
}
