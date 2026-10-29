import { and, eq, gt, isNull } from 'drizzle-orm';
import { hashToken, newToken } from './auth';
import type { Database } from './client';
import { ValidationError } from './errors';
import { recordingSessions } from './schema';

/** Time to open the live browser after the web app handed out the token. */
const CONNECT_WITHIN_MS = 2 * 60_000;

export type ClaimedRecording = { id: string; userId: string; startUrl: string };

function isWebAddress(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Starts "Im Browser aufnehmen" for a user: returns the one-time token the browser connects to
 * the worker with. An older session of the same user ends, so one person has one live browser.
 */
export async function createRecordingSession(
  db: Database,
  input: { userId: string; startUrl: string },
  now: Date,
): Promise<{ id: string; token: string }> {
  if (!isWebAddress(input.startUrl)) {
    throw new ValidationError([
      { path: 'startUrl', message: 'Start-URL muss mit http:// oder https:// beginnen.' },
    ]);
  }
  const token = newToken();
  return db.transaction(async (tx) => {
    await tx
      .update(recordingSessions)
      .set({ endedAt: now })
      .where(and(eq(recordingSessions.userId, input.userId), isNull(recordingSessions.endedAt)));
    const [row] = await tx
      .insert(recordingSessions)
      .values({
        userId: input.userId,
        startUrl: input.startUrl,
        tokenHash: hashToken(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + CONNECT_WITHIN_MS),
      })
      .returning({ id: recordingSessions.id });
    return { id: (row as { id: string }).id, token };
  });
}

/** The session for `token`, once: unknown, used, expired or ended tokens give null. */
export async function claimRecordingSession(
  db: Database,
  token: string,
  now: Date,
): Promise<ClaimedRecording | null> {
  const [row] = await db
    .update(recordingSessions)
    .set({ claimedAt: now })
    .where(
      and(
        eq(recordingSessions.tokenHash, hashToken(token)),
        isNull(recordingSessions.claimedAt),
        isNull(recordingSessions.endedAt),
        gt(recordingSessions.expiresAt, now),
      ),
    )
    .returning({
      id: recordingSessions.id,
      userId: recordingSessions.userId,
      startUrl: recordingSessions.startUrl,
    });
  return row ?? null;
}

export async function endRecordingSession(db: Database, id: string, now: Date): Promise<void> {
  await db
    .update(recordingSessions)
    .set({ endedAt: now })
    .where(and(eq(recordingSessions.id, id), isNull(recordingSessions.endedAt)));
}
