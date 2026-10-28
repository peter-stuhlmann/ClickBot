import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export type DbConnection = {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
};

export function createDb(connectionString: string): DbConnection {
  const pool = new pg.Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema }), pool, close: () => pool.end() };
}
