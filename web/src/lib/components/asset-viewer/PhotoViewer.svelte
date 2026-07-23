<script lang="ts">
  import { shortcuts } from '$lib/actions/shortcut';
  import { zoomImageAction } from '$lib/actions/zoom-image';
  import AdaptiveImage from '$lib/components/AdaptiveImage.svelte';
  import AssetViewerEvents from '$lib/components/AssetViewerEvents.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { handlePromiseError } from '$lib/utils';
  import { canCopyImageToClipboard, copyImageToClipboard } from '$lib/utils/asset-utils';
  import { handleError } from '$lib/utils/handle-error';
  import { toastManager } from '@immich/ui';
  import { untrack } from 'svelte';
  import { useSwipe, type SwipeCustomEvent } from 'svelte-gestures';
  import { t } from 'svelte-i18n';
  import type { AssetCursor } from './AssetViewer.svelte';

  type Props = {
    cursor: AssetCursor;
    element?: HTMLDivElement;
    onReady?: () => void;
    onError?: () => void;
    onSwipe?: (event: SwipeCustomEvent) => void;
  };

  let { cursor, element = $bindable(), onReady, onError, onSwipe }: Props = $props();

  const asset = $derived(cursor.current);

  let visibleImageReady: boolean = $state(false);

  let previousAssetId: string | undefined;
  $effect.pre(() => {
    const id = asset.id;
    if (id === previousAssetId) {
      return;
    }
    previousAssetId = id;
    untrack(() => {
      assetViewerManager.resetZoomState();
      visibleImageReady = false;
    });
  });

  let containerWidth = $state(0);
  let containerHeight = $state(0);

  const container = $derived({
    width: containerWidth,
    height: containerHeight,
  });

  const onCopy = async () => {
    if (!canCopyImageToClipboard() || !assetViewerManager.imgRef) {
      return;
    }

    try {
      await copyImageToClipboard(assetViewerManager.imgRef);
      toastManager.info($t('copied_image_to_clipboard'));
    } catch (error) {
      handleError(error, $t('copy_error'));
    }
  };

  const onZoom = () => {
    const targetZoom = assetViewerManager.zoom > 1 ? 1 : 2;
    assetViewerManager.animatedZoom(targetZoom);
  };

  // TODO move to action + command palette
  const onCopyShortcut = (event: KeyboardEvent) => {
    // eslint-disable-next-line unicorn/no-unnecessary-global-this
    if (globalThis.getSelection()?.type === 'Range') {
      return;
    }
    event.preventDefault();

    handlePromiseError(onCopy());
  };

  let adaptiveImage = $state<HTMLDivElement | undefined>();
</script>

<AssetViewerEvents {onCopy} {onZoom} />

<svelte:document
  use:shortcuts={[
    { shortcut: { key: 'z' }, onShortcut: onZoom, preventDefault: true },
    { shortcut: { key: 'c', ctrl: true }, onShortcut: onCopyShortcut, preventDefault: false },
    { shortcut: { key: 'c', meta: true }, onShortcut: onCopyShortcut, preventDefault: false },
  ]}
/>

<div
  bind:this={element}
  class="relative size-full select-none"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  role="presentation"
  ondblclick={onZoom}
  use:zoomImageAction={{ zoomTarget: adaptiveImage }}
  {...useSwipe((event) => onSwipe?.(event))}
>
  <AdaptiveImage
    {asset}
    {container}
    objectFit="contain"
    onImageReady={() => {
      visibleImageReady = true;
      onReady?.();
    }}
    onError={() => {
      onError?.();
      onReady?.();
    }}
    bind:imgRef={assetViewerManager.imgRef}
    bind:ref={adaptiveImage}
  />
</div>
