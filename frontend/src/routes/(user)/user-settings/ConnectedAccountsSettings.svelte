<script lang="ts">
  import * as accountsApi from '$lib/api/accounts';
  import { syncGoogleFiles } from '$lib/api/files';
  import type { ConnectedAccount } from '$lib/api/types';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { getByteUnitString } from '$lib/utils/byte-units';
  import { locale } from '$lib/stores/preferences.store';
  import { Button, Icon, IconButton, LoadingSpinner, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiGoogleDrive, mdiRefresh, mdiSync } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t, date } from 'svelte-i18n';

  let accounts: ConnectedAccount[] | undefined = $state();
  let syncingId: string | null = $state(null);
  let librarySyncing = $state(false);

  const handleLibrarySync = async () => {
    if (librarySyncing) {
      return;
    }
    librarySyncing = true;
    try {
      const results = await syncGoogleFiles();
      const totals = results.reduce(
        (acc, r) => ({ created: acc.created + (r.created ?? 0), updated: acc.updated + (r.updated ?? 0), deleted: acc.deleted + (r.deleted ?? 0) }),
        { created: 0, updated: 0, deleted: 0 },
      );
      await mediaStore.invalidate();
      toastManager.primary(
        `${$t('sync_completed')} — ${totals.created} new, ${totals.updated} updated, ${totals.deleted} removed`,
      );
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    } finally {
      librarySyncing = false;
    }
  };

  const loadAccounts = async () => {
    try {
      // Force-refresh the shared store (covers returning from the Google OAuth redirect).
      accounts = await connectedAccountsStore.load(true);
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_accounts'));
      accounts = [];
    }
  };

  onMount(loadAccounts);

  const handleConnect = async () => {
    try {
      const url = await accountsApi.getGoogleConnectUrl();
      globalThis.location.assign(url);
    } catch (error) {
      handleError(error, $t('errors.unable_to_connect'));
    }
  };

  const handleSyncQuota = async (account: ConnectedAccount) => {
    syncingId = account.id;
    try {
      const quota = await accountsApi.syncAccountQuota(account.id);
      account.storageQuota = quota;
      account.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_accounts'));
    } finally {
      syncingId = null;
    }
  };

  const handleDisconnect = async (account: ConnectedAccount) => {
    const confirmed = await modalManager.showDialog({
      title: $t('disconnect_account'),
      prompt: $t('disconnect_account_confirm'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await accountsApi.deleteConnectedAccount(account.id);
      accounts = accounts?.filter((existing) => existing.id !== account.id);
      connectedAccountsStore.accounts = accounts;
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_accounts'));
    }
  };

  const formatQuota = (account: ConnectedAccount) => {
    const used = getByteUnitString(account.storageQuota.used, $locale);
    if (account.storageQuota.total === null) {
      return used;
    }
    return `${used} / ${getByteUnitString(account.storageQuota.total, $locale)}`;
  };
</script>

<div class="flex flex-col gap-4">
  {#if accounts === undefined}
    <div class="flex justify-center p-4"><LoadingSpinner /></div>
  {:else if accounts.length === 0}
    <p class="text-sm text-gray-500 dark:text-gray-400">{$t('no_connected_accounts')}</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each accounts as account (account.id)}
        <li class="flex items-start gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <Icon icon={mdiGoogleDrive} size="30" class="mt-0.5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">{account.googleAccountEmail}</p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {formatQuota(account)}
              {#if account.lastSyncedAt}
                &nbsp;·&nbsp;{$t('last_synced')}: {$date(new Date(account.lastSyncedAt), { dateStyle: 'medium', timeStyle: 'short' })}
              {/if}
            </p>
            {#if account.storageQuota.total}
              <div class="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-1.5 rounded-full bg-immich-primary"
                  style:width="{Math.min(100, (100 * account.storageQuota.used) / account.storageQuota.total)}%"
                ></div>
              </div>
            {/if}
          </div>
          <div class="flex shrink-0 items-center gap-1 border-s ps-2">
            <IconButton
              shape="round"
              color="secondary"
              variant="ghost"
              size="small"
              icon={mdiRefresh}
              aria-label={$t('sync_quota')}
              loading={syncingId === account.id}
              onclick={() => handleSyncQuota(account)}
            />
            <IconButton
              shape="round"
              color="danger"
              variant="ghost"
              size="small"
              icon={mdiDeleteOutline}
              aria-label={$t('disconnect_account')}
              onclick={() => handleDisconnect(account)}
            />
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex items-center gap-2">
    <Button leadingIcon={mdiGoogleDrive} shape="round" size="small" onclick={handleConnect}>
      {$t('connect_google_drive')}
    </Button>
    {#if accounts && accounts.length > 0}
      <Button leadingIcon={mdiSync} shape="round" size="small" variant="ghost" color="secondary" loading={librarySyncing} onclick={handleLibrarySync}>
        {$t('sync_library')}
      </Button>
    {/if}
  </div>
  {#if accounts && accounts.length > 0}
    <p class="text-xs text-gray-500 dark:text-gray-400">{$t('sync_library_description')}</p>
  {/if}
</div>
