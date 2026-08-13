import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests must also run from a clean checkout where ignored package dist files do not exist.
    alias: {
      '@schedule/client-core': fileURLToPath(
        new URL('./packages/client-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    // Database integration tests share the one isolated TEST_MYSQL_DATABASE.
    fileParallelism: false,
  },
});
