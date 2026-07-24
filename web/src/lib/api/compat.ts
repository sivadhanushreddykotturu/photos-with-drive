/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Compatibility shim replacing `@immich/sdk` in this stripped-down build.
 *
 * - Enums and structural DTO types used by kept components live here.
 * - Functions delegate to the custom backend API layer (`$lib/api/*`).
 * - Immich-only endpoints are gone; any leftover caller hits `unsupported()`.
 */
import { apiBaseUrl, ApiError } from '$lib/api/client';
import * as filesApi from '$lib/api/files';
import * as authApi from '$lib/api/auth';
import type { ApiUser, FileRecord } from '$lib/api/types';

// ---------------------------------------------------------------------------
// Enums (string values match upstream Immich OpenAPI where they matter)
// ---------------------------------------------------------------------------

export enum AssetMediaSize {
  Thumbnail = 'thumbnail',
  Preview = 'preview',
  Fullsize = 'fullsize',
  Original = 'original',
}

export enum AssetVisibility {
  Timeline = 'timeline',
  Hidden = 'hidden',
  Archive = 'archive',
  Locked = 'locked',
}

export enum AssetTypeEnum {
  Image = 'IMAGE',
  Video = 'VIDEO',
  Audio = 'AUDIO',
  Other = 'OTHER',
}

export enum AssetOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export enum AssetOrderBy {
  TakenAt = 'takenAt',
  CreatedAt = 'createdAt',
}

export enum AssetMediaStatus {
  Created = 'created',
  Replaced = 'replaced',
  Duplicate = 'duplicate',
}

export enum AssetUploadAction {
  Accept = 'accept',
  Reject = 'reject',
}

export enum UserAvatarColor {
  Primary = 'primary',
  Pink = 'pink',
  Red = 'red',
  Yellow = 'yellow',
  Blue = 'blue',
  Green = 'green',
  Purple = 'purple',
  Orange = 'orange',
  Gray = 'gray',
  Amber = 'amber',
}

export enum NotificationType {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

export enum NotificationLevel {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

export enum ReactionType {
  Like = 'like',
  Comment = 'comment',
}

export enum ReleaseType {
  Major = 'major',
  Minor = 'minor',
  Patch = 'patch',
}

export enum MemoryType {
  OnThisDay = 'on_this_day',
}

export enum SharedLinkType {
  Album = 'ALBUM',
  Individual = 'INDIVIDUAL',
}

export enum AlbumUserRole {
  Editor = 'editor',
  Viewer = 'viewer',
}

export enum PartnerDirection {
  SharedBy = 'shared-by',
  SharedWith = 'shared-with',
}

export enum Permission {
  AllRead = 'all.read',
  AllCreate = 'all.create',
  AllUpdate = 'all.update',
  AllDelete = 'all.delete',
}

export enum QueueName {
  ThumbnailGeneration = 'thumbnailGeneration',
  MetadataExtraction = 'metadataExtraction',
}

export enum AssetJobName {
  RegenerateThumbnail = 'regenerate-thumbnail',
  RefreshMetadata = 'refresh-metadata',
  TranscodeVideo = 'transcode-video',
}

export enum ManualJobName {
  BackupDatabase = 'backup-database',
}

export enum WorkflowTrigger {
  AssetUploaded = 'asset.uploaded',
}

export enum CalendarHeatmapType {
  Year = 'year',
  Month = 'month',
}

// ---------------------------------------------------------------------------
// Core DTO types (structural, slimmed to what the kept UI consumes)
// ---------------------------------------------------------------------------

export type ExifResponseDto = {
  description?: string;
  exifImageWidth?: number;
  exifImageHeight?: number;
  fileSizeInByte?: number;
  dateTimeOriginal?: string;
  modifyDate?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
  state?: string | null;
  make?: string;
  model?: string;
  lensModel?: string;
  fNumber?: number;
  focalLength?: number;
  iso?: number;
  exposureTime?: string;
  rating?: number;
  projectionType?: string;
  orientation?: string;
  timeZone?: string;
  [key: string]: any;
};

export type StackResponseDto = {
  id: string;
  primaryAssetId: string;
  assets: AssetResponseDto[];
};

export type PersonResponseDto = {
  id: string;
  name: string;
  thumbnailPath?: string;
  updatedAt?: string;
  [key: string]: any;
};

export type AssetResponseDto = {
  id: string;
  type: AssetTypeEnum;
  thumbhash: string | null;
  originalFileName: string;
  originalPath: string;
  originalMimeType?: string;
  resizedAt?: string | null;
  duration: number | null; // milliseconds
  width?: number;
  height?: number;
  isFavorite: boolean;
  isArchived?: boolean;
  isTrashed: boolean;
  isOffline?: boolean;
  isEdited?: boolean;
  hasMetadata?: boolean;
  visibility: AssetVisibility;
  ownerId: string;
  deviceAssetId?: string;
  fileCreatedAt: string;
  localDateTime: string;
  fileModifiedAt?: string;
  updatedAt?: string;
  livePhotoVideoId: string | null;
  stack: StackResponseDto | null;
  exifInfo?: ExifResponseDto;
  people?: PersonResponseDto[];
  unassignedFaces?: any[];
  libraryId?: string;
  checksum?: string;
  duplicateId?: string | null;
  isExternal?: boolean;
  [key: string]: any;
};

export type UserResponseDto = {
  id: string;
  name: string;
  email: string;
  profileImagePath?: string;
  profileChangedAt?: string;
  avatarColor?: UserAvatarColor;
  createdAt?: string;
  [key: string]: any;
};

export type UserAdminResponseDto = UserResponseDto & {
  isAdmin: boolean;
  shouldChangePassword?: boolean;
  isOnboarded?: boolean;
  license?: { activatedAt?: string };
};

export type UserPreferencesResponseDto = {
  people?: { enabled?: boolean };
  sharedLinks?: { enabled?: boolean };
  tags?: { enabled?: boolean };
  folders?: { enabled?: boolean };
  [key: string]: any;
};

export type LoginResponseDto = {
  user: UserAdminResponseDto;
  [key: string]: any;
};

export type SharedLinkResponseDto = {
  id: string;
  allowDownload?: boolean;
  showMetadata?: boolean;
  [key: string]: any;
};

export type AlbumResponseDto = {
  id: string;
  albumName: string;
  sharedUsers?: AlbumUserResponseDto[];
  [key: string]: any;
};

export type AlbumUserResponseDto = { user: UserResponseDto; role: AlbumUserRole; [key: string]: any };

export type TimeBucketResponseDto = {
  timeBucket: string; // ISO month start
  count: number;
};

// Columnar time-bucket payload: parallel, index-aligned arrays.
export type TimeBucketAssetResponseDto = {
  id: string[];
  ratio: number[];
  isImage: boolean[];
  thumbhash: (string | null)[];
  duration: (number | null)[];
  fileCreatedAt: string[];
  localOffsetHours: number[];
  createdAt: string[];
  visibility: AssetVisibility[];
  isFavorite: boolean[];
  isTrashed: boolean[];
  ownerId: string[];
  projectionType: (string | null)[];
  livePhotoVideoId: (string | null)[];
  stack: ([string, string] | null)[];
  city?: (string | null)[];
  country?: (string | null)[];
  latitude?: (number | null)[];
  longitude?: (number | null)[];
};

export type AssetStackResponseDto = { id: string; assetCount: number };

export type ServerConfigDto = {
  isInitialized: boolean;
  isOnboarded: boolean;
  maintenanceMode: boolean;
  [key: string]: any;
};

export type ServerFeaturesDto = {
  passwordLogin: boolean;
  oauth: boolean;
  oauthAutoLaunch: boolean;
  search: boolean;
  smartSearch: boolean;
  map: boolean;
  trash: boolean;
  email: boolean;
  configFile: boolean;
  duplicateDetection: boolean;
  realtimeTranscoding: boolean;
  ocr: boolean;
  [key: string]: any;
};

export type ServerAboutResponseDto = { version: string; licensed: boolean; [key: string]: any };
export type ServerVersionResponseDto = { major: number; minor: number; patch: number; prerelease: number | null };

// Legacy DTO aliases for files that still reference them (loose on purpose).
export type ServerVersionHistoryResponseDto = any;
export type TagResponseDto = any;
export type ApiKeyResponseDto = any;
export type SessionResponseDto = any;
export type NotificationDto = any;
export type ActivityResponseDto = any;
export type LibraryResponseDto = any;
export type WorkflowResponseDto = any;
export type WorkflowStepDto = any;
export type MetadataSearchDto = any;
export type SmartSearchDto = any;
export type SystemConfigDto = any;
export type IntegrityReport = any;
export type MapMarkerResponseDto = any;
export type PlacesResponseDto = any;
export type CalendarHeatmapResponseDto = any;
export type ReleaseEventV1 = any;
export type MemoryResponseDto = any;
export type PartnerResponseDto = any;
export type PluginMethodResponseDto = any;
export type PluginTemplateResponseDto = any;
export type QueueResponseDto = any;
export type AssetStatsResponseDto = any;
export type AlbumStatisticsResponseDto = any;
export type LicenseResponseDto = any;
export type ChangePasswordDto = any;
export type PinCodeResetDto = any;
export type DownloadInfoDto = any;
export type AssetJobsDto = any;
export type JobCreateDto = any;
export type AssetMediaResponseDto = { id: string; status: AssetMediaStatus; [key: string]: any };
export type ApiHttpError = ApiError & { data?: any };

// ---------------------------------------------------------------------------
// Mappers: custom-backend records -> Immich-shaped DTOs
// ---------------------------------------------------------------------------

export const fileRecordToAssetDto = (file: FileRecord): AssetResponseDto => {
  const isVideo = file.mimeType.startsWith('video/');
  return {
    id: file.id,
    type: isVideo ? AssetTypeEnum.Video : AssetTypeEnum.Image,
    thumbhash: null,
    originalFileName: file.name,
    originalPath: '',
    originalMimeType: file.mimeType,
    duration: file.videoMediaMetadata?.duration ?? null, // milliseconds
    width: file.imageMediaMetadata?.width,
    height: file.imageMediaMetadata?.height,
    isFavorite: file.isFavorite ?? false,
    isTrashed: false,
    visibility: AssetVisibility.Timeline,
    ownerId: '',
    fileCreatedAt: file.createdTime,
    localDateTime: file.createdTime,
    fileModifiedAt: file.createdTime,
    updatedAt: file.createdTime,
    livePhotoVideoId: null,
    stack: null,
    hasMetadata: true,
    isOffline: false,
    isEdited: false,
    exifInfo: { description: '' },
    people: [],
  };
};

export const apiUserToUserAdminDto = (user: ApiUser): UserAdminResponseDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  isAdmin: false,
  shouldChangePassword: false,
  isOnboarded: true,
});

// ---------------------------------------------------------------------------
// Functions backed by the custom backend
// ---------------------------------------------------------------------------

export const getBaseUrl = () => apiBaseUrl;

export const isHttpError = (error: unknown): error is ApiHttpError => error instanceof ApiError;

export async function getMyUser(): Promise<UserAdminResponseDto> {
  return apiUserToUserAdminDto(await authApi.getMe());
}

export async function getMyPreferences(): Promise<UserPreferencesResponseDto> {
  return {}; // server-side preferences do not exist in this backend
}

export async function logout(): Promise<{ redirectUri?: string }> {
  await authApi.logout();
  return {};
}

export async function getAssetInfo({ id }: { id: string } & Record<string, unknown>): Promise<AssetResponseDto> {
  return fileRecordToAssetDto(await filesApi.getFile(id));
}

export async function updateAsset({
  id,
  updateAssetDto,
}: {
  id: string;
  updateAssetDto: { name?: string; folderId?: string | null } & Record<string, unknown>;
}): Promise<AssetResponseDto> {
  return fileRecordToAssetDto(await filesApi.patchFile(id, updateAssetDto));
}

export async function updateAssets({ assetBulkUpdateDto }: { assetBulkUpdateDto: { ids: string[] } & Record<string, any> }) {
  const { ids, ...update } = assetBulkUpdateDto;
  for (const id of ids) {
    await filesApi.patchFile(id, update);
  }
}

export async function deleteAssets({ assetBulkDeleteDto }: { assetBulkDeleteDto: { ids: string[]; force?: boolean } }) {
  for (const id of assetBulkDeleteDto.ids) {
    await filesApi.deleteFile(id);
  }
}

// ---------------------------------------------------------------------------
// Static server info (no Immich server anymore)
// ---------------------------------------------------------------------------

export async function getServerConfig(): Promise<ServerConfigDto> {
  return { isInitialized: true, isOnboarded: true, maintenanceMode: false };
}

export async function getServerFeatures(): Promise<ServerFeaturesDto> {
  return {
    passwordLogin: true,
    oauth: false,
    oauthAutoLaunch: false,
    search: false,
    smartSearch: false,
    map: false,
    trash: false,
    email: true,
    configFile: false,
    duplicateDetection: false,
    realtimeTranscoding: false,
    ocr: false,
  };
}

export async function getAboutInfo(): Promise<ServerAboutResponseDto> {
  return { version: '1.0.0', licensed: true };
}

export async function getServerVersion(): Promise<ServerVersionResponseDto> {
  return { major: 1, minor: 0, patch: 0, prerelease: null };
}

// ---------------------------------------------------------------------------
// Unsupported Immich features — fail loudly if a leftover caller slips through
// ---------------------------------------------------------------------------

const unsupported = (name: string) => () => {
  throw new Error(`[compat] '${name}' is not supported by this backend`);
};

export const getAllAlbums = unsupported('getAllAlbums');
export const getAlbumInfo = unsupported('getAlbumInfo');
export const createAlbum = unsupported('createAlbum');
export const getAlbumStatistics = unsupported('getAlbumStatistics');
export const removeAssetFromAlbum = unsupported('removeAssetFromAlbum');
export const getStack = unsupported('getStack');
export const createStack = unsupported('createStack');
export const updateStack = unsupported('updateStack');
export const deleteStacks = unsupported('deleteStacks');
export const removeAssetFromStack = unsupported('removeAssetFromStack');
export const restoreAssets = unsupported('restoreAssets');
export const getAllPeople = unsupported('getAllPeople');
export const createPerson = unsupported('createPerson');
export const updatePerson = unsupported('updatePerson');
export const mergePerson = unsupported('mergePerson');
export const createFace = unsupported('createFace');
export const getFaces = unsupported('getFaces');
export const getAssetOcr = unsupported('getAssetOcr');
export const getAllTags = unsupported('getAllTags');
export const upsertTags = unsupported('upsertTags');
export const bulkTagAssets = unsupported('bulkTagAssets');
export const untagAssets = unsupported('untagAssets');
export const getAllSharedLinks = unsupported('getAllSharedLinks');
export const getDownloadInfo = unsupported('getDownloadInfo');
export const runAssetJobs = unsupported('runAssetJobs');
export const checkBulkUpload = unsupported('checkBulkUpload');
export const viewAsset = unsupported('viewAsset');
export const getAssetStatistics = unsupported('getAssetStatistics');
export const getMyCalendarHeatmap = unsupported('getMyCalendarHeatmap');
export const searchUsers = unsupported('searchUsers');
export const searchPlaces = unsupported('searchPlaces');
export const searchPluginMethods = unsupported('searchPluginMethods');
export const getPartners = unsupported('getPartners');
export const createPartner = unsupported('createPartner');
export const updatePartner = unsupported('updatePartner');
export const removePartner = unsupported('removePartner');
export const getApiKeys = unsupported('getApiKeys');
export const getSessions = unsupported('getSessions');
export const deleteSession = unsupported('deleteSession');
export const deleteAllSessions = unsupported('deleteAllSessions');
export const updateMyUser = unsupported('updateMyUser');
export const updateMyPreferences = unsupported('updateMyPreferences');
export const changePassword = unsupported('changePassword');
export const lockAuthSession = unsupported('lockAuthSession');
export const resetPinCode = unsupported('resetPinCode');
export const changePinCode = unsupported('changePinCode');
export const getAuthStatus = unsupported('getAuthStatus');
export const deleteProfileImage = unsupported('deleteProfileImage');
export const createProfileImage = unsupported('createProfileImage');
export const getVersionHistory = unsupported('getVersionHistory');
export const getStorage = unsupported('getStorage');
export const startOAuth = unsupported('startOAuth');
export const finishOAuth = unsupported('finishOAuth');
export const linkOAuthAccount = unsupported('linkOAuthAccount');
export const unlinkOAuthAccount = unsupported('unlinkOAuthAccount');
export const login = unsupported('login');
export const signUpAdmin = unsupported('signUpAdmin');
export const startDatabaseRestoreFlow = unsupported('startDatabaseRestoreFlow');
export const getServerLicense = unsupported('getServerLicense');
export const deleteUserLicense = unsupported('deleteUserLicense');
export const deleteServerLicense = unsupported('deleteServerLicense');

export const defaults: { fetch?: typeof fetch } = {};
