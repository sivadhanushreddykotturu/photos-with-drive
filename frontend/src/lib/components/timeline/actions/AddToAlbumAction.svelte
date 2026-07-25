<script lang="ts">
  import MenuOption from '$lib/components/shared-components/context-menu/MenuOption.svelte';
  import { addAssetsToAlbum } from '$lib/api/albums';
  import AlbumPickerModal from '$lib/modals/AlbumPickerModal.svelte';
  import { assetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { handleError } from '$lib/utils/handle-error';
  import { modalManager, toastManager } from '@immich/ui';
  import { mdiImageAlbum } from '@mdi/js';
  import { t } from 'svelte-i18n';

  const onAction = async () => {
    const assets = assetMultiSelectManager.assets;
    if (assets.length === 0) {
      return;
    }

    const albumId = await modalManager.show(AlbumPickerModal, {}).catch(() => undefined);
    if (!albumId) {
      return;
    }

    try {
      await addAssetsToAlbum(albumId as string, assets.map((asset) => asset.id));
      toastManager.primary($t('added_to_album'));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };
</script>

<MenuOption text={$t('add_to_album')} icon={mdiImageAlbum} onClick={onAction} />
