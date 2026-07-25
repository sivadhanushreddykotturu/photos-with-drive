import type { AssetOrder, AssetOrderBy, AssetStackResponseDto, AssetVisibility } from '$lib/api/compat';
import type { TimelineDate, TimelineDateTime, TimelineYearMonth } from '$lib/utils/timeline-util';

export type ViewportTopMonth = TimelineYearMonth | undefined | 'lead-in' | 'lead-out';

export type TimelineManagerOptions = {
  visibility?: AssetVisibility;
  order?: AssetOrder;
  orderBy?: AssetOrderBy;
  deferInit?: boolean;
  assetFilter?: Set<string>;
  // Legacy option shapes accepted by call sites; ignored by the media store.
  timelineAlbumId?: string;
  albumId?: string;
  personId?: string;
  userId?: string;
  tagId?: string;
  isFavorite?: boolean;
  isTrashed?: boolean;
  withStacked?: boolean;
  withPartners?: boolean;
  startTimelineMonth?: TimelineYearMonth;
};

export type AssetDescriptor = { id: string };

export type Direction = 'earlier' | 'later';

export type TimelineAsset = {
  id: string;
  ownerId: string;
  tags?: string[];
  ratio: number;
  thumbhash: string | null;
  localDateTime: TimelineDateTime;
  createdAt: TimelineDateTime;
  fileCreatedAt: TimelineDateTime;
  visibility: AssetVisibility;
  isFavorite: boolean;
  isTrashed: boolean;
  isVideo: boolean;
  isImage: boolean;
  stack: AssetStackResponseDto | null;
  duration: number | null;
  projectionType: string | null;
  livePhotoVideoId: string | null;
  city: string | null;
  country: string | null;
  people: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type MoveAsset = { asset: TimelineAsset; date: TimelineDate };

export interface Viewport {
  width: number;
  height: number;
}

export type ViewportXY = Viewport & {
  x: number;
  y: number;
};

export interface AddAsset {
  type: 'add';
  values: TimelineAsset[];
}

export interface UpdateAsset {
  type: 'update';
  values: TimelineAsset[];
}

export interface DeleteAsset {
  type: 'delete';
  values: string[];
}

export interface TrashAssets {
  type: 'trash';
  values: string[];
}

export type PendingChange = AddAsset | UpdateAsset | DeleteAsset | TrashAssets;

export type ScrubberMonth = {
  height: number;
  assetCount: number;
  year: number;
  month: number;
  title: string;
};

export type TimelineManagerLayoutOptions = {
  rowHeight?: number;
  headerHeight?: number;
  gap?: number;
};

export interface UpdateGeometryOptions {
  invalidateHeight: boolean;
  noDefer?: boolean;
}
