<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import Thumbnail from '$lib/components/assets/thumbnail/Thumbnail.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import { addAssetsToAlbum, getAlbum, removeAssetsFromAlbum, type Album } from '$lib/api/albums';
  import type { FileRecord } from '$lib/api/types';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { Route } from '$lib/route';
  import { openFileUploadDialog } from '$lib/utils/file-uploader';
  import { handleError } from '$lib/utils/handle-error';
  import { Button, IconButton, LoadingSpinner, toastManager } from '@immich/ui';
  import { mdiArrowLeft, mdiClose, mdiTrayArrowUp } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let album: Album | undefined = $state();
  let files: FileRecord[] | undefined = $state();
  let uploading = $state(false);

  const albumId = $derived(page.params.albumId as string);

  const loadAlbum = async () => {
    try {
      const data = await getAlbum(albumId);
      album = data.album;
      files = data.files;
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_albums'));
      files = [];
    }
  };

  onMount(loadAlbum);

  // Upload straight into this album: picker -> Drive upload -> add membership.
  const handleUpload = async () => {
    if (uploading) {
      return;
    }
    uploading = true;
    try {
      const uploadedIds = await openFileUploadDialog();
      if (uploadedIds.length > 0) {
        album = await addAssetsToAlbum(albumId, uploadedIds);
        await loadAlbum();
        toastManager.primary($t('added_to_album'));
      }
    } catch (error) {
      handleError(error, $t('errors.unable_to_upload_file'));
    } finally {
      uploading = false;
    }
  };

  const handleRemove = async (event: Event, file: FileRecord) => {
    event.stopPropagation();
    try {
      album = await removeAssetsFromAlbum(albumId, [file.id]);
      files = files?.filter((existing) => existing.id !== file.id);
      toastManager.primary($t('removed_from_album'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };
</script>

<UserPageLayout title={album?.name ?? $t('albums')}>
  <div class="flex flex-col gap-4 p-4">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <IconButton
          shape="round"
          color="secondary"
          variant="ghost"
          icon={mdiArrowLeft}
          aria-label={$t('go_back')}
          onclick={() => goto(Route.albums())}
        />
        {#if album}
          <div>
            <h1 class="text-lg font-medium">{album.name}</h1>
            <p class="text-xs text-gray-500">{$t('album_assets_count', { values: { count: album.assetCount } })}</p>
          </div>
        {/if}
      </div>
      <Button
        shape="round"
        size="small"
        variant="ghost"
        color="secondary"
        leadingIcon={mdiTrayArrowUp}
        loading={uploading}
        onclick={handleUpload}
      >
        {$t('add_photos')}
      </Button>
    </div>

    {#if files === undefined}
      <div class="flex justify-center p-10"><LoadingSpinner /></div>
    {:else if files.length === 0}
      <EmptyPlaceholder text={$t('no_assets_message')} onClick={handleUpload} class="mx-auto mt-10" />
    {:else}
      <div class="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {#each files as file (file.id)}
          <div class="group relative aspect-square overflow-hidden">
            <Thumbnail
              asset={mediaStore.fileToTimelineAsset(file)}
              thumbnailSize={200}
              readonly
              disableLinkMouseOver
              onClick={() => goto(Route.viewAsset({ id: file.id }))}
            />
            <div class="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton
                shape="round"
                color="secondary"
                size="tiny"
                icon={mdiClose}
                aria-label={$t('remove_from_album')}
                onclick={(e: MouseEvent) => handleRemove(e, file)}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</UserPageLayout>
