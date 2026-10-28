import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  confirmTotpSetup,
  createCipher,
  createDb,
  parseKey,
  registerFirstAdmin,
  seedDemoData,
  startTotpSetup,
  totpCode,
  totpStep,
} from '@click-bot/db';
import { runMigrations } from '@click-bot/db/migrate';
import { CREDENTIALS, E2E_ADMIN, E2E_SECRETS_KEY, STORAGE_STATE } from './auth-setup';

/**
 * Fresh test database with the demo data before every e2e run, plus an admin with 2FA whose
 * session the specs use, so they start signed in.
 */
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
    await connection.close();
    throw new Error(`Test-Datenbank ${url} nicht bereit. Start mit: pnpm db:up`, { cause: error });
  }

  try {
    const cipher = createCipher(parseKey(E2E_SECRETS_KEY));
    const now = new Date();
    const pending = await registerFirstAdmin(connection.db, E2E_ADMIN, now);
    const setup = await startTotpSetup(connection.db, cipher, pending.token, now);
    if (!setup) throw new Error('2FA-Einrichtung für den E2E-Admin nicht möglich.');
    const done = await confirmTotpSetup(
      connection.db,
      cipher,
      pending.token,
      totpCode(setup.secret, totpStep(now)),
      now,
    );
    if (!('token' in done)) throw new Error(done.error);

    await mkdir(dirname(STORAGE_STATE), { recursive: true });
    await writeFile(
      STORAGE_STATE,
      JSON.stringify({
        cookies: [
          {
            name: 'clickbot_session',
            value: done.token,
            domain: 'localhost',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      }),
    );
    await writeFile(CREDENTIALS, JSON.stringify({ ...E2E_ADMIN, secret: setup.secret }));
  } finally {
    await connection.close();
  }
}
