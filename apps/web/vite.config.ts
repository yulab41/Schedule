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
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
