<script lang="ts">
  import { listAlbums, createAlbum, type Album } from '$lib/api/albums';
  import { getFileMediaUrl } from '$lib/api/files';
  import { handleError } from '$lib/utils/handle-error';
  import { Button, Field, FormModal, Icon, Input, LoadingSpinner } from '@immich/ui';
  import { mdiImageAlbum, mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (albumId?: string) => void;
  };

  let { onClose }: Props = $props();

  let albums: Album[] | undefined = $state();
  let newAlbumName = $state('');
  let creating = $state(false);

  onMount(async () => {
    try {
      albums = await listAlbums();
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_albums'));
      albums = [];
    }
  });

  const handleCreate = async (event: Event) => {
    event.preventDefault();
    const name = newAlbumName.trim();
    if (!name || creating) {
      return;
    }

    creating = true;
    try {
      const album = await createAlbum(name);
      onClose(album.id);
    } catch (error) {
      handleError(error, $t('errors.unable_to_create_album'));
      creating = false;
    }
  };
</script>

<FormModal title={$t('add_to_album')} icon={mdiImageAlbum} {onClose} onSubmit={() => onClose()}>
  <div class="flex max-h-80 flex-col gap-2 overflow-y-auto">
    {#if albums === undefined}
      <div class="flex justify-center p-4"><LoadingSpinner /></div>
    {:else}
      {#each albums as album (album.id)}
        <button
          type="button"
          class="flex items-center gap-3 rounded-xl p-2 text-start transition-colors hover:bg-immich-primary/10 dark:hover:bg-immich-dark-primary/20"
          onclick={() => onClose(album.id)}
        >
          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
            {#if album.coverAssetId}
              <img src={getFileMediaUrl(album.coverAssetId)} alt="" class="h-full w-full object-cover" loading="lazy" />
            {:else}
              <div class="flex h-full w-full items-center justify-center text-gray-400">
                <Icon icon={mdiImageAlbum} size="24" />
              </div>
            {/if}
          </div>
          <div class="min-w-0">
            <p class="truncate font-medium">{album.name}</p>
            <p class="text-xs text-gray-500">{$t('album_assets_count', { values: { count: album.assetCount } })}</p>
          </div>
        </button>
      {/each}
    {/if}
  </div>

  <form onsubmit={handleCreate} class="mt-2 flex items-end gap-2 border-t pt-3">
    <div class="flex-1">
      <Field label={$t('new_album')}>
        <Input bind:value={newAlbumName} placeholder={$t('album_name')} />
      </Field>
    </div>
    <Button type="submit" shape="round" size="small" leadingIcon={mdiPlus} loading={creating} disabled={!newAlbumName.trim()}>
      {$t('create_album')}
    </Button>
  </form>
</FormModal>
