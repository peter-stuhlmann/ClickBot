import 'server-only';
import { createDb, schema, type Database, type DbConnection } from '@click-bot/db';

type Slot = { connection?: DbConnection; schema?: object };

/**
 * The cached connection, or a new one when the schema is not the one it was made with. In
 * development Next reloads @click-bot/db after a change, while globalThis survives; a connection
 * made with the old schema would not know new columns. The old pool is closed then.
 */
export function connectionFor(
  slot: Slot,
  currentSchema: object,
  create: () => DbConnection,
): DbConnection {
  if (slot.connection && slot.schema === currentSchema) return slot.connection;
  const old = slot.connection;
  slot.connection = create();
  slot.schema = currentSchema;
  void old?.close().catch(() => {});
  return slot.connection;
}

// One pool per server process. It lives on globalThis, so module reloads in development do not
// open a new pool on every change.
const globalForDb = globalThis as unknown as { clickBotDbSlot?: Slot };

export function getDb(): Database {
  globalForDb.clickBotDbSlot ??= {};
  return connectionFor(globalForDb.clickBotDbSlot, schema, () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL fehlt (siehe .env.example).');
    return createDb(url);
  }).db;
}
