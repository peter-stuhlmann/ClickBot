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
  // Without a listener, a dropped idle connection (e.g. database restart) crashes the process.
  // The pool replaces the client on the next query.
  pool.on('error', (error) => {
    console.error('Datenbank-Verbindung unterbrochen, sie wird neu aufgebaut:', error.message);
  });
  return { db: drizzle(pool, { schema }), pool, close: () => pool.end() };
}
