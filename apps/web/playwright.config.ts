import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PORT = 3200;
const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';

/**
 * End-to-end tests against a real Next.js server and the in-memory test database
 * (docker compose service db-test). global-setup rebuilds it with the demo data.
 * Run with `pnpm test:e2e`; not part of `pnpm test`, because it shares the test database
 * with the db integration tests.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // The tests change shared data (pausing jobs), so they run one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      // Separate build folder, so the e2e server can run next to `pnpm dev`.
      NEXT_DIST_DIR: '.next-e2e',
      // A fixed screenshot for the tests of the artifacts route.
      ARTIFACTS_DIR: fileURLToPath(new URL('./e2e/fixtures/artifacts', import.meta.url)),
    },
  },
});
