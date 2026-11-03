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

// The demo runs have no screenshots. The last run of "Login & Bestellstatus" gets the fixtures
// in e2e/fixtures/artifacts for its first two steps and the failed last one, for the gallery.
const SCREENSHOTS = `
  WITH last_run AS (
    SELECT r.id FROM runs r JOIN jobs j ON j.id = r.job_id
    WHERE j.name = 'Login & Bestellstatus' ORDER BY r.run_nr DESC LIMIT 1
  ), steps AS (
    SELECT s.run_id, s.step_index,
      row_number() OVER (ORDER BY s.step_index) AS n, count(*) OVER () AS total
    FROM run_steps s JOIN last_run ON s.run_id = last_run.id
  )
  UPDATE run_steps rs SET screenshot_path = CASE steps.n
    WHEN 1 THEN 'runs/e2e/0-open.png' WHEN 2 THEN 'runs/e2e/1-desktop.png'
    ELSE 'runs/e2e/2-phone.png' END
  FROM steps
  WHERE rs.run_id = steps.run_id AND rs.step_index = steps.step_index
    AND (steps.n <= 2 OR steps.n = steps.total)`;

// The same run gets a short video (e2e/fixtures/artifacts) with its first two steps as cues.
const VIDEO = `
  UPDATE runs SET video_path = 'runs/e2e/video.mp4',
    video_cues = '[{"step":0,"from":0,"to":1200},{"step":1,"from":1200,"to":2500}]'::jsonb
  WHERE id = (
    SELECT r.id FROM runs r JOIN jobs j ON j.id = r.job_id
    WHERE j.name = 'Login & Bestellstatus' ORDER BY r.run_nr DESC LIMIT 1
  )`;

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
    await connection.pool.query(SCREENSHOTS);
    await connection.pool.query(VIDEO);
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
