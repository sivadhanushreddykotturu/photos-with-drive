<script lang="ts">
  import { getAssetMediaUrl, getAssetPlaybackUrl } from '$lib/utils';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import type { AssetResponseDto } from '$lib/api/compat';
  import { useSwipe, type SwipeCustomEvent } from 'svelte-gestures';

  interface Props {
    asset: AssetResponseDto;
    onClose?: () => void;
    onPreviousAsset?: () => void;
    onNextAsset?: () => void;
  }

  let { asset, onClose, onPreviousAsset, onNextAsset }: Props = $props();

  const onSwipe = (event: SwipeCustomEvent) => {
    if (assetViewerManager.zoom > 1) {
      return;
    }
    if (event.detail.direction === 'left') {
      onNextAsset?.();
    } else if (event.detail.direction === 'right') {
      onPreviousAsset?.();
    }
  };
</script>

<div class="relative size-full select-none" role="presentation" {...useSwipe((event) => onSwipe(event))}>
  <video
    class="h-full w-full object-contain"
    src={getAssetPlaybackUrl({ id: asset.id })}
    poster={getAssetMediaUrl({ id: asset.id })}
    controls
    autoplay
    playsinline
  >
    <track kind="captions" />
  </video>
</div>
