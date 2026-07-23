<script lang="ts">
  import { shortcuts } from '$lib/actions/shortcut';
  import { AssetAction } from '$lib/constants';
  import { deleteFile } from '$lib/api/files';
  import AssetDeleteConfirmModal from '$lib/modals/AssetDeleteConfirmModal.svelte';
  import { showDeleteModal } from '$lib/stores/preferences.store';
  import { handleError } from '$lib/utils/handle-error';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import type { AssetResponseDto } from '$lib/api/compat';
  import { IconButton, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteForeverOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import type { OnAction, PreAction } from './action';

  interface Props {
    asset: AssetResponseDto;
    onAction: OnAction;
    preAction: PreAction;
  }

  let { asset, onAction, preAction }: Props = $props();

  const handleDelete = async () => {
    const timelineAsset = toTimelineAsset(asset);

    if ($showDeleteModal) {
      const confirmed = await modalManager.show(AssetDeleteConfirmModal, { size: 1 });
      if (!confirmed) {
        return;
      }
    }

    try {
      preAction({ type: AssetAction.DELETE, asset: timelineAsset });
      await deleteFile(asset.id);
      onAction({ type: AssetAction.DELETE, asset: timelineAsset });
      toastManager.primary($t('permanently_deleted_asset'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_delete_asset'));
    }
  };
</script>

<svelte:document
  use:shortcuts={[{ shortcut: { key: 'Delete' }, onShortcut: () => handleDelete() }]}
/>

<IconButton
  color="secondary"
  shape="round"
  variant="ghost"
  icon={mdiDeleteForeverOutline}
  aria-label={$t('permanently_delete')}
  onclick={() => handleDelete()}
/>
