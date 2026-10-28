import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      // Next.js routes and layouts are covered by the Playwright end-to-end tests.
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts', '**/*.d.ts', 'apps/web/src/app/**'],
      thresholds: {
        'packages/shared/src/**': { branches: 95, functions: 95, lines: 95, statements: 95 },
        'apps/*/src/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
      },
    },
  },
});
