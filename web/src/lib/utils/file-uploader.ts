import { apiBaseUrl } from '$lib/api/client';
import { getFreshQuotas } from '$lib/api/accounts';
import type { ConnectedAccount } from '$lib/api/types';
import type { FileRecord } from '$lib/api/types';
import { toastManager } from '@immich/ui';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { connectedAccountsStore } from '$lib/stores/connected-accounts.svelte';
import { uploadAssetsStore } from '$lib/stores/upload';
import { UploadState } from '$lib/types';
import { cancelUploadRequest, cancelUploadRequests, uploadRequest } from '$lib/utils';
import { getByteUnitString } from '$lib/utils/byte-units';
import { locale } from '$lib/stores/preferences.store';
import { ExecutorQueue } from '$lib/utils/executor-queue';
import { handleError } from './handle-error';

// Common browser-viewable photo/video extensions. SVG is excluded on purpose
// (can carry scripts). The backend enforces the same rules regardless.
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

const MAX_FILE_BYTES = 300 * 1024 * 1024; // must match backend MAX_UPLOAD_BYTES
const BIG_FILE_BYTES = 150 * 1024 * 1024; // serialize files above this to stay within memory

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

const freeBytes = (account: ConnectedAccount) =>
  account.storageQuota.total === null ? Number.MAX_SAFE_INTEGER : account.storageQuota.total - account.storageQuota.used;

export const fileUploadHandler = async ({ files }: { files: File[] }): Promise<string[]> => {
  // Pre-check against FRESH Drive quotas — fail doomed files before they start.
  let accounts: ConnectedAccount[] = [];
  try {
    accounts = await getFreshQuotas();
    connectedAccountsStore.accounts = accounts;
  } catch {
    accounts = connectedAccountsStore.accounts ?? [];
  }
  const maxFree = accounts.length > 0 ? Math.max(...accounts.map(freeBytes)) : 0;

  const promises = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (!supportedExtensions.some((extension) => name.endsWith(extension))) {
      toastManager.warning(get(t)('unsupported_file_type', { values: { file: file.name, type: file.type } }), {
        timeout: 10_000,
      });
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      toastManager.danger(
        get(t)('upload_file_too_large', {
          values: { file: file.name, size: getByteUnitString(file.size, get(locale)) },
        }),
        { timeout: 10_000 },
      );
      continue;
    }

    if (accounts.length > 0 && file.size > maxFree) {
      toastManager.danger(
        get(t)('upload_no_space', {
          values: { file: file.name, size: getByteUnitString(file.size, get(locale)) },
        }),
        { timeout: 10_000 },
      );
      continue;
    }

    const deviceAssetId = getDeviceAssetId(file);
    uploadAssetsStore.addItem({ id: deviceAssetId, file });
    promises.push(uploadExecutionQueue.addTask(() => fileUploader({ deviceAssetId, assetFile: file })));
  }

  const results = await Promise.all(promises);
  return results.filter((result): result is string => !!result);
};

function getDeviceAssetId(asset: File) {
  return 'web-' + asset.name + '-' + asset.lastModified;
}

// Ids the user cancelled — pending queue tasks no-op when they start.
const cancelledUploads = new Set<string>();

/** Cancel one upload (aborts the XHR if in-flight, no-ops its queued task otherwise). */
export const cancelUpload = (deviceAssetId: string) => {
  cancelledUploads.add(deviceAssetId);
  cancelUploadRequest(deviceAssetId);
  uploadAssetsStore.removeItem(deviceAssetId);
};

/** Cancel everything: pending + in-flight. */
export const cancelAllUploads = () => {
  for (const item of get(uploadAssetsStore)) {
    cancelledUploads.add(item.id);
  }
  cancelUploadRequests();
  uploadAssetsStore.reset();
};

type FileUploaderParams = {
  assetFile: File;
  deviceAssetId: string;
};

async function fileUploader({ assetFile, deviceAssetId }: FileUploaderParams): Promise<string | undefined> {
  // Cancelled while waiting in the queue — no-op.
  if (cancelledUploads.has(deviceAssetId)) {
    cancelledUploads.delete(deviceAssetId);
    return;
  }

  const $t = get(t);
  const wasInitiallyLoggedIn = !!authManager.authenticated;

  // Big files upload alone: googleapis buffers the body server-side, so two
  // concurrent large uploads could exceed the host's memory ceiling.
  const isBigFile = assetFile.size > BIG_FILE_BYTES;
  const previousConcurrency = uploadExecutionQueue.concurrency;
  if (isBigFile) {
    uploadExecutionQueue.concurrency = 1;
  }

  uploadAssetsStore.markStarted(deviceAssetId);
  uploadAssetsStore.updateItem(deviceAssetId, { message: $t('asset_uploading') });

  try {
    const formData = new FormData();
    formData.append('file', new File([assetFile], assetFile.name));

    const response = await uploadRequest<{ file: FileRecord }>({
      url: apiBaseUrl + '/files/upload',
      data: formData,
      key: deviceAssetId,
      onUploadProgress: (event) => uploadAssetsStore.updateProgress(deviceAssetId, event.loaded, event.total),
    });

    if (![200, 201].includes(response.status)) {
      throw new Error($t('errors.unable_to_upload_file'));
    }

    const record = response.data.file;
    cancelledUploads.delete(deviceAssetId);
    uploadAssetsStore.track('success');
    uploadAssetsStore.updateItem(deviceAssetId, { state: UploadState.DONE, assetId: record.id });

    // Insert into the timeline immediately (no websocket in this build).
    eventManager.emit('AssetsUpload', [record]);

    setTimeout(() => {
      uploadAssetsStore.removeItem(deviceAssetId);
    }, 1000);

    if (isBigFile) {
      uploadExecutionQueue.concurrency = previousConcurrency;
    }

    return record.id;
  } catch (error) {
    cancelledUploads.delete(deviceAssetId);
    if (isBigFile) {
      uploadExecutionQueue.concurrency = previousConcurrency;
    }
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
