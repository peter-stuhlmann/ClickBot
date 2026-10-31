import {
  type Browser,
  createCipher,
  createDb,
  deleteExpiredSessions,
  parseKey,
  recoverStaleRuns,
} from '@click-bot/db';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { BROWSER_KINDS } from '@click-bot/shared';
import { createFileArtifactStore } from './artifacts';
import { createBrowserManager, type BrowserManager } from './browser-manager';
import { contextOptionsFor } from './devices';
import { launchEngine } from './engines';
import { originPolicy, startLiveServer } from './live-server';
import { LIVE_VIEWPORT } from './live-session';
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
// One shared process per browser engine, started by the first run that needs it; after a crash
// the next run starts a new one.
const browsers = Object.fromEntries(
  BROWSER_KINDS.map((kind) => [kind, createBrowserManager(() => launchEngine(kind), log)]),
) as Record<Browser, BrowserManager>;
// Chromium right away, so a missing installation shows up at once.
await browsers.chromium.get();
const worker = createWorker({
  db: connection.db,
  cipher,
  newContext: async (device, kind) => {
    const browser = await browsers[kind].get();
    return browser.newContext(contextOptionsFor(device, kind, browser.version()));
  },
  artifacts: createFileArtifactStore(artifactsDir),
  maxConcurrent,
  workerId: `${hostname()}-${process.pid}`,
  log,
});

// "Im Browser aufnehmen": the live browser, in the shared Chromium, for the web app only.
const liveServer = await startLiveServer(Number(process.env.LIVE_PORT ?? 4200), {
  db: connection.db,
  newContext: async () =>
    (await browsers.chromium.get()).newContext({
      viewport: LIVE_VIEWPORT,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    }),
  allowOrigin: originPolicy(process.env.APP_URL, process.env.NODE_ENV === 'production'),
  maxSessions: Number(process.env.LIVE_MAX_SESSIONS ?? 2),
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
// Every 15 minutes: runs a crashed worker left behind and logins nobody finished.
const stale = () =>
  Promise.all([
    recoverStaleRuns(connection.db, { now: new Date(), staleAfterMs: STALE_RUN_MS }),
    deleteExpiredSessions(connection.db, new Date()),
  ]).catch((error: unknown) => log(`Aufräumen: ${String(error)}`));

await beat();
const timers = [
  setInterval(tick, TICK_MS),
  setInterval(beat, HEARTBEAT_MS),
  setInterval(stale, STALE_RUN_MS),
];
log(
  `bereit · bis zu ${maxConcurrent} Browser gleichzeitig · Bildschirmfotos in ${artifactsDir} · Live-Browser auf Port ${liveServer.port}`,
);

async function shutdown(signal: string) {
  log(`${signal} empfangen, warte auf laufende Läufe …`);
  timers.forEach(clearInterval);
  await liveServer.close();
  await worker.stop();
  await Promise.all(Object.values(browsers).map((manager) => manager.close()));
  await connection.close();
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
