import { AssetVisibility, type TimeBucketAssetResponseDto, type TimeBucketResponseDto } from '$lib/api/compat';
import { listMediaFilesGrouped } from '$lib/api/files';
import type { FileRecord } from '$lib/api/types';
import { authManager } from '$lib/managers/auth-manager.svelte';
import type { TimelineYearMonth } from '$lib/utils/timeline-util';

/**
 * Bridges the custom backend (day-grouped file list) onto the timeline manager's
 * month-bucket model. The full media list is fetched once and cached; month
 * buckets and columnar bucket payloads are derived client-side.
 */
class MediaStore {
  #files = $state<FileRecord[] | undefined>();
  #loading: Promise<FileRecord[]> | undefined;

  async load(force = false): Promise<FileRecord[]> {
    if (this.#files && !force) {
      return this.#files;
    }
    this.#loading ??= (async () => {
      try {
        const groups = await listMediaFilesGrouped();
        // Groups arrive newest-first; flatten keeps that order.
        this.#files = groups.flatMap((group) => group.files);
        return this.#files;
      } finally {
        this.#loading = undefined;
      }
    })();
    return this.#loading;
  }

  async invalidate() {
    this.#files = undefined;
    await this.load(true);
  }

  addFile(file: FileRecord) {
    if (!this.#files) {
      return;
    }
    if (this.#files.some((existing) => existing.id === file.id)) {
      return;
    }
    // Keep the list sorted newest-first by createdTime.
    const createdTime = new Date(file.createdTime).getTime();
    const index = this.#files.findIndex((existing) => new Date(existing.createdTime).getTime() < createdTime);
    if (index === -1) {
      this.#files.push(file);
    } else {
      this.#files.splice(index, 0, file);
    }
  }

  removeFiles(ids: string[]) {
    if (!this.#files) {
      return;
    }
    const idSet = new Set(ids);
    this.#files = this.#files.filter((file) => !idSet.has(file.id));
  }

  updateFile(file: FileRecord) {
    if (!this.#files) {
      return;
    }
    const index = this.#files.findIndex((existing) => existing.id === file.id);
    if (index !== -1) {
      this.#files[index] = file;
    }
  }

  /** Month buckets for TimelineManager initialization. */
  async getMonthBuckets(): Promise<TimeBucketResponseDto[]> {
    const files = await this.load();
    const counts = new Map<string, number>();
    for (const file of files) {
      const date = new Date(file.createdTime);
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        timeBucket: new Date(Date.UTC(year, month, 1)).toISOString(),
        count,
      };
    });
  }

  /** Columnar bucket payload for one month (mirrors Immich's getTimeBucket response). */
  async getMonthAssets(yearMonth: TimelineYearMonth): Promise<TimeBucketAssetResponseDto> {
    const files = await this.load();
    const monthFiles = files.filter((file) => {
      const date = new Date(file.createdTime);
      return date.getUTCFullYear() === yearMonth.year && date.getUTCMonth() + 1 === yearMonth.month;
    });

    const ownerId = authManager.authenticated ? authManager.user.id : '';

    const bucket: TimeBucketAssetResponseDto = {
      id: [],
      ratio: [],
      isImage: [],
      thumbhash: [],
      duration: [],
      fileCreatedAt: [],
      localOffsetHours: [],
      createdAt: [],
      visibility: [],
      isFavorite: [],
      isTrashed: [],
      ownerId: [],
      projectionType: [],
      livePhotoVideoId: [],
      stack: [],
      city: [],
      country: [],
      latitude: [],
      longitude: [],
    };

    for (const file of monthFiles) {
      const isVideo = file.mimeType.startsWith('video/');
      const width = file.imageMediaMetadata?.width;
      const height = file.imageMediaMetadata?.height;
      bucket.id.push(file.id);
      bucket.ratio.push(width && height ? width / height : isVideo ? 16 / 9 : 3 / 2);
      bucket.isImage.push(!isVideo);
      bucket.thumbhash.push(null);
      bucket.duration.push(file.videoMediaMetadata?.duration ?? null); // milliseconds
      bucket.fileCreatedAt.push(file.createdTime);
      bucket.localOffsetHours.push(0);
      bucket.createdAt.push(file.createdTime);
      bucket.visibility.push(AssetVisibility.Timeline);
      bucket.isFavorite.push(file.isFavorite ?? false);
      bucket.isTrashed.push(false);
      bucket.ownerId.push(ownerId);
      bucket.projectionType.push(null);
      bucket.livePhotoVideoId.push(null);
      bucket.stack.push(null);
      bucket.city!.push(null);
      bucket.country!.push(null);
      bucket.latitude!.push(null);
      bucket.longitude!.push(null);
    }

    return bucket;
  }

  /** TimelineAsset-shaped object for incremental inserts (uploads). */
  fileToTimelineAsset(file: FileRecord) {
    const isVideo = file.mimeType.startsWith('video/');
    const width = file.imageMediaMetadata?.width;
    const height = file.imageMediaMetadata?.height;
    const date = new Date(file.createdTime);
    const plain = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds(),
    };
    return {
      id: file.id,
      ownerId: authManager.authenticated ? authManager.user.id : '',
      ratio: width && height ? width / height : isVideo ? 16 / 9 : 3 / 2,
      thumbhash: null,
      localDateTime: plain,
      createdAt: plain,
      fileCreatedAt: plain,
      visibility: AssetVisibility.Timeline,
      isFavorite: file.isFavorite ?? false,
      isTrashed: false,
      isVideo,
      isImage: !isVideo,
      stack: null,
      duration: file.videoMediaMetadata?.duration ?? null,
      projectionType: null,
      livePhotoVideoId: null,
      city: null,
      country: null,
      people: null,
    };
  }
}

export const mediaStore = new MediaStore();
