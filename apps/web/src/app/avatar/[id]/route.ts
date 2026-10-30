import { getAvatar } from '@click-bot/db';
import { currentSession } from '@/server/auth';
import { getDb } from '@/server/db';

type Context = { params: Promise<{ id: string }> };

/** Serves a profile picture, e.g. /avatar/<user>?v=<time>; the time makes the address unique. */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  if (!(await currentSession())?.complete)
    return new Response('Nicht angemeldet.', { status: 401 });
  const avatar = await getAvatar(getDb(), (await params).id);
  if (!avatar) return new Response('Nicht gefunden.', { status: 404 });
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      // Only PNG, JPEG or WebP get stored (by their first bytes); never sniff anything else.
      'Content-Type': avatar.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
