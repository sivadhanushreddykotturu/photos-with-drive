import { redirect } from '@sveltejs/kit';
import { DateTime } from 'luxon';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { Route } from '$lib/route';

export interface AuthOptions {
  admin?: true;
  public?: boolean;
}

export const authenticate = async (url: URL, options?: AuthOptions) => {
  const { public: publicRoute } = options || {};
  await authManager.load();

  if (publicRoute) {
    return;
  }

  if (!authManager.authenticated) {
    redirect(307, Route.login({ continue: url.pathname + url.search }));
  }
};

export const requestServerInfo = async () => {
  // No server storage endpoint in this backend.
};

export const getAccountAge = (): number => {
  if (!authManager.authenticated) {
    return 0;
  }

  const createdDate = DateTime.fromISO(authManager.user.createdAt ?? new Date().toISOString());
  const now = DateTime.now();
  const accountAge = now.diff(createdDate, 'days').days.toFixed(0);

  return Number(accountAge);
};
