import { claimRecordingSession, endRecordingSession, type Database } from '@click-bot/db';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import type { BrowserContext } from 'playwright';
import { WebSocketServer, type WebSocket } from 'ws';
import { toStepMessage } from './errors';
import {
  parseClientMessage,
  startLiveSession,
  type LiveSession,
  type ServerMessage,
} from './live-session';

const PATH = '/live';
/** Frames are skipped while the connection is this far behind, so input stays responsive. */
const MAX_BUFFERED_BYTES = 2 * 1024 * 1024;

export type LiveServerOptions = {
  db: Database;
  /** A fresh context for one recording (viewport LIVE_VIEWPORT). */
  newContext: () => Promise<BrowserContext>;
  /** Whether a browser on this origin may connect: the web app's (see originPolicy). */
  allowOrigin: (origin: string) => boolean;
  /** Live browsers at the same time; each one is a browser context on the server. */
  maxSessions?: number;
  maxDurationMs?: number;
  clock?: () => Date;
  log?: (message: string) => void;
};

export type LiveServer = {
  port: number;
  activeSessions(): number;
  close(): Promise<void>;
};

/**
 * The web app (APP_URL) may open the live browser; during development also any local port, so
 * a second dev server works without configuration. The one-time token is needed either way.
 */
export function originPolicy(
  appUrl: string | undefined,
  production: boolean,
): (origin: string) => boolean {
  const app = appUrl ? new URL(appUrl).origin : 'http://localhost:3000';
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  return (origin) => origin === app || (!production && local.test(origin));
}

function refuse(socket: Duplex, status: number, reason: string) {
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/**
 * The live browser of "Im Browser aufnehmen", served by the worker over WebSocket. A connection
 * needs a one-time token from the web app (claimRecordingSession) and must come from the web
 * app's origin; it gets one browser context, for at most `maxDurationMs`.
 */
export async function startLiveServer(
  port: number,
  options: LiveServerOptions,
): Promise<LiveServer> {
  const now = options.clock ?? (() => new Date());
  const maxSessions = options.maxSessions ?? 2;
  const maxDurationMs = options.maxDurationMs ?? 15 * 60_000;
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Set<WebSocket>();
  let starting = 0;

  const server = createServer((_request, response) => {
    response.statusCode = 404;
    response.end();
  });

  server.on('upgrade', async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', 'http://worker');
    if (url.pathname !== PATH) return refuse(socket, 404, 'Not Found');
    // Browsers always send the origin; a page of another site cannot open the live browser.
    if (!options.allowOrigin(request.headers.origin ?? '')) {
      return refuse(socket, 403, 'Forbidden');
    }
    if (sockets.size + starting >= maxSessions) return refuse(socket, 503, 'Service Unavailable');

    starting += 1;
    try {
      const claimed = await claimRecordingSession(
        options.db,
        url.searchParams.get('token') ?? '',
        now(),
      );
      if (!claimed) return refuse(socket, 401, 'Unauthorized');
      wss.handleUpgrade(request, socket, head, (ws) => {
        starting -= 1;
        void serve(ws, claimed.id, claimed.startUrl);
      });
    } catch (error) {
      starting -= 1;
      options.log?.(`Live-Browser: ${toStepMessage(error)}`);
      refuse(socket, 500, 'Internal Server Error');
    }
  });

  async function serve(ws: WebSocket, id: string, startUrl: string) {
    sockets.add(ws);
    const send = (message: ServerMessage) => {
      if (ws.readyState !== ws.OPEN) return;
      if (message.type === 'frame' && ws.bufferedAmount > MAX_BUFFERED_BYTES) return;
      ws.send(JSON.stringify(message));
    };
    const ended = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    const timer = setTimeout(() => {
      send({ type: 'error', message: 'Die Aufnahme endet nach 15 Minuten.' });
      ws.close(1000);
    }, maxDurationMs);

    let session: LiveSession | undefined;
    let markReady: (session: LiveSession | undefined) => void = () => {};
    const ready = new Promise<LiveSession | undefined>((resolve) => (markReady = resolve));
    // Input is applied in order, also input sent while the page is still loading: typing must
    // not overtake the click into the field.
    let queue = Promise.resolve();
    ws.on('message', (raw) => {
      const message = parseClientMessage(String(raw));
      if (!message) return;
      queue = queue
        .then(async () => (await ready)?.handle(message))
        .catch((error: unknown) => send({ type: 'error', message: toStepMessage(error) }));
    });

    try {
      session = await startLiveSession(await options.newContext(), startUrl, send);
    } catch (error) {
      send({ type: 'error', message: `Live-Browser startet nicht: ${toStepMessage(error)}` });
      ws.close(1011);
    }
    markReady(session);
    await ended;
    clearTimeout(timer);
    sockets.delete(ws);
    await session?.close();
    await endRecordingSession(options.db, id, now()).catch(() => undefined);
  }

  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    port: (server.address() as AddressInfo).port,
    activeSessions: () => sockets.size,
    async close() {
      for (const ws of sockets) ws.close(1001);
      wss.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
