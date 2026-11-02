import { eq } from 'drizzle-orm';
import type { Database } from './client';
import type { Cipher } from './crypto';
import { isUuid } from './ids';
import { runs } from './schema';

/** Long enough to open the connection, short enough that a copied address is soon useless. */
const VALID_MS = 2 * 60_000;
const PURPOSE = 'watch-run';

/**
 * "Live zuschauen": the web app hands the browser a token for the worker, which streams that run.
 * It is the run id and an expiry, encrypted with SECRETS_KEY (AES-GCM, so it cannot be forged or
 * changed), and needs no table: watching only shows, it changes nothing.
 */
export function createWatchToken(cipher: Cipher, runId: string, now: Date): string {
  return cipher.encrypt(
    JSON.stringify({ purpose: PURPOSE, runId, expires: now.getTime() + VALID_MS }),
  );
}

/** The run a token allows to watch, or null when it is not valid (any more). */
export function readWatchToken(cipher: Cipher, token: string, now: Date): string | null {
  try {
    const content: unknown = JSON.parse(cipher.decrypt(token));
    if (typeof content !== 'object' || content === null) return null;
    const { purpose, runId, expires } = content as Record<string, unknown>;
    if (purpose !== PURPOSE || typeof runId !== 'string' || !isUuid(runId)) return null;
    return typeof expires === 'number' && now.getTime() <= expires ? runId : null;
  } catch {
    return null;
  }
}

export type RunStatus = (typeof runs.$inferSelect)['status'];

/** Where a run stands, e.g. whether a watcher should keep waiting for it; null if unknown. */
export async function getRunStatus(db: Database, runId: string): Promise<RunStatus | null> {
  if (!isUuid(runId)) return null;
  const [run] = await db
    .select({ status: runs.status })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  return run?.status ?? null;
}
