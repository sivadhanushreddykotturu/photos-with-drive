<script lang="ts">
  import type { Action } from '$lib/components/asset-viewer/actions/action';
  import AssetViewer, { type AssetCursor } from '$lib/components/asset-viewer/AssetViewer.svelte';
  import { AssetAction } from '$lib/constants';
  import { goto } from '$app/navigation';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { assetCacheManager } from '$lib/managers/AssetCacheManager.svelte';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { handlePromiseError } from '$lib/utils';
  import { navigateToAsset } from '$lib/utils/asset-utils';
  import { handleErrorAsync } from '$lib/utils/handle-error';
  import { navigate } from '$lib/utils/navigation';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import { type AssetResponseDto } from '$lib/api/compat';
  import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
  import { onDestroy } from 'svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    timelineManager: TimelineManager;
    invisible: boolean;
  }

  let {
    timelineManager,
    // eslint-disable-next-line no-useless-assignment
    invisible = $bindable(false),
  }: Props = $props();

  const getAsset = (id: string) => {
    return handleErrorAsync(() => assetCacheManager.getAsset({ id }), $t('error_retrieving_asset_information'));
  };

  const getNextAsset = async (currentAsset: AssetResponseDto) => {
    const earlierTimelineAsset = await timelineManager.getEarlierAsset(currentAsset);
    if (!earlierTimelineAsset) {
      return;
    }
    return getAsset(earlierTimelineAsset.id);
  };

  const getPreviousAsset = async (currentAsset: AssetResponseDto) => {
    const laterTimelineAsset = await timelineManager.getLaterAsset(currentAsset);
    if (!laterTimelineAsset) {
      return;
    }
    return getAsset(laterTimelineAsset.id);
  };

  let assetCursor = $state<AssetCursor>({
    current: assetViewerManager.asset!,
    previousAsset: undefined,
    nextAsset: undefined,
  });

  const loadCloseAssets = async (currentAsset: AssetResponseDto) => {
    const [nextAsset, previousAsset] = await Promise.all([getNextAsset(currentAsset), getPreviousAsset(currentAsset)]);

    assetCursor = {
      current: currentAsset,
      nextAsset,
      previousAsset,
    };
  };

  //TODO: replace this with async derived in svelte 6
  $effect(() => {
    const asset = assetViewerManager.asset;
    if (asset) {
      handlePromiseError(loadCloseAssets(asset));
    }
  });

  const handleClose = async (assetId: string) => {
    invisible = true;
    // Opened from a non-timeline page (e.g. an album)? Return there instead.
    const returnPath = assetViewerManager.returnPath;
    if (returnPath) {
      assetViewerManager.returnPath = null;
      await goto(returnPath);
      return;
    }
    assetViewerManager.gridScrollTarget = { at: assetId };
    await navigate({
      targetRoute: 'current',
      assetId: null,
      assetGridRouteSearchParams: assetViewerManager.gridScrollTarget,
    });
  };

  const handlePreAction = async (action: Action) => {
    switch (action.type) {
      case AssetAction.DELETE: {
        // must update manager before performing any navigation
        timelineManager.removeAssets([action.asset.id]);
        mediaStore.removeFiles([action.asset.id]);

        // find the next asset to show or close the viewer
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (await navigateToAsset(assetCursor?.nextAsset)) ||
          (await navigateToAsset(assetCursor?.previousAsset)) ||
          (await handleClose(action.asset.id));

        break;
      }
      // no default
    }
  };

  const handleAction = (action: Action) => {
    switch (action.type) {
      case AssetAction.DELETE: {
        break;
      }
      // no default
    }
  };

  onDestroy(() => {
    assetCacheManager.invalidate();
  });
</script>

{#if assetCursor.current}
  <AssetViewer
    cursor={assetCursor}
    onAssetChange={(asset) => {
      timelineManager?.upsertAssets([toTimelineAsset(asset)]);
    }}
    preAction={handlePreAction}
    onAction={(action) => {
      handleAction(action);
      assetCacheManager.invalidate();
    }}
    onClose={handleClose}
  />
{/if}
