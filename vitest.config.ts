import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@schedule/contracts/manual-schedule-limits',
        replacement: fileURLToPath(
          new URL('./packages/contracts/src/manual-schedule-limits.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/contracts/past-schedule-limits',
        replacement: fileURLToPath(
          new URL('./packages/contracts/src/past-schedule-limits.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/contracts/workspace-name',
        replacement: fileURLToPath(
          new URL('./packages/contracts/src/workspace-name.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/client-core/testing',
        replacement: fileURLToPath(
          new URL('./packages/client-core/src/testing/index.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/client-core',
        replacement: fileURLToPath(new URL('./packages/client-core/src/index.ts', import.meta.url)),
      },
      {
        find: '@schedule/presentation-core/testing',
        replacement: fileURLToPath(
          new URL('./packages/presentation-core/src/testing/index.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/presentation-core/event',
        replacement: fileURLToPath(
          new URL('./packages/presentation-core/src/event.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/presentation-core/export',
        replacement: fileURLToPath(
          new URL('./packages/presentation-core/src/export.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/presentation-core/statistics',
        replacement: fileURLToPath(
          new URL('./packages/presentation-core/src/statistics.ts', import.meta.url),
        ),
      },
      {
        find: '@schedule/presentation-core',
        replacement: fileURLToPath(
          new URL('./packages/presentation-core/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    // Database integration tests share the one isolated TEST_MYSQL_DATABASE.
    fileParallelism: false,
  },
});
