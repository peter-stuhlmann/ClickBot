import { createCipher, createDb, parseKey, recoverStaleRuns } from '@click-bot/db';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createFileArtifactStore } from './artifacts';
import { contextOptionsFor } from './devices';
import { createWorker } from './worker';

/**
 * Worker process (`pnpm worker`). Assumes a single worker: on start it fails every run left
 * in `running` by a previous process.
 */
const TICK_MS = 1_000;
const HEARTBEAT_MS = 10_000;
const STALE_RUN_MS = 15 * 60_000;

const log = (message: string) => process.stdout.write(`[worker] ${message}\n`);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL fehlt (siehe .env.example).');
  process.exit(1);
}
const cipher = createCipher(parseKey(process.env.SECRETS_KEY));
const maxConcurrent = Number(process.env.MAX_CONCURRENT_BROWSERS ?? 6);
const artifactsDir =
  process.env.ARTIFACTS_DIR ?? fileURLToPath(new URL('../../../data/artifacts', import.meta.url));

const connection = createDb(databaseUrl);
const browser = await chromium.launch();
const worker = createWorker({
  db: connection.db,
  cipher,
  newContext: (device) => browser.newContext(contextOptionsFor(device)),
  artifacts: createFileArtifactStore(artifactsDir),
  maxConcurrent,
  workerId: `${hostname()}-${process.pid}`,
  log,
});

const orphaned = await recoverStaleRuns(connection.db, { now: new Date(), staleAfterMs: 0 });
if (orphaned > 0)
  log(`${orphaned} abgebrochene Läufe vom letzten Start als fehlgeschlagen markiert.`);

let ticking = false;
const tick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const started = await worker.tick();
    if (started.length > 0) {
      const runs = started.length === 1 ? '1 Lauf' : `${started.length} Läufe`;
      log(`${runs} gestartet, aktiv: ${worker.activeRuns()}`);
    }
  } catch (error) {
    log(`Fehler im Takt: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    ticking = false;
  }
};
const beat = () => worker.heartbeat().catch((error: unknown) => log(`Heartbeat: ${String(error)}`));
const stale = () =>
  recoverStaleRuns(connection.db, { now: new Date(), staleAfterMs: STALE_RUN_MS }).catch(() => 0);

await beat();
const timers = [
  setInterval(tick, TICK_MS),
  setInterval(beat, HEARTBEAT_MS),
  setInterval(stale, STALE_RUN_MS),
];
log(`bereit · bis zu ${maxConcurrent} Browser gleichzeitig · Bildschirmfotos in ${artifactsDir}`);

async function shutdown(signal: string) {
  log(`${signal} empfangen, warte auf laufende Läufe …`);
  timers.forEach(clearInterval);
  await worker.stop();
  await browser.close();
  await connection.close();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
