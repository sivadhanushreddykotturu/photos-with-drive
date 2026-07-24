<script lang="ts">
  import { goto } from '$app/navigation';
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import Thumbnail from '$lib/components/assets/thumbnail/Thumbnail.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import { listFavorites } from '$lib/api/files';
  import type { FileRecord } from '$lib/api/types';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { Route } from '$lib/route';
  import { handleError } from '$lib/utils/handle-error';
  import { LoadingSpinner } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let files: FileRecord[] | undefined = $state();

  onMount(async () => {
    try {
      files = await listFavorites();
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
      files = [];
    }
  });
</script>

<UserPageLayout title={$t('favorites')}>
  <div class="flex flex-col gap-4 p-4">
    {#if files === undefined}
      <div class="flex justify-center p-10"><LoadingSpinner /></div>
    {:else if files.length === 0}
      <EmptyPlaceholder text={$t('no_favorites_message')} class="mx-auto mt-10" />
    {:else}
      <div class="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {#each files as file (file.id)}
          <div class="aspect-square overflow-hidden">
            <Thumbnail
              asset={mediaStore.fileToTimelineAsset(file)}
              thumbnailSize={200}
              readonly
              disableLinkMouseOver
              onClick={() => goto(Route.viewAsset({ id: file.id }))}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</UserPageLayout>
