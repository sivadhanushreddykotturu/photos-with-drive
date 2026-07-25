import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // TODO pending `@immich/ui` to enable it
    // runes: true,
  },
  preprocess: vitePreprocess(),
  kit: {
    version: {
      name: process.env.IMMICH_BUILD || process.env.npm_package_version || 'local',
    },
    paths: {
      relative: false,
    },
    adapter: adapter({
      fallback: 'index.html',
      // Disabled: *.gz sidecars break the Android Capacitor asset merger.
      precompress: false,
    }),
    alias: {
      $lib: 'src/lib',
      '$lib/*': 'src/lib/*',
      $i18n: '../i18n',
    },
  },
  onwarn: (warning, handler) => {
    if (warning.code === 'state_referenced_locally') {
      return;
    }
    handler(warning);
  },
};

export default config;
