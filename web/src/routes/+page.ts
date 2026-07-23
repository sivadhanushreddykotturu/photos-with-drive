import { redirect } from '@sveltejs/kit';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { Route } from '$lib/route';
import type { PageLoad } from './$types';

export const ssr = false;
export const csr = true;

export const load = (async () => {
  try {
    await authManager.load();
    if (authManager.authenticated) {
      redirect(307, Route.photos());
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (redirectError: any) {
    if (redirectError?.status === 307) {
      throw redirectError;
    }
  }

  redirect(307, Route.login());
}) satisfies PageLoad;
