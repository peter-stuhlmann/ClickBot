import { getRunReport, NotFoundError } from '@click-bot/db';
import { currentSession } from '@/server/auth';
import { getDb } from '@/server/db';
import { toVideoCaptions } from '@/server/run-report-view';

type Context = { params: Promise<{ id: string }> };

/** The captions of a run's video (WebVTT), for the <track> of the player in the report. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  // The step titles name the customer's website: only for signed-in users.
  if (!(await currentSession())?.complete)
    return new Response('Nicht angemeldet.', { status: 401 });
  const { id } = await params;
  const report = await getRunReport(getDb(), id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!report) return new Response('Nicht gefunden.', { status: 404 });
  return new Response(toVideoCaptions(report), {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
