<script lang="ts">
  import type { OnAction, PreAction } from '$lib/components/asset-viewer/actions/action';
  import DeleteAction from '$lib/components/asset-viewer/actions/DeleteAction.svelte';
  import LoadingDots from '$lib/components/LoadingDots.svelte';
  import RenameAssetModal from '$lib/modals/RenameAssetModal.svelte';
  import ShareModal from '$lib/modals/ShareModal.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { languageManager } from '$lib/managers/language-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { getFileDownloadUrl, patchFile } from '$lib/api/files';
  import { fileRecordToAssetDto, type AssetResponseDto } from '$lib/api/compat';
  import { downloadUrl } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import { ActionButton, CommandPaletteDefaultProvider, IconButton, modalManager, toastManager, Tooltip, type ActionItem } from '@immich/ui';
  import { mdiArrowLeft, mdiArrowRight, mdiDownloadOutline, mdiHeart, mdiHeartOutline, mdiPencilOutline, mdiShareVariantOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    asset: AssetResponseDto;
    preAction: PreAction;
    onAction: OnAction;
    onClose?: () => void;
    onAssetChange?: (asset: AssetResponseDto) => void;
  }

  let { asset, preAction, onAction, onClose, onAssetChange }: Props = $props();

  const Close: ActionItem = $derived({
    title: $t('go_back'),
    icon: languageManager.rtl ? mdiArrowRight : mdiArrowLeft,
    onAction: () => onClose?.(),
    shortcuts: [{ key: 'Escape' }],
  });

  const handleDownload = () => {
    downloadUrl(getFileDownloadUrl(asset.id), asset.originalFileName);
  };

  const handleRename = async () => {
    const renamed = await modalManager.show(RenameAssetModal, { asset }).catch(() => undefined);
    if (renamed) {
      onAssetChange?.(renamed as AssetResponseDto);
    }
  };

  const handleFavorite = async () => {
    const next = !asset.isFavorite;
    try {
      const updated = await patchFile(asset.id, { isFavorite: next });
      const dto = fileRecordToAssetDto(updated);
      onAssetChange?.(dto);
      eventManager.emit('AssetUpdate', dto);
      toastManager.primary(next ? $t('added_to_favorites') : $t('removed_from_favorites'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_save_changes'));
    }
  };

  const handleShare = async () => {
    await modalManager.show(ShareModal, { fileId: asset.id, name: asset.originalFileName }).catch(() => undefined);
  };
</script>

<CommandPaletteDefaultProvider name={$t('assets')} actions={[Close]} />

<div
  class="flex h-16 place-items-center justify-between bg-linear-to-b from-black/40 px-3 drop-shadow-[0_0_1px_rgba(0,0,0,0.4)] transition-transform duration-200"
>
  <div class="dark">
    <ActionButton action={Close} />
  </div>

  <div
    class="dark -m-1 flex items-center gap-2 overflow-x-auto p-1 *:shrink-0"
    data-testid="asset-viewer-navbar-actions"
  >
    {#if assetViewerManager.isImageLoading}
      <Tooltip text={$t('loading')}>
        {#snippet child({ props })}
          <div {...props} role="status" aria-label={$t('loading')}>
            <LoadingDots class="me-1" />
          </div>
        {/snippet}
      </Tooltip>
    {/if}

    <IconButton
      color="secondary"
      shape="round"
      variant="ghost"
      icon={asset.isFavorite ? mdiHeart : mdiHeartOutline}
      aria-label={asset.isFavorite ? $t('remove_from_favorites') : $t('add_to_favorites')}
      onclick={handleFavorite}
    />

    <IconButton
      color="secondary"
      shape="round"
      variant="ghost"
      icon={mdiShareVariantOutline}
      aria-label={$t('share_link')}
      onclick={handleShare}
    />

    <IconButton
      color="secondary"
      shape="round"
      variant="ghost"
      icon={mdiPencilOutline}
      aria-label={$t('rename')}
      onclick={handleRename}
    />

    <IconButton
      color="secondary"
      shape="round"
      variant="ghost"
      icon={mdiDownloadOutline}
      aria-label={$t('download')}
      onclick={handleDownload}
    />

    <DeleteAction {asset} {onAction} {preAction} />
  </div>
</div>
