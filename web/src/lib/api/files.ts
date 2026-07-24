import { apiFetch, buildMediaUrl } from './client';
import type { FileGroup, FileRecord } from './types';

export async function listMediaFilesGrouped(): Promise<FileGroup[]> {
  const data = await apiFetch<{ groups: FileGroup[] }>('/files?type=media&groupBy=date');
  return data.groups;
}

export async function listFiles(folderId?: string): Promise<FileRecord[]> {
  const query = folderId === undefined ? '' : `?folderId=${encodeURIComponent(folderId)}`;
  const data = await apiFetch<{ files: FileRecord[] }>(`/files${query}`);
  return data.files;
}

export async function getFile(id: string): Promise<FileRecord> {
  const data = await apiFetch<{ file: FileRecord }>(`/files/${id}`);
  return data.file;
}

export async function patchFile(id: string, update: { name?: string; folderId?: string | null; isFavorite?: boolean }): Promise<FileRecord> {
  const data = await apiFetch<{ file: FileRecord }>(`/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
  return data.file;
}

/** Trash-only: the Drive file is kept, record is hidden until restore/permanent delete. */
export async function deleteFile(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/files/${id}`, { method: 'DELETE' });
}

export async function listTrashedFiles(): Promise<FileRecord[]> {
  const data = await apiFetch<{ files: FileRecord[] }>('/files/trash');
  return data.files;
}

export async function restoreFile(id: string): Promise<FileRecord> {
  const data = await apiFetch<{ file: FileRecord }>(`/files/${id}/restore`, { method: 'POST' });
  return data.file;
}

export async function permanentlyDeleteFile(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/files/${id}/permanent`, { method: 'DELETE' });
}

export async function emptyTrash(): Promise<{ deleted: number; failed: number }> {
  return apiFetch<{ deleted: number; failed: number }>('/files/trash/empty', { method: 'POST' });
}

export async function listFavorites(): Promise<FileRecord[]> {
  const data = await apiFetch<{ files: FileRecord[] }>('/files?favorite=true');
  return data.files;
}

export type SyncResult = {
  accountId: string;
  googleAccountEmail: string;
  created?: number;
  updated?: number;
  deleted?: number;
  error?: string;
};

export async function syncGoogleFiles(): Promise<SyncResult[]> {
  const data = await apiFetch<{ results: SyncResult[] }>('/files/sync-google', { method: 'POST' });
  return data.results;
}

/** Inline-viewable URL for <img>/<video> tags (token query param included). */
export function getFileMediaUrl(id: string): string {
  return buildMediaUrl(`/files/${id}/download`, { disposition: 'inline' });
}

/** Small Drive-generated thumbnail URL — use for covers/tiles, not full originals. */
export function getFileThumbnailUrl(id: string): string {
  return buildMediaUrl(`/files/${id}/thumbnail`);
}

/** Attachment URL for the browser download flow. */
export function getFileDownloadUrl(id: string): string {
  return buildMediaUrl(`/files/${id}/download`, { disposition: 'attachment' });
}
