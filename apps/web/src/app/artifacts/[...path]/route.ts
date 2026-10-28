import { readFile } from 'node:fs/promises';
import { artifactsDir, resolveArtifact } from '@/server/artifacts';
import { currentSession } from '@/server/auth';

type Context = { params: Promise<{ path: string[] }> };

const notFound = () => new Response('Nicht gefunden.', { status: 404 });

/** Serves the worker's screenshots, e.g. /artifacts/runs/<run>/<step>.png. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  // Screenshots show customer websites: only for signed-in users.
  if (!(await currentSession())?.complete)
    return new Response('Nicht angemeldet.', { status: 401 });
  const { path } = await params;
  const file = resolveArtifact(artifactsDir(), path);
  if (!file) return notFound();
  try {
    const image = await readFile(file);
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return notFound();
  }
}
