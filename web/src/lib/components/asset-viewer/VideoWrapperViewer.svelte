<script lang="ts">
  import { getFileDownloadUrl } from '$lib/api/files';
  import { getAssetMediaUrl, getAssetPlaybackUrl } from '$lib/utils';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { AssetMediaSize, type AssetResponseDto } from '$lib/api/compat';
  import { Button, Icon, LoadingSpinner } from '@immich/ui';
  import { mdiAlertCircleOutline, mdiDownloadOutline } from '@mdi/js';
  import { useSwipe, type SwipeCustomEvent } from 'svelte-gestures';
  import { t } from 'svelte-i18n';

  interface Props {
    asset: AssetResponseDto;
    onClose?: () => void;
    onPreviousAsset?: () => void;
    onNextAsset?: () => void;
  }

  let { asset, onPreviousAsset, onNextAsset }: Props = $props();

  let loading = $state(true);
  let failed = $state(false);
  let videoPlayer: HTMLVideoElement | undefined = $state();

  // Reset state when navigating between assets.
  let previousAssetId: string | undefined;
  $effect(() => {
    if (asset.id !== previousAssetId) {
      previousAssetId = asset.id;
      loading = true;
      failed = false;
    }
  });

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

  const handleError = () => {
    if (!videoPlayer?.src) {
      return;
    }
    loading = false;
    failed = true;
  };
</script>

<div class="relative size-full select-none" role="presentation" {...useSwipe((event) => onSwipe(event))}>
  <video
    bind:this={videoPlayer}
    class="h-full w-full object-contain"
    src={getAssetPlaybackUrl({ id: asset.id })}
    poster={getAssetMediaUrl({ id: asset.id, size: AssetMediaSize.Thumbnail })}
    controls
    autoplay
    playsinline
    oncanplay={() => (loading = false)}
    onerror={handleError}
  >
    <track kind="captions" />
  </video>

  {#if loading && !failed}
    <div class="absolute inset-0 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  {/if}

  {#if failed}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <Icon icon={mdiAlertCircleOutline} size="48" class="text-red-500" />
      <p class="max-w-md text-sm text-white">
        {$t('video_playback_unsupported')}
      </p>
      <Button href={getFileDownloadUrl(asset.id)} shape="round" leadingIcon={mdiDownloadOutline}>
        {$t('download')}
      </Button>
    </div>
  {/if}
</div>
