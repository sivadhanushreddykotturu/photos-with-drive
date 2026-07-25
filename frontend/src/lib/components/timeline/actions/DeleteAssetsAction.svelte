<script lang="ts">
  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { deleteFile } from '$lib/api/files';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import AssetDeleteConfirmModal from '$lib/modals/AssetDeleteConfirmModal.svelte';
  import { showDeleteModal } from '$lib/stores/preferences.store';
  import { handleError } from '$lib/utils/handle-error';
  import { IconButton, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteForeverOutline, mdiTimerSand } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    onAssetDelete: (ids: string[]) => void;
    menuItem?: boolean;
  };

  let { onAssetDelete, menuItem = false }: Props = $props();

  let label = $derived($t('permanently_delete'));
  let loading = $state(false);

  const onAction = async () => {
    const assets = assetMultiSelectManager.ownedAssets;
    const ids = assets.map((asset) => asset.id);

    if ($showDeleteModal) {
      const confirmed = await modalManager.show(AssetDeleteConfirmModal, { size: assets.length });
      if (!confirmed) {
        return;
      }
    }

    loading = true;
    try {
      for (const id of ids) {
        await deleteFile(id);
      }
      onAssetDelete(ids);
      toastManager.primary($t('permanently_deleted_assets_count', { values: { count: assets.length } }));
    } catch (error) {
      handleError(error, $t('errors.unable_to_delete_assets'));
    }
    assetMultiSelectManager.clear();
    loading = false;
  };
</script>

{#if menuItem}
  <MenuOption text={label} icon={mdiDeleteForeverOutline} onClick={onAction} />
{:else if loading}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$t('loading')}
    icon={mdiTimerSand}
    onclick={() => {}}
  />
{:else}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={label}
    icon={mdiDeleteForeverOutline}
    onclick={onAction}
  />
{/if}
