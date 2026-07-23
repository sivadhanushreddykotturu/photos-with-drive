import type { AssetResponseDto, LoginResponseDto, UserAdminResponseDto } from '$lib/api/compat';
import type { FileRecord } from '$lib/api/types';
import { BaseEventManager } from '$lib/utils/base-event-manager.svelte';

export type Events = {
  AppInit: [];
  AppNavigate: [];

  AuthLogin: [LoginResponseDto | unknown];
  AuthLogout: [];
  AuthUserLoaded: [UserAdminResponseDto];

  LanguageChange: [{ name: string; code: string; rtl?: boolean }];

  AssetUpdate: [AssetResponseDto];
  AssetsDelete: [string[]];
  AssetsUpload: [FileRecord[]];

  SessionDelete: [];
};

export const eventManager = new BaseEventManager<Events>();
