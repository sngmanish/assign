import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests share one real Postgres test database, so run files serially.
    fileParallelism: false,
  },
});
