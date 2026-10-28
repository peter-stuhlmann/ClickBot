import { createDb, seedDemoData } from '@click-bot/db';
import { runMigrations } from '@click-bot/db/migrate';

/** Fresh test database with the demo data before every e2e run. */
export default async function globalSetup(): Promise<void> {
  const url =
    process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';
  const connection = createDb(url);
  try {
    await connection.pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await connection.pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await connection.pool.query('CREATE SCHEMA public');
    await runMigrations(connection.db);
    await seedDemoData(connection.db, new Date());
  } catch (error) {
    throw new Error(`Test-Datenbank ${url} nicht bereit. Start mit: pnpm db:up`, { cause: error });
  } finally {
    await connection.close();
  }
}
