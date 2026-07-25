<script lang="ts">
  import { shortcuts, type ShortcutOptions } from '$lib/actions/shortcut';
  import {
    setFocusToAsset as setFocusAssetInit,
    setFocusTo as setFocusToInit,
  } from '$lib/components/timeline/actions/focus-actions';
  import type { AssetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
  import AssetDeleteConfirmModal from '$lib/modals/AssetDeleteConfirmModal.svelte';
  import ShortcutsModal from '$lib/modals/ShortcutsModal.svelte';
  import { keyboardManager } from '$lib/stores/keyboard-manager.svelte';
  import { showDeleteModal } from '$lib/stores/preferences.store';
  import { handlePromiseError } from '$lib/utils';
  import { selectAllAssets } from '$lib/utils/asset-utils';
  import { deleteFile } from '$lib/api/files';
  import { handleError } from '$lib/utils/handle-error';
  import { isModalOpen, modalManager, toastManager } from '@immich/ui';
  import { t } from 'svelte-i18n';

  type Props = {
    timelineManager: TimelineManager;
    assetInteraction: AssetMultiSelectManager;
    onEscape?: () => void;
    scrollToAsset: (asset: TimelineAsset) => boolean;
  };

  let { timelineManager = $bindable(), assetInteraction, onEscape, scrollToAsset }: Props = $props();

  const onDelete = async () => {
    const selectedAssets = assetInteraction.assets;
    const ids = selectedAssets.map((asset) => asset.id);

    if ($showDeleteModal) {
      const confirmed = await modalManager.show(AssetDeleteConfirmModal, { size: selectedAssets.length });
      if (!confirmed) {
        return;
      }
    }

    try {
      for (const id of ids) {
        await deleteFile(id);
      }
      timelineManager.removeAssets(ids);
      toastManager.primary($t('permanently_deleted_assets_count', { values: { count: ids.length } }));
    } catch (error) {
      handleError(error, $t('errors.unable_to_delete_assets'));
    }
    assetInteraction.clear();
  };

  const onSelectStart = (e: Event) => {
    if (assetInteraction.selectionActive && keyboardManager.shift) {
      e.preventDefault();
    }
  };

  const isEmpty = $derived(timelineManager.isInitialized && timelineManager.months.length === 0);
  let isShortcutModalOpen = false;

  const handleOpenShortcutModal = async () => {
    if (isShortcutModalOpen) {
      return;
    }

    isShortcutModalOpen = true;
    await modalManager.show(ShortcutsModal, {});
    isShortcutModalOpen = false;
  };

  $effect(() => {
    if (isEmpty) {
      assetInteraction.clear();
    }
  });

  const setFocusTo = setFocusToInit.bind(undefined, scrollToAsset, timelineManager);

  const shortcutList = $derived.by((): ShortcutOptions[] => {
    if (assetViewerManager.isViewing || isModalOpen()) {
      return [];
    }

    const shortcuts: ShortcutOptions[] = [
      { shortcut: { key: '?', shift: true }, onShortcut: handleOpenShortcutModal },
      { shortcut: { key: 'A', ctrl: true }, onShortcut: () => selectAllAssets(timelineManager, assetInteraction) },
      { shortcut: { key: 'ArrowRight' }, onShortcut: () => setFocusTo('earlier', 'asset') },
      { shortcut: { key: 'ArrowLeft' }, onShortcut: () => setFocusTo('later', 'asset') },
      { shortcut: { key: 'D' }, onShortcut: () => setFocusTo('earlier', 'day') },
      { shortcut: { key: 'M' }, onShortcut: () => setFocusTo('earlier', 'month') },
      { shortcut: { key: 'M', shift: true }, onShortcut: () => setFocusTo('later', 'month') },
      { shortcut: { key: 'Y' }, onShortcut: () => setFocusTo('earlier', 'year') },
      { shortcut: { key: 'Y', shift: true }, onShortcut: () => setFocusTo('later', 'year') },
    ];
    if (onEscape) {
      shortcuts.push({ shortcut: { key: 'Escape' }, onShortcut: onEscape });
    }

    if (assetInteraction.selectionActive) {
      shortcuts.push(
        { shortcut: { key: 'Delete' }, onShortcut: () => handlePromiseError(onDelete()) },
        { shortcut: { key: 'D', ctrl: true }, onShortcut: () => assetInteraction.clear() },
      );
    } else {
      // conflicting shortcuts
      shortcuts.push({ shortcut: { key: 'D', shift: true }, onShortcut: () => setFocusTo('later', 'day') });
    }

    return shortcuts;
  });
</script>

<svelte:document onselectstart={onSelectStart} use:shortcuts={shortcutList} />
