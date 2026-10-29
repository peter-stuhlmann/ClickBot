import { createRecordingSession, schema } from '@click-bot/db';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { useBrowser } from '../test/browser';
import { db, resetDb, testConnection } from '../test/db';
import { LIVE_VIEWPORT, type ServerMessage } from './live-session';
import { originPolicy, startLiveServer, type LiveServer } from './live-server';

const browser = useBrowser();
const APP = 'http://localhost:3000';
let server: LiveServer;

beforeEach(async () => {
  await resetDb();
  server = await startLiveServer(0, {
    db,
    newContext: () => browser.newContext({ viewport: LIVE_VIEWPORT }),
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

async function token(path = '/aufnahme.html') {
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
    { userId: (user as { id: string }).id, startUrl: `${browser.origin()}${path}` },
    new Date(),
  );
}

/** Opens a connection like the browser of the web app does; resolves once it is open. */
function connect(query: string, origin = APP) {
  const ws = new WebSocket(`ws://localhost:${server.port}/live?${query}`, { headers: { origin } });
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

describe('startLiveServer', () => {
  it('streams the live browser for a valid token and records what the user does', async () => {
    const session = await token();
    const { ws, messages, opened } = connect(`token=${session.token}`);
    await opened;

    await expect.poll(() => messages.some((m) => m.type === 'frame')).toBe(true);
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
    await expect.poll(() => messages.some((m) => m.type === 'ready')).toBe(true);

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
