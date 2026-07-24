<script lang="ts">
  import { browser } from '$app/environment';
  import { focusTrap } from '$lib/actions/focus-trap';
  import type { Action, OnAction, PreAction } from '$lib/components/asset-viewer/actions/action';
  import NextAssetAction from '$lib/components/asset-viewer/actions/NextAssetAction.svelte';
  import PreviousAssetAction from '$lib/components/asset-viewer/actions/PreviousAssetAction.svelte';
  import AssetViewerNavBar from '$lib/components/asset-viewer/AssetViewerNavBar.svelte';
  import { preloadManager } from '$lib/components/asset-viewer/PreloadManager.svelte';
  import OnEvents from '$lib/components/OnEvents.svelte';
  import { AssetAction } from '$lib/constants';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { navigateToAsset } from '$lib/utils/asset-utils';
  import { InvocationTracker } from '$lib/utils/invocationTracker';
  import { AssetTypeEnum, type AssetResponseDto } from '$lib/api/compat';
  import { onDestroy, onMount } from 'svelte';
  import type { SwipeCustomEvent } from 'svelte-gestures';
  import { t } from 'svelte-i18n';
  import PhotoViewer from './PhotoViewer.svelte';
  import VideoViewer from './VideoWrapperViewer.svelte';

  export type AssetCursor = {
    current: AssetResponseDto;
    nextAsset?: AssetResponseDto;
    previousAsset?: AssetResponseDto;
  };

  interface Props {
    cursor: AssetCursor;
    showNavigation?: boolean;
    onAssetChange?: (asset: AssetResponseDto) => void;
    preAction?: PreAction;
    onAction?: OnAction;
    onClose?: (assetId: string) => void;
  }

  let {
    cursor = $bindable(),
    showNavigation = true,
    onAssetChange,
    preAction,
    onAction,
    onClose,
  }: Props = $props();

  const asset = $derived(cursor.current);
  const nextAsset = $derived(cursor.nextAsset);
  const previousAsset = $derived(cursor.previousAsset);

  const onAssetUpdate = (updatedAsset: AssetResponseDto) => {
    if (asset.id === updatedAsset.id) {
      cursor = { ...cursor, current: updatedAsset };
    }
  };

  onMount(() => {
    syncAssetViewerOpenClass(true);
  });

  onDestroy(() => {
    assetViewerManager.resetPanelState();
    syncAssetViewerOpenClass(false);
    preloadManager.destroy();
  });

  const closeViewer = () => {
    onClose?.(asset.id);
  };

  const tracker = new InvocationTracker();
  const navigateAsset = (order: 'previous' | 'next') => {
    preloadManager.cancelBeforeNavigation(order);

    if (tracker.isActive()) {
      return;
    }

    void tracker.invoke(async () => {
      if (order === 'previous') {
        await navigateToAsset(cursor.previousAsset);
      } else {
        await navigateToAsset(cursor.nextAsset);
      }
    }, $t('error_while_navigating'));
  };

  const handlePreAction = (action: Action) => {
    preAction?.(action);
  };

  const handleAction = async (action: Action) => {
    switch (action.type) {
      case AssetAction.DELETE: {
        eventManager.emit('AssetsDelete', [asset.id]);
        break;
      }
      // no default
    }

    onAction?.(action);
  };

  const syncAssetViewerOpenClass = (isOpen: boolean) => {
    if (browser) {
      document.body.classList.toggle('asset-viewer-open', isOpen);
    }
  };

  let lastCursor = $state<AssetCursor>();

  $effect(() => {
    if (cursor.current.id === lastCursor?.current.id) {
      return;
    }
    if (lastCursor) {
      preloadManager.updateAfterNavigation(lastCursor, cursor, undefined);
    }
    if (!lastCursor) {
      preloadManager.initializePreloads(cursor, undefined);
    }
    lastCursor = cursor;
  });

  const viewerKind = $derived(asset.type === AssetTypeEnum.Video ? 'VideoViewer' : 'PhotoViewer');

  const onSwipe = (event: SwipeCustomEvent) => {
    if (assetViewerManager.zoom > 1) {
      return;
    }

    if (event.detail.direction === 'left') {
      navigateAsset('next');
    } else if (event.detail.direction === 'right') {
      navigateAsset('previous');
    }
  };
</script>

<OnEvents {onAssetUpdate} />

{#if asset}
<section
  id="immich-asset-viewer"
  class="fixed inset-s-0 top-0 grid size-full grid-cols-4 grid-rows-[64px_1fr] overflow-hidden bg-black"
  use:focusTrap
>
  <!-- Top navigation bar -->
  <div class="col-span-4 col-start-1 row-span-1 row-start-1 transition-transform">
    <AssetViewerNavBar
      {asset}
      preAction={handlePreAction}
      onAction={handleAction}
      onClose={onClose ? () => onClose(asset.id) : undefined}
      {onAssetChange}
    />
  </div>

  {#if showNavigation && previousAsset}
    <div class="col-span-1 col-start-1 row-span-full row-start-1 my-auto justify-self-start">
      <PreviousAssetAction onPreviousAsset={() => navigateAsset('previous')} />
    </div>
  {/if}

  <!-- Asset Viewer -->
  <div data-viewer-content class="relative z-[-1] col-span-4 col-start-1 row-span-full row-start-1">
    {#if viewerKind === 'PhotoViewer'}
      <PhotoViewer cursor={{ ...cursor, current: asset }} {onSwipe} />
    {:else}
      <VideoViewer
        {asset}
        onPreviousAsset={() => navigateAsset('previous')}
        onNextAsset={() => navigateAsset('next')}
        onClose={closeViewer}
      />
    {/if}
  </div>

  {#if showNavigation && nextAsset}
    <div class="col-span-1 col-start-4 row-span-full row-start-1 my-auto justify-self-end">
      <NextAssetAction onNextAsset={() => navigateAsset('next')} />
    </div>
  {/if}
</section>
{/if}

<style>
  #immich-asset-viewer {
    contain: layout;
  }
</style>
