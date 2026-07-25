import { commandPaletteManager } from '@immich/ui';
import { languageManager } from '$lib/managers/language-manager.svelte';
import { init } from '$lib/utils/server';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const csr = true;

export const load = (async ({ fetch }) => {
  let error;
  try {
    await init(fetch);
  } catch (initError) {
    error = initError;
  }

  commandPaletteManager.enable();
  languageManager.init();

  return {
    error,
    meta: {
      title: 'Immich',
    },
  };
}) satisfies LayoutLoad;
