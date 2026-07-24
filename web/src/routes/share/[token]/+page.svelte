<script lang="ts">
  import { page } from '$app/state';
  import AuthPageLayout from '$lib/components/layouts/AuthPageLayout.svelte';
  import { apiBaseUrl } from '$lib/api/client';
  import { getPublicSharedAlbum, getPublicSharedFile, type PublicSharedFile } from '$lib/api/share';
  import { Button, Icon, LoadingSpinner } from '@immich/ui';
  import { mdiAlertCircleOutline, mdiDownloadOutline, mdiImageAlbum } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  const token = $derived(page.params.token as string);

  let viewState: 'loading' | 'error' | 'ready' = $state('loading');
  let errorKind: 'expired' | 'invalid' = $state('invalid');
  let sharedFile: PublicSharedFile | undefined = $state();
  let sharedAlbum: { name: string; assetCount: number } | undefined = $state();
  let albumFiles: PublicSharedFile[] = $state([]);
  let expiresAt: string | null = $state(null);

  onMount(async () => {
    try {
      const data = await getPublicSharedFile(token, apiBaseUrl);
      sharedFile = data.file;
      expiresAt = data.expiresAt;
      viewState = 'ready';
      return;
    } catch (error) {
      errorKind = (error as Error).message === 'expired' ? 'expired' : 'invalid';
    }

    try {
      const data = await getPublicSharedAlbum(token, apiBaseUrl);
      sharedAlbum = data.album;
      albumFiles = data.files;
      expiresAt = data.expiresAt;
      viewState = 'ready';
    } catch (error) {
      errorKind = (error as Error).message === 'expired' ? 'expired' : 'invalid';
      viewState = 'error';
    }
  });

  const fileDownloadUrl = (id: string) => `${apiBaseUrl}/public/files/${token}/download?disposition=attachment`;
  const albumFileUrl = (fileId: string, attachment: boolean) =>
    `${apiBaseUrl}/public/albums/${token}/files/${fileId}/download?disposition=${attachment ? 'attachment' : 'inline'}`;
  const albumFileThumbUrl = (fileId: string) => `${apiBaseUrl}/public/albums/${token}/files/${fileId}/thumbnail`;
</script>

<AuthPageLayout>
  <div class="flex w-full max-w-5xl flex-col items-center gap-6 p-4">
    {#if viewState === 'loading'}
      <LoadingSpinner />
    {:else if viewState === 'error'}
      <div class="flex flex-col items-center gap-4 text-center">
        <Icon icon={mdiAlertCircleOutline} size="48" class="text-red-500" />
        <p class="text-lg">{errorKind === 'expired' ? $t('share_expired') : $t('share_invalid')}</p>
      </div>
    {:else if sharedFile}
      <h1 class="text-xl font-medium">{sharedFile.name}</h1>
      {#if expiresAt}
        <p class="text-xs text-gray-500">{$t('expires')}: {new Date(expiresAt).toLocaleDateString()}</p>
      {/if}
      {#if sharedFile.isVideo}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video class="max-h-[70dvh] max-w-full" src={`${apiBaseUrl}/public/files/${token}/download`} controls playsinline
        ></video>
      {:else}
        <img
          class="max-h-[70dvh] max-w-full object-contain"
          src={`${apiBaseUrl}/public/files/${token}/download`}
          alt={sharedFile.name}
        />
      {/if}
      <Button href={fileDownloadUrl(sharedFile.id)} shape="round" leadingIcon={mdiDownloadOutline}>
        {$t('download')}
      </Button>
    {:else if sharedAlbum}
      <div class="flex items-center gap-2">
        <Icon icon={mdiImageAlbum} size="28" class="text-primary" />
        <h1 class="text-xl font-medium">{sharedAlbum.name}</h1>
        <span class="text-sm text-gray-500">{$t('album_assets_count', { values: { count: sharedAlbum.assetCount } })}</span>
      </div>
      {#if expiresAt}
        <p class="text-xs text-gray-500">{$t('expires')}: {new Date(expiresAt).toLocaleDateString()}</p>
      {/if}
      <div class="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {#each albumFiles as file (file.id)}
          <a
            href={albumFileUrl(file.id, false)}
            target="_blank"
            rel="noopener noreferrer"
            class="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <img
              src={albumFileThumbUrl(file.id)}
              alt={file.name}
              class="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </a>
        {/each}
      </div>
    {/if}
  </div>
</AuthPageLayout>
