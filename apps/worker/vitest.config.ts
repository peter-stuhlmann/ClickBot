import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'worker',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Worker tests that touch the queue use their own database (see test/db.ts).
    globalSetup: ['./test/global-setup.ts'],
    // The queue tests share that database; run the files one after another.
    fileParallelism: false,
    // Real Chromium: page loads take longer than pure unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
