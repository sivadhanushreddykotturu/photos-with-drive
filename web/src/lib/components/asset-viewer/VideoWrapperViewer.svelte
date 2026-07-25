<script lang="ts">
  import { getFileDownloadUrl } from '$lib/api/files';
  import { getAssetMediaUrl, getAssetPlaybackUrl } from '$lib/utils';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { AssetMediaSize, type AssetResponseDto } from '$lib/api/compat';
  import { Button, Icon, LoadingSpinner } from '@immich/ui';
  import { mdiAlertCircleOutline, mdiDownloadOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import 'media-chrome';

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

  const handleError = () => {
    // MEDIA_ERR_ABORTED fires on src swaps/navigation aborts — not a real failure.
    if (videoPlayer?.error?.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }
    loading = false;
    failed = true;
  };

  const handleCanPlay = () => {
    loading = false;
    failed = false; // recover if an earlier spurious error was shown
  };
</script>

<div class="relative size-full select-none" role="presentation">
  <media-controller class="block size-full">
    <video
      bind:this={videoPlayer}
      slot="media"
      class="h-full w-full object-contain"
      src={getAssetPlaybackUrl({ id: asset.id })}
      poster={getAssetMediaUrl({ id: asset.id, size: AssetMediaSize.Thumbnail })}
      autoplay
      playsinline
      oncanplay={handleCanPlay}
      onplaying={handleCanPlay}
      onerror={handleError}
    >
      <track kind="captions" />
    </video>
    <media-control-bar class="w-full bg-linear-to-t from-black/80 px-4 py-1 text-white">
      <media-play-button class="p-2"></media-play-button>
      <media-time-range class="flex-1 p-2"></media-time-range>
      <media-time-display class="p-2 text-sm" showDuration></media-time-display>
      <media-mute-button class="p-2"></media-mute-button>
      <media-volume-range class="w-20 p-2"></media-volume-range>
      <media-fullscreen-button class="p-2"></media-fullscreen-button>
    </media-control-bar>
  </media-controller>

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
