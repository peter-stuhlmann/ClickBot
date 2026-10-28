import { sql } from 'drizzle-orm';
import { createDb } from '../src/client';
import { customers } from '../src/schema';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://clickbot:clickbot@localhost:5443/clickbot_test';

/** One pool for all tests of the db project; files run one after another (see vitest.config). */
export const testConnection = createDb(TEST_DATABASE_URL);
export const db = testConnection.db;

export async function resetDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE run_steps, runs, jobs, secrets, proxies, location_profiles, customers, users,
      worker_heartbeats, sessions, invitations
    RESTART IDENTITY CASCADE
  `);
}

/** The only row of a query result; fails the test clearly if there is none. */
export function single<T>(rows: T[]): T {
  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    throw new Error(`Expected exactly one row, got ${rows.length}`);
  }
  return row;
}

export async function insertCustomer(name = 'Beispiel GmbH', slug = 'beispiel') {
  return single(await db.insert(customers).values({ name, slug }).returning());
}
