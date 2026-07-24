import { getFormatter } from '$lib/utils/i18n';
import type { PageLoad } from './$types';

// Public page — no auth guard on purpose.
export const load = (async () => {
  const $t = await getFormatter();

  return {
    meta: {
      title: $t('shared_links'),
    },
  };
}) satisfies PageLoad;
