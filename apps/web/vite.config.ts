import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

import { webAppManifest } from './src/manifest.js';

function webAppManifestPlugin(): Plugin {
  return {
    apply: 'build',
    generateBundle() {
      this.emitFile({
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(webAppManifest, null, 2),
        type: 'asset',
      });
    },
    name: 'web-app-manifest',
  };
}

export default defineConfig({
  envDir: '../..',
  plugins: [vue(), webAppManifestPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
