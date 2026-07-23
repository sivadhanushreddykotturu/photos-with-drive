<script lang="ts">
  import * as accountsApi from '$lib/api/accounts';
  import type { ConnectedAccount } from '$lib/api/types';
  import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { getByteUnitString } from '$lib/utils/byte-units';
  import { locale } from '$lib/stores/preferences.store';
  import { Button, Icon, IconButton, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiGoogleDrive, mdiRefresh } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t, date } from 'svelte-i18n';

  let accounts: ConnectedAccount[] | undefined = $state();
  let syncingId: string | null = $state(null);

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
        <li class="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <Icon icon={mdiGoogleDrive} size="28" class="shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{account.googleAccountEmail}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {formatQuota(account)}
              {#if account.lastSyncedAt}
                · {$t('last_synced')}: {$date(new Date(account.lastSyncedAt), { dateStyle: 'medium', timeStyle: 'short' })}
              {/if}
            </p>
            {#if account.storageQuota.total}
              <div class="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-1.5 rounded-full bg-immich-primary"
                  style:width="{Math.min(100, (100 * account.storageQuota.used) / account.storageQuota.total)}%"
                ></div>
              </div>
            {/if}
          </div>
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
        </li>
      {/each}
    </ul>
  {/if}

  <div>
    <Button leadingIcon={mdiGoogleDrive} shape="round" size="small" onclick={handleConnect}>
      {$t('connect_google_drive')}
    </Button>
  </div>
</div>
