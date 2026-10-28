import { sql } from 'drizzle-orm';
import { createDb } from '../src/client';
import { runMigrations } from '../src/migrate';
import { TEST_DATABASE_URL } from './db';

/** Rebuilds the test database from the migrations, so every test run starts from scratch. */
export default async function setup(): Promise<void> {
  const connection = createDb(TEST_DATABASE_URL);
  try {
    await connection.pool.query('SELECT 1');
  } catch (error) {
    await connection.close();
    throw new Error(
      `Test-Datenbank unter ${TEST_DATABASE_URL} nicht erreichbar. Start mit: pnpm db:up`,
      { cause: error },
    );
  }

  try {
    await connection.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await connection.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await connection.db.execute(sql`CREATE SCHEMA public`);
    await runMigrations(connection.db);
  } finally {
    await connection.close();
  }
}
