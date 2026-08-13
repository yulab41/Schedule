import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Database integration tests share the one isolated TEST_MYSQL_DATABASE.
    fileParallelism: false,
  },
});
