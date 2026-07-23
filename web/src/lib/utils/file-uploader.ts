import { apiBaseUrl } from '$lib/api/client';
import type { FileRecord } from '$lib/api/types';
import { toastManager } from '@immich/ui';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
import { uploadAssetsStore } from '$lib/stores/upload';
import { UploadState } from '$lib/types';
import { uploadRequest } from '$lib/utils';
import { ExecutorQueue } from '$lib/utils/executor-queue';
import { handleError } from './handle-error';

// Common browser-viewable photo/video extensions (server formerly supplied this list).
const supportedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
  '.bmp',
  '.tiff',
  '.svg',
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.m4v',
  '.3gp',
  '.mpg',
  '.mpeg',
];

export const uploadExecutionQueue = new ExecutorQueue({ concurrency: 2 });

type FilePickerParam = { multiple?: boolean; extensions?: string[] };

export const openFilePicker = async (options: FilePickerParam = {}) => {
  const { multiple = true, extensions } = options;

  return new Promise<File[]>((resolve, reject) => {
    try {
      const fileSelector = document.createElement('input');

      fileSelector.type = 'file';
      fileSelector.multiple = multiple;

      if (extensions) {
        fileSelector.accept = extensions.join(',');
      }

      fileSelector.addEventListener(
        'change',
        (e: Event) => {
          fileSelector.remove();

          const target = e.target as HTMLInputElement;
          if (!target.files) {
            return;
          }

          const files = Array.from(target.files);
          resolve(files);
        },
        { passive: true },
      );

      fileSelector.addEventListener('cancel', () => fileSelector.remove(), { passive: true });

      // Safari requires the file selector to be mounted
      fileSelector.hidden = true;
      document.body.append(fileSelector);
      fileSelector.click();
    } catch (error) {
      console.log('Error selecting file', error);
      reject(error);
    }
  });
};

export const openFileUploadDialog = async (options: { multiple?: boolean } = {}) => {
  if (!(await assertHasConnectedAccount())) {
    return [];
  }

  const { multiple = true } = options;
  const files = await openFilePicker({
    multiple,
    extensions: supportedExtensions,
  });

  return fileUploadHandler({ files });
};

/** Single choke point: refuse upload attempts when no Drive account is connected. */
export const assertHasConnectedAccount = async (): Promise<boolean> => {
  const accounts = await connectedAccountsStore.load();
  if (accounts.length > 0) {
    return true;
  }
  toastManager.warning(get(t)('connect_account_to_upload'), { timeout: 8000 });
  return false;
};

export const fileUploadHandler = async ({ files }: { files: File[] }): Promise<string[]> => {
  const promises = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (supportedExtensions.some((extension) => name.endsWith(extension))) {
      const deviceAssetId = getDeviceAssetId(file);
      uploadAssetsStore.addItem({ id: deviceAssetId, file });
      promises.push(uploadExecutionQueue.addTask(() => fileUploader({ deviceAssetId, assetFile: file })));
    } else {
      toastManager.warning(get(t)('unsupported_file_type', { values: { file: file.name, type: file.type } }), {
        timeout: 10_000,
      });
    }
  }

  const results = await Promise.all(promises);
  return results.filter((result): result is string => !!result);
};

function getDeviceAssetId(asset: File) {
  return 'web-' + asset.name + '-' + asset.lastModified;
}

type FileUploaderParams = {
  assetFile: File;
  deviceAssetId: string;
};

async function fileUploader({ assetFile, deviceAssetId }: FileUploaderParams): Promise<string | undefined> {
  const $t = get(t);
  const wasInitiallyLoggedIn = !!authManager.authenticated;

  uploadAssetsStore.markStarted(deviceAssetId);
  uploadAssetsStore.updateItem(deviceAssetId, { message: $t('asset_uploading') });

  try {
    const formData = new FormData();
    formData.append('file', new File([assetFile], assetFile.name));

    const response = await uploadRequest<{ file: FileRecord }>({
      url: apiBaseUrl + '/files/upload',
      data: formData,
      onUploadProgress: (event) => uploadAssetsStore.updateProgress(deviceAssetId, event.loaded, event.total),
    });

    if (![200, 201].includes(response.status)) {
      throw new Error($t('errors.unable_to_upload_file'));
    }

    const record = response.data.file;
    uploadAssetsStore.track('success');
    uploadAssetsStore.updateItem(deviceAssetId, { state: UploadState.DONE, assetId: record.id });

    // Insert into the timeline immediately (no websocket in this build).
    eventManager.emit('AssetsUpload', [record]);

    setTimeout(() => {
      uploadAssetsStore.removeItem(deviceAssetId);
    }, 1000);

    return record.id;
  } catch (error) {
    // If the user store no longer holds a user, it means they have logged out
    // In this case don't bother reporting any errors.
    if (wasInitiallyLoggedIn && !authManager.authenticated) {
      return;
    }

    const errorMessage = handleError(error, $t('errors.unable_to_upload_file'));
    uploadAssetsStore.track('error');
    uploadAssetsStore.updateItem(deviceAssetId, { state: UploadState.ERROR, error: errorMessage });
    return;
  }
}
