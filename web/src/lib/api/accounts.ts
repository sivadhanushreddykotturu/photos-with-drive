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

/** Syncs every account's quota from Drive server-side and returns them fresh. */
export async function getFreshQuotas(): Promise<ConnectedAccount[]> {
  const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts/quota');
  return data.accounts;
}

export async function deleteConnectedAccount(id: string): Promise<void> {
  await apiFetch<{ status: string }>(`/connected-accounts/${id}`, { method: 'DELETE' });
}
