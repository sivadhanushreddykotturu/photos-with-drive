import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type UserConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
  },
  server: {
    allowedHosts: true,
  },
  plugins: [
    enhancedImages(),
    tailwindcss(),
    sveltekit(),
    process.env.BUILD_STATS === 'true'
      ? visualizer({
          emitFile: true,
          filename: 'stats.html',
        })
      : undefined,
  ],
  optimizeDeps: {
    entries: ['src/**/*.{svelte,ts,html}'],
  },
} as UserConfig);
