import { createDb } from '@click-bot/db';

/**
 * The worker tests use their own database in the db-test container, so they can run in
 * parallel with the tests of packages/db, which reset clickbot_test.
 */
export const WORKER_TEST_DATABASE = 'clickbot_worker_test';

export function workerTestUrl(): string {
  const base = new URL(
    process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test',
  );
  base.pathname = `/${WORKER_TEST_DATABASE}`;
  return base.href;
}

export const testConnection = createDb(workerTestUrl());
export const db = testConnection.db;

export async function resetDb(): Promise<void> {
  await testConnection.pool.query(`
    TRUNCATE run_steps, runs, jobs, secrets, proxies, location_profiles, customers, users,
      worker_heartbeats, sessions, invitations, ai_providers, page_analyses, recording_sessions
    RESTART IDENTITY CASCADE
  `);
}
