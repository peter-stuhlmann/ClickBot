import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'worker',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Real Chromium: page loads take longer than pure unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
