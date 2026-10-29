import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/*.d.ts',
        // Next.js routes and layouts are covered by the Playwright end-to-end tests.
        'apps/web/src/app/**',
        // Thin CLI wrappers around runMigrations and seedDemoData, which are tested.
        'packages/db/src/migrate-cli.ts',
        'packages/db/src/seed-cli.ts',
        'packages/db/src/invite-cli.ts',
        // Process wiring (signals, timers) around createWorker, which is tested.
        'apps/worker/src/main.ts',
        'apps/worker/src/demo-site.ts',
        // Declarative table definitions; their callbacks only run in drizzle-kit. The resulting
        // constraints are tested against the real database in schema.test.ts.
        'packages/db/src/schema.ts',
      ],
      thresholds: {
        'packages/shared/src/**': { branches: 95, functions: 95, lines: 95, statements: 95 },
        'packages/db/src/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
        'packages/ai/src/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
        'apps/*/src/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
      },
    },
  },
});
