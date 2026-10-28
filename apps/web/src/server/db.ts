import 'server-only';
import { createDb, type Database } from '@click-bot/db';

// One pool per server process. In development Next reloads modules, so the pool lives on
// globalThis to avoid opening a new one on every change.
const globalForDb = globalThis as unknown as { clickBotDb?: Database };

export function getDb(): Database {
  if (!globalForDb.clickBotDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL fehlt (siehe .env.example).');
    globalForDb.clickBotDb = createDb(url).db;
  }
  return globalForDb.clickBotDb;
}
