import { redirect } from '@sveltejs/kit';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { Route } from '$lib/route';
import { getFormatter } from '$lib/utils/i18n';
import type { PageLoad } from './$types';

export const load = (async ({ parent }) => {
  await parent();

  if (authManager.authenticated) {
    redirect(307, Route.photos());
  }

  const $t = await getFormatter();

  return {
    meta: {
      title: $t('forgot_password'),
    },
  };
}) satisfies PageLoad;
