import {
  claimNextRun,
  completeRun,
  createCipher,
  createJob,
  createRecordingSession,
  createWatchToken,
  queueTestRun,
  schema,
} from '@click-bot/db';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { useBrowser } from '../test/browser';
import { db, resetDb, testConnection } from '../test/db';
import { concealSecrets } from './conceal';
import { LIVE_VIEWPORT, type ServerMessage } from './live-session';
import { originPolicy, startLiveServer, type LiveServer } from './live-server';
import { createRunWatchRegistry, type RunWatchRegistry } from './run-watch';
import type { WatchMessage } from './watch-stream';

const browser = useBrowser();
const APP = 'http://localhost:3000';
let server: LiveServer;
let devicesAsked: string[] = [];

beforeEach(async () => {
  await resetDb();
  devicesAsked = [];
  server = await startLiveServer(0, {
    db,
    newContext: (device) => {
      devicesAsked.push(device);
      return browser.newContext({ viewport: LIVE_VIEWPORT });
    },
    allowOrigin: (origin) => origin === APP,
    maxSessions: 1,
  });
});

afterEach(async () => {
  await server.close();
});

afterAll(async () => {
  await testConnection.close();
});

async function token(path = '/aufnahme.html', device: 'desktop' | 'android' = 'desktop') {
  const [user] = await db
    .insert(schema.users)
    .values({
      email: `p${Date.now()}@beispiel.de`,
      name: 'Peter',
      passwordHash: 'x',
      role: 'admin',
    })
    .returning();
  return createRecordingSession(
    db,
    { userId: (user as { id: string }).id, startUrl: `${browser.origin()}${path}`, device },
    new Date(),
  );
}

/** Opens a connection like the browser of the web app does; resolves once it is open. */
function connect(query: string, origin = APP, path = '/live') {
  const ws = new WebSocket(`ws://localhost:${server.port}${path}?${query}`, {
    headers: { origin },
  });
  const messages: ServerMessage[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(String(raw)) as ServerMessage));
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('unexpected-response', (_request, response) =>
      reject(new Error(`HTTP ${response.statusCode}`)),
    );
  });
  return { ws, messages, opened };
}

const closed = (ws: WebSocket) => new Promise((resolve) => ws.once('close', resolve));

describe('originPolicy', () => {
  it('allows only the web app in production', () => {
    const allow = originPolicy('https://click-bot.agentur.de/', true);
    expect(allow('https://click-bot.agentur.de')).toBe(true);
    expect(allow('http://localhost:3000')).toBe(false);
    expect(allow('https://boese.example')).toBe(false);
  });

  it('also allows any local port during development, e.g. a second dev server', () => {
    const allow = originPolicy(undefined, false);
    expect(allow('http://localhost:3000')).toBe(true);
    expect(allow('http://localhost:3100')).toBe(true);
    expect(allow('http://127.0.0.1:3200')).toBe(true);
    expect(allow('http://localhost.boese.example')).toBe(false);
    expect(allow('')).toBe(false);
  });
});

// Starting a session opens a browser context and a page; under the load of the whole test run
// that takes longer than the default second of expect.poll.
const SESSION_START = { timeout: 10_000 };

describe('startLiveServer', () => {
  it('opens the live browser as the device the session was started for', async () => {
    const session = await token('/aufnahme.html', 'android');
    const { ws, messages, opened } = connect(`token=${session.token}`);
    await opened;
    await expect.poll(() => messages.some((m) => m.type === 'ready'), SESSION_START).toBe(true);
    expect(devicesAsked).toEqual(['android']);
    ws.close();
    await closed(ws);
  });

  it('streams the live browser for a valid token and records what the user does', async () => {
    const session = await token();
    const { ws, messages, opened } = connect(`token=${session.token}`);
    await opened;

    await expect.poll(() => messages.some((m) => m.type === 'frame'), SESSION_START).toBe(true);
    expect(messages.filter((m) => m.type === 'step')).toEqual([
      { type: 'step', step: { type: 'open', url: `${browser.origin()}/aufnahme.html` } },
    ]);

    ws.send(JSON.stringify({ type: 'navigate', url: `${browser.origin()}/kontakt.html` }));
    await expect.poll(() => messages.filter((m) => m.type === 'step').length).toBe(2);

    ws.close();
    await closed(ws);
    await expect
      .poll(async () => {
        const [row] = await db
          .select({ endedAt: schema.recordingSessions.endedAt })
          .from(schema.recordingSessions)
          .where(eq(schema.recordingSessions.id, session.id));
        return row?.endedAt instanceof Date;
      })
      .toBe(true);
    await expect.poll(() => server.activeSessions()).toBe(0);
  });

  it('ignores messages that are not allowed', async () => {
    const session = await token();
    const { ws, messages, opened } = connect(`token=${session.token}`);
    await opened;
    await expect.poll(() => messages.some((m) => m.type === 'ready'), SESSION_START).toBe(true);

    ws.send('{"type":"evaluate","code":"document.cookie"}');
    ws.send(JSON.stringify({ type: 'navigate', url: `${browser.origin()}/kontakt.html` }));
    await expect.poll(() => messages.filter((m) => m.type === 'step').length).toBe(2);
    expect(messages.filter((m) => m.type === 'error')).toEqual([]);
    ws.close();
    await closed(ws);
  });

  it.each([
    ['without a token', () => 'token=', APP, 'HTTP 401'],
    ['with a token that was made up', () => 'token=erfunden', APP, 'HTTP 401'],
  ])('refuses a connection %s', async (_case, query, origin, status) => {
    await expect(connect(query(), origin).opened).rejects.toThrow(status);
  });

  it('refuses a connection from another website, even with a valid token', async () => {
    const session = await token();
    await expect(connect(`token=${session.token}`, 'https://boese.example').opened).rejects.toThrow(
      'HTTP 403',
    );
  });

  it('uses a token only once', async () => {
    const session = await token();
    const first = connect(`token=${session.token}`);
    await first.opened;
    first.ws.close();
    await closed(first.ws);
    await expect.poll(() => server.activeSessions()).toBe(0);
    await expect(connect(`token=${session.token}`).opened).rejects.toThrow('HTTP 401');
  });

  it('turns new live browsers away while all are in use', async () => {
    const first = connect(`token=${(await token()).token}`);
    await first.opened;
    await expect(connect(`token=${(await token()).token}`).opened).rejects.toThrow('HTTP 503');
    first.ws.close();
    await closed(first.ws);
  });

  it('ends a recording after the maximum time', async () => {
    await server.close();
    server = await startLiveServer(0, {
      db,
      newContext: () => browser.newContext({ viewport: LIVE_VIEWPORT }),
      allowOrigin: (origin) => origin === APP,
      maxDurationMs: 300,
    });
    const { ws, messages, opened } = connect(`token=${(await token()).token}`);
    await opened;
    await closed(ws);
    expect(messages).toContainEqual({
      type: 'error',
      message: 'Die Aufnahme endet nach 15 Minuten.',
    });
  });
});

describe('startLiveServer – watching a run', () => {
  const cipher = createCipher(randomBytes(32));
  let runs: RunWatchRegistry;

  beforeEach(async () => {
    await server.close();
    runs = createRunWatchRegistry();
    server = await startLiveServer(0, {
      db,
      newContext: () => browser.newContext({ viewport: LIVE_VIEWPORT }),
      allowOrigin: (origin) => origin === APP,
      cipher,
      runs,
    });
  });

  function watch(runId: string, origin = APP) {
    const token = encodeURIComponent(createWatchToken(cipher, runId, new Date()));
    const connection = connect(`token=${token}`, origin, '/watch');
    return { ...connection, messages: connection.messages as unknown as WatchMessage[] };
  }

  const has = (messages: WatchMessage[], type: WatchMessage['type']) =>
    messages.some((message) => message.type === type);

  /** A run of a job in the database, still waiting, as "Testlauf" queues it. */
  async function queuedRun() {
    const [customer] = await db
      .insert(schema.customers)
      .values({ name: 'Beispiel GmbH', slug: 'beispiel' })
      .returning();
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({ customerId: (customer as { id: string }).id, name: 'Allgemein' })
      .returning();
    const job = await createJob(db, {
      campaignId: (campaign as { id: string }).id,
      name: 'Kontakt',
      startUrl: browser.origin(),
      flow: { version: 1, steps: [{ id: 'open', type: 'open', url: '/kontakt.html' }] },
      schedule: {
        type: 'interval',
        everyMinutes: 60,
        maxRuns: 1,
        startAt: new Date().toISOString(),
      },
    });
    return (await queueTestRun(db, job.id, new Date(), { once: true })).runId;
  }

  it('streams the page and the steps of a running run, until it ends', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const runId = randomUUID();
    const tap = runs.start(runId, { engine: 'chromium', secrets: [], total: 2 });
    tap.page(page);
    await page.goto(`${browser.origin()}/kontakt.html`);

    const { ws, messages, opened } = watch(runId);
    await opened;
    await expect.poll(() => has(messages, 'frame'), SESSION_START).toBe(true);
    tap.step(0, 'running');
    tap.step(0, 'passed');
    await expect
      .poll(() => messages.filter((message) => message.type === 'step'))
      .toEqual([
        { type: 'step', index: 0, total: 2, status: 'running' },
        { type: 'step', index: 0, total: 2, status: 'passed' },
      ]);

    tap.end('passed');
    await closed(ws);
    expect(messages.at(-1)).toEqual({ type: 'ended', status: 'passed' });
    await expect.poll(() => server.activeWatchers()).toBe(0);
    await context.close();
  });

  it('waits for a run that has not started yet', async () => {
    const runId = await queuedRun();
    const { ws, messages, opened } = watch(runId);
    await opened;
    await expect.poll(() => messages).toEqual([{ type: 'waiting' }]);

    const context = await browser.newContext();
    const page = await context.newPage();
    const tap = runs.start(runId, { engine: 'chromium', secrets: [], total: 1 });
    tap.page(page);
    await page.goto(`${browser.origin()}/kontakt.html`);
    await expect.poll(() => has(messages, 'frame'), SESSION_START).toBe(true);
    ws.close();
    await closed(ws);
    await context.close();
  });

  it('ends at once for a run that is over, and says so for one that does not exist', async () => {
    const runId = await queuedRun();
    await claimNextRun(db, new Date());
    await completeRun(db, runId, { status: 'failed', finishedAt: new Date(), steps: [] });
    const over = watch(runId);
    await closed(over.ws);
    expect(over.messages).toEqual([{ type: 'ended', status: 'failed' }]);

    const unknown = watch(randomUUID());
    await closed(unknown.ws);
    expect(unknown.messages).toEqual([
      { type: 'error', message: 'Diesen Durchlauf gibt es nicht.' },
    ]);
  });

  it('shows a page with a secret blurred, and hides it only while one is in the clear', async () => {
    const context = await browser.newContext();
    await concealSecrets(context, ['geheim-123']);
    const page = await context.newPage();
    await page.goto(`${browser.origin()}/kontakt.html`);
    await page.getByLabel('Name').fill('geheim-123');
    const runId = randomUUID();
    const tap = runs.start(runId, { engine: 'chromium', secrets: ['geheim-123'], total: 2 });
    tap.page(page);

    const { ws, messages, opened } = watch(runId);
    await opened;
    // The field is blurred: the page is shown.
    await expect.poll(() => has(messages, 'frame'), SESSION_START).toBe(true);
    expect(has(messages, 'hidden')).toBe(false);

    // Split over two elements no box covers it: no picture while it is there.
    await page.evaluate(() => {
      const split = document.createElement('p');
      split.id = 'getrennt';
      split.innerHTML = '<b>geheim</b>-123';
      document.body.append(split);
    });
    await expect.poll(() => has(messages, 'hidden'), SESSION_START).toBe(true);
    const hiddenAt = messages.findIndex((message) => message.type === 'hidden');

    await page.evaluate(() => document.querySelector('#getrennt')?.remove());
    await expect
      .poll(
        () => messages.slice(hiddenAt).some((message) => message.type === 'frame'),
        SESSION_START,
      )
      .toBe(true);
    ws.close();
    await closed(ws);
    await context.close();
  });

  it('refuses a token that is not valid, and other websites', async () => {
    await expect(connect('token=erfunden', APP, '/watch').opened).rejects.toThrow('HTTP 401');
    await expect(watch(randomUUID(), 'https://boese.example').opened).rejects.toThrow('HTTP 403');
  });
});
