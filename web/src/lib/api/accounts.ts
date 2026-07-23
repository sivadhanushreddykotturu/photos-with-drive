import { apiFetch } from './client';
import type { ConnectedAccount, StorageQuota } from './types';

export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts');
  return data.accounts;
}

export async function getGoogleConnectUrl(): Promise<string> {
  const data = await apiFetch<{ url: string }>('/connected-accounts/google/connect-url');
  return data.url;
}

export async function syncAccountQuota(id: string): Promise<StorageQuota> {
  const data = await apiFetch<{ quota: StorageQuota }>(`/connected-accounts/${id}/sync-quota`, { method: 'POST' });
  return data.quota;
}

export async function deleteConnectedAccount(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/connected-accounts/${id}`, { method: 'DELETE' });
}
