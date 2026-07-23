import { mediaStore } from '$lib/managers/timeline-manager/internal/media-store.svelte';
import { TimelineManager } from '../timeline-manager.svelte';
import type { TimelineMonth } from '../timeline-month.svelte';

export async function loadFromTimeBuckets(
  _timelineManager: TimelineManager,
  timelineMonth: TimelineMonth,
  _options: unknown,
  signal: AbortSignal,
): Promise<void> {
  if (timelineMonth.getFirstAsset()) {
    return;
  }

  const bucketResponse = await mediaStore.getMonthAssets(timelineMonth.yearMonth);

  if (!bucketResponse || signal.aborted) {
    return;
  }

  const unprocessedAssets = timelineMonth.addAssets(bucketResponse, true);
  if (unprocessedAssets.length > 0) {
    console.error(
      `Warning: media store returned assets not in requested month: ${timelineMonth.yearMonth.month}, ${JSON.stringify(
        unprocessedAssets.map((unprocessed) => ({
          id: unprocessed.id,
          localDateTime: unprocessed.localDateTime,
        })),
      )}`,
    );
  }
}
