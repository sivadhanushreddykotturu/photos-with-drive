// DTOs matching the custom Express + MongoDB backend (backend-mongo).

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type ApiTokens = {
  accessToken: string;
  refreshToken: string;
};

export type ApiLoginResponse = ApiTokens & { user: ApiUser };

export type StorageQuota = {
  total: number | null;
  used: number;
};

export type ConnectedAccount = {
  id: string;
  provider: 'google';
  googleAccountEmail: string;
  scope: string[];
  storageQuota: StorageQuota;
  lastSyncedAt: string | null;
  createdAt: string;
};

export type FileRecord = {
  id: string;
  connectedAccountId: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink: string | null;
  imageMediaMetadata: { width?: number; height?: number } | null;
  videoMediaMetadata: { duration?: number } | null;
  createdTime: string;
  folderId: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  isFavorite: boolean;
};

export type FileGroup = {
  date: string; // YYYY-MM-DD
  files: FileRecord[];
};

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: { path: string; message: string }[];
};
