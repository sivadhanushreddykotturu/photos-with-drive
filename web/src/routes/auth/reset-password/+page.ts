import { redirect } from '@sveltejs/kit';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { Route } from '$lib/route';
import { getFormatter } from '$lib/utils/i18n';
import type { PageLoad } from './$types';

export const load = (async ({ parent, url }) => {
  await parent();

  if (authManager.authenticated) {
    redirect(307, Route.photos());
  }

  const token = url.searchParams.get('token') ?? '';

  const $t = await getFormatter();

  return {
    meta: {
      title: $t('reset_password'),
    },
    token,
  };
}) satisfies PageLoad;
