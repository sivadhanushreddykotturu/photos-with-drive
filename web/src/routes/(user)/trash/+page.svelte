<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/UserPageLayout.svelte';
  import Thumbnail from '$lib/components/assets/thumbnail/Thumbnail.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/EmptyPlaceholder.svelte';
  import {
    emptyTrash,
    listTrashedFiles,
    permanentlyDeleteFile,
    restoreFile,
  } from '$lib/api/files';
  import type { FileRecord } from '$lib/api/types';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { Button, IconButton, LoadingSpinner, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteForeverOutline, mdiDeleteOutline, mdiRestore } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let files: FileRecord[] | undefined = $state();
  let emptying = $state(false);

  const loadTrash = async () => {
    try {
      files = await listTrashedFiles();
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
      files = [];
    }
  };

  onMount(loadTrash);

  const handleRestore = async (file: FileRecord) => {
    try {
      await restoreFile(file.id);
      files = files?.filter((existing) => existing.id !== file.id);
      mediaStore.addFile(file);
      toastManager.primary($t('restored'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };

  const handlePermanentDelete = async (file: FileRecord) => {
    const confirmed = await modalManager.showDialog({
      title: $t('delete_forever'),
      prompt: $t('permanently_delete_assets_prompt', { values: { count: 1 } }),
    });
    if (!confirmed) {
      return;
    }

    try {
      await permanentlyDeleteFile(file.id);
      files = files?.filter((existing) => existing.id !== file.id);
      toastManager.primary($t('permanently_deleted_asset'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };

  const handleEmptyTrash = async () => {
    const confirmed = await modalManager.showDialog({
      title: $t('empty_trash'),
      prompt: $t('empty_trash_confirmation'),
    });
    if (!confirmed) {
      return;
    }

    emptying = true;
    try {
      const result = await emptyTrash();
      files = [];
      toastManager.primary($t('permanently_deleted_assets_count', { values: { count: result.deleted } }));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    } finally {
      emptying = false;
    }
  };
</script>

<UserPageLayout title={$t('trash')}>
  <div class="flex flex-col gap-4 p-4">
    {#if files && files.length > 0}
      <div class="flex justify-end">
        <Button
          shape="round"
          size="small"
          color="danger"
          variant="ghost"
          leadingIcon={mdiDeleteForeverOutline}
          loading={emptying}
          onclick={handleEmptyTrash}
        >
          {$t('empty_trash')}
        </Button>
      </div>
    {/if}

    {#if files === undefined}
      <div class="flex justify-center p-10"><LoadingSpinner /></div>
    {:else if files.length === 0}
      <EmptyPlaceholder text={$t('trash_is_empty')} class="mx-auto mt-10" />
    {:else}
      <div class="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {#each files as file (file.id)}
          <div class="group relative aspect-square overflow-hidden">
            <Thumbnail
              asset={mediaStore.fileToTimelineAsset(file)}
              thumbnailSize={200}
              readonly
              disableLinkMouseOver
            />
            <div class="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton
                shape="round"
                color="secondary"
                size="tiny"
                icon={mdiRestore}
                aria-label={$t('restore')}
                onclick={() => handleRestore(file)}
              />
              <IconButton
                shape="round"
                color="danger"
                size="tiny"
                icon={mdiDeleteOutline}
                aria-label={$t('delete_forever')}
                onclick={() => handlePermanentDelete(file)}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</UserPageLayout>
