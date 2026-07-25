import { type AssetResponseDto, type AssetTypeEnum } from '$lib/api/compat';
import { getFileDownloadUrl } from '$lib/api/files';
import { toastManager } from '@immich/ui';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';
import type { AssetMultiSelectManager } from '$lib/managers/asset-multi-select-manager.svelte';
import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
import { downloadUrl } from '$lib/utils';
import { navigate } from '$lib/utils/navigation';
import { handleError } from './handle-error';

export function getFilenameExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1);
}

export function getAssetFilename(asset: AssetResponseDto): string {
  return asset.originalFileName;
}

export function getAssetRatio(asset: AssetResponseDto) {
  return asset.width && asset.height ? asset.width / asset.height : null;
}

// list of supported image extensions from https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types excluding svg
const supportedImageMimeTypes = new Set([
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');

async function addSupportedMimeTypes(): Promise<void> {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent); // https://stackoverflow.com/a/23522755
  if (isSafari) {
    const match = navigator.userAgent.match(/Version\/(\d+)/);

    if (!match) {
      return;
    }

    const majorVersion = Number.parseInt(match[1]);
    const MIN_REQUIRED_VERSION = 17;

    if (majorVersion >= MIN_REQUIRED_VERSION) {
      supportedImageMimeTypes.add('image/jxl').add('image/heic').add('image/heif');
    }

    return;
  }

  if (globalThis.isSecureContext && typeof ImageDecoder !== 'undefined') {
    const dynamicMimeTypes = [{ type: 'image/jxl' }, { type: 'image/heic', aliases: ['image/heif'] }];

    for (const mime of dynamicMimeTypes) {
      const isMimeTypeSupported = await ImageDecoder.isTypeSupported(mime.type);
      if (isMimeTypeSupported) {
        for (const mimeType of [mime.type, ...(mime.aliases || [])]) {
          supportedImageMimeTypes.add(mimeType);
        }
      }
    }

    return;
  }
}
// eslint-disable-next-line unicorn/no-top-level-side-effects
void addSupportedMimeTypes();

/**
 * Returns true if the asset is an image supported by web browsers, false otherwise
 */
export function isWebCompatibleImage(asset: AssetResponseDto): boolean {
  if (!asset.originalMimeType) {
    return false;
  }

  return supportedImageMimeTypes.has(asset.originalMimeType);
}

export const getAssetType = (type: AssetTypeEnum) => {
  switch (type) {
    case 'IMAGE': {
      return 'Photo';
    }
    case 'VIDEO': {
      return 'Video';
    }
    default: {
      return 'Asset';
    }
  }
};

export const selectAllAssets = async (timelineManager: TimelineManager, assetInteraction: AssetMultiSelectManager) => {
  if (assetInteraction.selectAll) {
    // Selection is already ongoing
    return;
  }
  assetInteraction.selectAll = true;

  try {
    for (const timelineMonth of timelineManager.months) {
      if (!timelineMonth.isLoaded) {
        await timelineManager.loadTimelineMonth(timelineMonth.yearMonth);
      }

      if (!assetInteraction.selectAll) {
        assetInteraction.clear();
        break; // Cancelled
      }
      assetInteraction.selectAssets([...timelineMonth.assetsIterator()]);

      for (const dateGroup of timelineMonth.timelineDays) {
        assetInteraction.addGroupToMultiselectGroup(dateGroup.groupTitle);
      }
    }
  } catch (error) {
    const $t = get(t);
    handleError(error, $t('errors.error_selecting_all_assets'));
    assetInteraction.selectAll = false;
  }
};

export const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getNextAsset = (assets: AssetResponseDto[], currentAsset: AssetResponseDto | undefined) => {
  const index = currentAsset ? assets.findIndex((a) => a.id === currentAsset.id) : -1;
  return index >= 0 ? assets[index + 1] : undefined;
};

export const getPreviousAsset = (assets: AssetResponseDto[], currentAsset: AssetResponseDto | undefined) => {
  const index = currentAsset ? assets.findIndex((a) => a.id === currentAsset.id) : -1;
  return index >= 0 ? assets[index - 1] : undefined;
};

export const canCopyImageToClipboard = (): boolean => {
  return !!(navigator.clipboard && globalThis.ClipboardItem);
};

const imgToBlob = async (imageElement: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;

  if (context) {
    context.drawImage(imageElement, 0, 0);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          throw new Error('Canvas conversion to Blob failed');
        }
      });
    });
  }

  throw new Error('Canvas context is null');
};

export const copyImageToClipboard = async (source: HTMLImageElement) => {
  // do not await, so the Safari clipboard write happens in the context of the user gesture
  await navigator.clipboard.write([new ClipboardItem({ ['image/png']: imgToBlob(source) })]);
};

export const navigateToAsset = async (targetAsset: AssetResponseDto | undefined | null) => {
  if (!targetAsset) {
    return false;
  }

  await navigate({ targetRoute: 'current', assetId: targetAsset.id });
  return true;
};

/** Download one asset via the browser (media URL carries the access token). */
export const downloadAsset = (asset: AssetResponseDto) => {
  downloadUrl(getFileDownloadUrl(asset.id), getAssetFilename(asset));
};

/** Download several assets sequentially (no archive endpoint in this backend). */
export const downloadAssets = async (assets: AssetResponseDto[]) => {
  const $t = get(t);
  if (assets.length > 1) {
    toastManager.info($t('downloading_assets', { values: { count: assets.length } }));
  }
  for (const asset of assets) {
    downloadAsset(asset);
    // Give the browser a beat between downloads so none get dropped.
    await delay(300);
  }
};
