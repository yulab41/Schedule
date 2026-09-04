import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');

  return {
    envDir: '../..',
    plugins: [
      vue(),
      Components({
        dts: 'src/components.d.ts',
        resolvers: [TDesignResolver({ library: 'vue-next' })],
      }),
      webAppManifestPlugin(),
    ],
    build: {
      rollupOptions: {
        input: {
          app: fileURLToPath(new URL('./index.html', import.meta.url)),
          iconParity: fileURLToPath(new URL('./icon-parity.html', import.meta.url)),
        },
        output: {
          manualChunks: {
            'vendor-query': ['@tanstack/vue-query'],
            'vendor-vue': ['pinia', 'vue', 'vue-router'],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          target: env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
