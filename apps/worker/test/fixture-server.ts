import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = fileURLToPath(new URL('./fixtures/site', import.meta.url));
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8' };

export type FixtureServer = { origin: string; close: () => Promise<void> };

/**
 * Serves test/fixtures/site on a random local port.
 * Special paths: `/fehler` answers with HTTP 500, `/haengt` never answers, `/geschuetzt` needs
 * HTTP Basic Auth with demo / geheim-123 (like an .htaccess password).
 */
export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer(async (request, response) => {
    // Compare the URL path before normalize(), which uses backslashes on Windows.
    const pathname = new URL(request.url ?? '/', 'http://x').pathname;
    if (pathname === '/fehler') {
      response.writeHead(500).end('Interner Fehler');
      return;
    }
    if (pathname === '/haengt') return;
    if (pathname === '/geschuetzt') {
      const expected = `Basic ${Buffer.from('demo:geheim-123').toString('base64')}`;
      if (request.headers.authorization !== expected) {
        response
          .writeHead(401, { 'www-authenticate': 'Basic realm="Staging"' })
          .end('Passwort nötig');
        return;
      }
      response
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end('<!doctype html><title>Staging</title><h1>Geschützter Bereich</h1>');
      return;
    }
    const file = join(SITE_DIR, normalize(pathname));
    if (!file.startsWith(SITE_DIR)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'text/plain' });
      response.end(body);
    } catch {
      response.writeHead(404).end('Nicht gefunden');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // Hanging requests (/haengt) would otherwise keep the server open forever.
        server.closeAllConnections();
      }),
  };
}
