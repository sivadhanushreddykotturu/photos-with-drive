<script lang="ts">
  import { goto } from '$app/navigation';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import { listAlbums, createAlbum, deleteAlbum, type Album } from '$lib/api/albums';
  import { getFileMediaUrl } from '$lib/api/files';
  import { Route } from '$lib/route';
  import { handleError } from '$lib/utils/handle-error';
  import { Button, Field, Icon, IconButton, Input, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiImageAlbum, mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let albums: Album[] | undefined = $state();
  let newAlbumName = $state('');
  let creating = $state(false);

  const loadAlbums = async () => {
    try {
      albums = await listAlbums();
    } catch (error) {
      handleError(error, $t('errors.unable_to_load_albums'));
      albums = [];
    }
  };

  onMount(loadAlbums);

  const handleCreate = async (event: Event) => {
    event.preventDefault();
    const name = newAlbumName.trim();
    if (!name || creating) {
      return;
    }

    creating = true;
    try {
      const album = await createAlbum(name);
      newAlbumName = '';
      await goto(Route.viewAlbum({ id: album.id }));
    } catch (error) {
      handleError(error, $t('errors.unable_to_create_album'));
    } finally {
      creating = false;
    }
  };

  const handleDelete = async (event: Event, album: Album) => {
    event.stopPropagation();
    const confirmed = await modalManager.showDialog({
      title: $t('delete_album'),
      prompt: $t('delete_album_confirmation'),
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteAlbum(album.id);
      albums = albums?.filter((existing) => existing.id !== album.id);
    } catch (error) {
      handleError(error, $t('errors.unable_to_delete_album'));
    }
  };
</script>

<UserPageLayout title={$t('albums')}>
  <div class="flex flex-col gap-6 p-4">
    <form onsubmit={handleCreate} class="flex max-w-md items-end gap-2">
      <div class="flex-1">
        <Field label={$t('new_album')}>
          <Input bind:value={newAlbumName} placeholder={$t('album_name')} />
        </Field>
      </div>
      <Button type="submit" shape="round" leadingIcon={mdiPlus} loading={creating} disabled={!newAlbumName.trim()}>
        {$t('create_album')}
      </Button>
    </form>

    {#if albums === undefined}
      <div class="flex justify-center p-10"><LoadingSpinner /></div>
    {:else if albums.length === 0}
      <EmptyPlaceholder text={$t('no_albums_message')} class="mx-auto mt-10" />
    {:else}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each albums as album (album.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="group relative cursor-pointer overflow-hidden rounded-2xl bg-gray-100 transition-shadow hover:shadow-lg dark:bg-immich-dark-gray"
            onclick={() => goto(Route.viewAlbum({ id: album.id }))}
            onkeydown={(e) => e.key === 'Enter' && goto(Route.viewAlbum({ id: album.id }))}
            role="button"
            tabindex="0"
          >
            <div class="aspect-square w-full overflow-hidden bg-gray-200 dark:bg-gray-800">
              {#if album.coverAssetId}
                <img
                  src={getFileMediaUrl(album.coverAssetId)}
                  alt={album.name}
                  class="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              {:else}
                <div class="flex h-full w-full items-center justify-center text-gray-400">
                  <Icon icon={mdiImageAlbum} size="64" />
                </div>
              {/if}
            </div>
            <div class="flex items-center justify-between gap-1 p-3">
              <div class="min-w-0">
                <p class="truncate font-medium">{album.name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {$t('album_assets_count', { values: { count: album.assetCount } })}
                </p>
              </div>
              <IconButton
                shape="round"
                color="danger"
                variant="ghost"
                size="small"
                icon={mdiDeleteOutline}
                aria-label={$t('delete_album')}
                onclick={(e: MouseEvent) => handleDelete(e, album)}
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</UserPageLayout>
