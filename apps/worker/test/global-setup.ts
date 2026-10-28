import { createDb } from '@click-bot/db';
import { runMigrations } from '@click-bot/db/migrate';
import { WORKER_TEST_DATABASE, workerTestUrl } from './db';

/** Creates the worker's test database if needed and rebuilds it from the migrations. */
export default async function setup(): Promise<void> {
  const adminUrl =
    process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';
  const admin = createDb(adminUrl);
  try {
    const { rowCount } = await admin.pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      WORKER_TEST_DATABASE,
    ]);
    if (rowCount === 0) await admin.pool.query(`CREATE DATABASE ${WORKER_TEST_DATABASE}`);
  } catch (error) {
    throw new Error(`Test-Datenbank ${adminUrl} nicht erreichbar. Start mit: pnpm db:up`, {
      cause: error,
    });
  } finally {
    await admin.close();
  }

  const connection = createDb(workerTestUrl());
  try {
    await connection.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await connection.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await connection.pool.query('CREATE SCHEMA public');
    await runMigrations(connection.db);
  } finally {
    await connection.close();
  }
}
