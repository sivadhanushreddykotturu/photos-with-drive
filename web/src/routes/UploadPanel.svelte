<script lang="ts">
  import { locale } from '$lib/stores/preferences.store';
  import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { uploadAssetsStore } from '$lib/stores/upload';
  import { cancelAllUploads, uploadExecutionQueue } from '$lib/utils/file-uploader';
  import { getByteUnitString } from '$lib/utils/byte-units';
  import { acquireWakeLock, releaseWakeLock } from '$lib/utils/wakelock.svelte';
  import { Icon, IconButton, toastManager } from '@immich/ui';
  import { mdiCancel, mdiCloseCircleMultipleOutline, mdiCloudUploadOutline, mdiCog, mdiWindowMinimize } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { quartInOut } from 'svelte/easing';
  import { fade, scale } from 'svelte/transition';
  import UploadAssetPreview from './UploadAssetPreview.svelte';

  let showDetail = $state(false);
  let showOptions = $state(false);
  let concurrency = $state(uploadExecutionQueue.concurrency);

  let { stats, isDismissible, isUploading, remainingUploads } = uploadAssetsStore;

  let hasRemaining = $derived($remainingUploads > 0);

  // Refresh quota display as uploads complete (server bumps `used` per file).
  onMount(() =>
    eventManager.on({
      AssetsUpload: () => void connectedAccountsStore.load(true),
    }),
  );

  $effect(() => {
    if ($isUploading) {
      showDetail = true;
      void connectedAccountsStore.load();
    }
  });

  $effect(() => {
    if (hasRemaining) {
      void acquireWakeLock();
    } else {
      void releaseWakeLock();
    }
  });
</script>

{#if $isUploading}
  <div
    in:fade={{ duration: 250 }}
    out:fade={{ duration: 250 }}
    onoutroend={() => {
      if ($stats.errors > 0) {
        toastManager.danger($t('upload_errors', { values: { count: $stats.errors } }));
      } else if ($stats.success > 0) {
        toastManager.primary($t('upload_success'));
      }
      if ($stats.duplicates > 0) {
        toastManager.warning($t('upload_skipped_duplicates', { values: { count: $stats.duplicates } }));
      }
      uploadAssetsStore.reset();
    }}
    class="fixed inset-e-16 bottom-6 z-60"
  >
    {#if showDetail}
      <div
        in:scale={{ duration: 250, easing: quartInOut }}
        class="w-81 rounded-xl border border-gray-200 bg-subtle p-4 text-sm shadow-xs dark:border-subtle"
      >
        <div class="place-item-center mb-4 flex justify-between">
          <div class="flex flex-col gap-1">
            <p class="text-xm immich-form-label">
              {$t('upload_progress', {
                values: {
                  remaining: $remainingUploads,
                  processed: $stats.total - $remainingUploads,
                  total: $stats.total,
                },
              })}
            </p>
            <p class="text-xs immich-form-label">
              {$t('upload_status_uploaded')}
              <span class="text-success">{$stats.success.toLocaleString($locale)}</span>
              -
              {$t('upload_status_errors')}
              <span class="text-danger">{$stats.errors.toLocaleString($locale)}</span>
              -
              {$t('upload_status_duplicates')}
              <span class="text-warning">{$stats.duplicates.toLocaleString($locale)}</span>
            </p>
          </div>
          <div class="flex flex-col items-end">
            <div class="flex flex-row">
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                icon={mdiCog}
                size="small"
                onclick={() => (showOptions = !showOptions)}
                aria-label={$t('toggle_settings')}
              />
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                aria-label={$t('minimize')}
                icon={mdiWindowMinimize}
                size="small"
                onclick={() => (showDetail = false)}
              />
            </div>
            {#if $isDismissible}
              <IconButton
                variant="ghost"
                shape="round"
                color="secondary"
                aria-label={$t('dismiss_all_errors')}
                icon={mdiCancel}
                size="small"
                onclick={() => uploadAssetsStore.dismissErrors()}
              />
            {/if}
            {#if hasRemaining}
              <IconButton
                variant="ghost"
                shape="round"
                color="danger"
                aria-label={$t('cancel_all')}
                title={$t('cancel_all')}
                icon={mdiCloseCircleMultipleOutline}
                size="small"
                onclick={() => cancelAllUploads()}
              />
            {/if}
          </div>
        </div>
        {#if showOptions}
          <div class="mb-4 max-h-100 immich-scrollbar overflow-y-auto rounded-lg">
            <div class="flex h-6.5 place-items-center gap-1">
              <label class="immich-form-label" for="upload-concurrency">{$t('upload_concurrency')}</label>
            </div>
            <input
              class="immich-form-input w-full"
              aria-labelledby={$t('upload_concurrency')}
              id="upload-concurrency"
              name={$t('upload_concurrency')}
              type="number"
              min="1"
              max="50"
              step="1"
              bind:value={concurrency}
              onchange={() => (uploadExecutionQueue.concurrency = concurrency)}
            />
          </div>
        {/if}
        <div class="flex max-h-[400px] immich-scrollbar flex-col gap-2 overflow-y-auto rounded-lg">
          {#each $uploadAssetsStore as uploadAsset (uploadAsset.id)}
            <UploadAssetPreview {uploadAsset} />
          {/each}
        </div>

        {#if connectedAccountsStore.accounts && connectedAccountsStore.accounts.length > 0}
          <div class="mt-3 flex flex-col gap-1.5 border-t border-gray-200 pt-3 dark:border-gray-700">
            {#each connectedAccountsStore.accounts as account (account.id)}
              {@const usedPercent = account.storageQuota.total
                ? Math.min(100, (100 * account.storageQuota.used) / account.storageQuota.total)
                : 0}
              <div class="flex items-center gap-2 text-xs">
                <span class="w-28 truncate text-gray-600 dark:text-gray-400" title={account.googleAccountEmail}>
                  {account.googleAccountEmail}
                </span>
                <div class="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div class="h-1.5 rounded-full bg-immich-primary transition-all" style:width="{usedPercent}%"></div>
                </div>
                <span class="shrink-0 text-gray-500 dark:text-gray-400">
                  {#if account.storageQuota.total}
                    {getByteUnitString(account.storageQuota.total - account.storageQuota.used, $locale)} {$t('free')}
                  {:else}
                    ∞
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="rounded-full">
        <button
          type="button"
          in:scale={{ duration: 250, easing: quartInOut }}
          onclick={() => (showDetail = true)}
          class="absolute -inset-s-4 -top-4 flex size-10 place-content-center place-items-center rounded-full bg-primary p-5 text-xs text-light"
        >
          {$remainingUploads.toLocaleString($locale)}
        </button>
        {#if $stats.errors > 0}
          <button
            type="button"
            in:scale={{ duration: 250, easing: quartInOut }}
            onclick={() => (showDetail = true)}
            class="absolute -inset-e-4 -top-4 flex size-10 place-content-center place-items-center rounded-full bg-danger p-5 text-xs text-light"
          >
            {$stats.errors.toLocaleString($locale)}
          </button>
        {/if}
        <button
          type="button"
          in:scale={{ duration: 250, easing: quartInOut }}
          onclick={() => (showDetail = true)}
          class="flex size-16 place-content-center place-items-center rounded-full bg-subtle p-5 text-sm text-primary shadow-lg"
        >
          <div class="animate-pulse">
            <Icon icon={mdiCloudUploadOutline} size="30" />
          </div>
        </button>
      </div>
    {/if}
  </div>
{/if}
