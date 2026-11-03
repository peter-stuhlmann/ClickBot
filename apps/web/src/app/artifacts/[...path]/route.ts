import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { artifactsDir, artifactType, byteRange, resolveArtifact } from '@/server/artifacts';
import { currentSession } from '@/server/auth';

type Context = { params: Promise<{ path: string[] }> };

const notFound = () => new Response('Nicht gefunden.', { status: 404 });

/**
 * Serves the worker's screenshots and videos, e.g. /artifacts/runs/<run>/<step>.png and
 * /artifacts/runs/<run>/video.mp4. Videos in parts (Range), as browsers ask for them to play and
 * seek; Safari plays none without.
 */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  // Screenshots show customer websites: only for signed-in users.
  if (!(await currentSession())?.complete)
    return new Response('Nicht angemeldet.', { status: 401 });
  const { path } = await params;
  const file = resolveArtifact(artifactsDir(), path);
  if (!file) return notFound();
  const size = await stat(file).then(
    (info) => (info.isFile() ? info.size : null),
    () => null,
  );
  if (size === null) return notFound();

  const headers = {
    'Content-Type': artifactType(file),
    'Cache-Control': 'private, max-age=86400',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  };
  if (size === 0) return new Response(null, { headers: { ...headers, 'Content-Length': '0' } });
  const range = byteRange(request.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      'Content-Length': String(end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
