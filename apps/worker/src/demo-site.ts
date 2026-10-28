import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Local demo website for the demo jobs (`pnpm demo-site`), so trying out Click-Bot never sends
 * a bot to a real third-party website. Listens on 127.0.0.1 only.
 */
const ROOT = fileURLToPath(new URL('../demo-site', import.meta.url));
const PORT = Number(process.env.DEMO_SITE_PORT ?? 4100);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://x').pathname;
  const file = join(ROOT, normalize(pathname === '/' ? '/kontakt.html' : pathname));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Demo-Website läuft auf http://127.0.0.1:${PORT}\n`);
});
