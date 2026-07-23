import type { UserAdminResponseDto, UserPreferencesResponseDto } from '$lib/api/compat';
import { apiUserToUserAdminDto } from '$lib/api/compat';
import * as authApi from '$lib/api/auth';
import { getAccessToken, refreshAccessToken } from '$lib/api/client';
import { goto } from '$app/navigation';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { Route } from '$lib/route';

class AuthManager {
  isPurchased = $state(true); // no licensing in this backend
  isSharedLink = $derived(false);
  params = $derived({} as Record<string, string>);

  #user = $state<UserAdminResponseDto>();
  #preferences = $state<UserPreferencesResponseDto>({});

  get authenticated() {
    return !!this.#user;
  }

  get user() {
    if (!this.#user) {
      throw new TypeError('AuthManager.user is undefined');
    }

    return this.#user;
  }

  get preferences() {
    return this.#preferences;
  }

  constructor() {
    eventManager.on({
      SessionDelete: () => goto(Route.logout()),
    });
  }

  async load() {
    if (this.authenticated) {
      return;
    }

    // Restore the session from the httpOnly refresh cookie, then identify the user.
    if (!getAccessToken()) {
      const token = await refreshAccessToken();
      if (!token) {
        return;
      }
    }

    return this.refresh();
  }

  async refresh() {
    try {
      const user = await authApi.getMe();
      this.setUser(apiUserToUserAdminDto(user));
    } catch {
      // noop — unauthenticated
    }
  }

  setUser(user: UserAdminResponseDto) {
    this.#user = user;
    eventManager.emit('AuthUserLoaded', user);
  }

  setPreferences(preferences: UserPreferencesResponseDto) {
    this.#preferences = preferences;
  }

  async logout() {
    await authApi.logout().catch(() => {});
    this.reset();
    eventManager.emit('AuthLogout');
    await goto(Route.login());
  }

  reset() {
    this.#user = undefined;
  }
}

export const authManager = new AuthManager();
