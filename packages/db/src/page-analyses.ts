import type { PageFacts } from '@click-bot/shared';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from './client';
import { ValidationError } from './errors';
import { isUuid } from './ids';
import { pageAnalyses } from './schema';

export type PageAnalysisState = {
  status: (typeof pageAnalyses.$inferSelect)['status'];
  result: PageFacts | null;
  error: string | null;
};

/** Queues the start page for the worker to open once; returns the id to ask for the result. */
export async function requestPageAnalysis(db: Database, url: string, now: Date): Promise<string> {
  let protocol = '';
  try {
    protocol = new URL(url).protocol;
  } catch {
    // Reported below.
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new ValidationError([
      { path: 'url', message: 'Start-URL muss mit http:// oder https:// beginnen.' },
    ]);
  }
  const [row] = await db
    .insert(pageAnalyses)
    .values({ url, createdAt: now })
    .returning({ id: pageAnalyses.id });
  return (row as { id: string }).id;
}

/** The oldest waiting page, for exactly one worker (same pattern as claimNextRun). */
export async function claimPageAnalysis(
  db: Database,
  now: Date,
): Promise<{ id: string; url: string } | null> {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: pageAnalyses.id, url: pageAnalyses.url })
      .from(pageAnalyses)
      .where(eq(pageAnalyses.status, 'queued'))
      .orderBy(asc(pageAnalyses.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!next) return null;
    await tx
      .update(pageAnalyses)
      .set({ status: 'running', startedAt: now })
      .where(eq(pageAnalyses.id, next.id));
    return next;
  });
}

export async function completePageAnalysis(
  db: Database,
  id: string,
  outcome: { facts: PageFacts } | { error: string },
  now: Date,
): Promise<void> {
  await db
    .update(pageAnalyses)
    .set(
      'facts' in outcome
        ? { status: 'done', result: outcome.facts, finishedAt: now }
        : { status: 'failed', error: outcome.error, finishedAt: now },
    )
    .where(and(eq(pageAnalyses.id, id), eq(pageAnalyses.status, 'running')));
}

export async function getPageAnalysis(db: Database, id: string): Promise<PageAnalysisState | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ status: pageAnalyses.status, result: pageAnalyses.result, error: pageAnalyses.error })
    .from(pageAnalyses)
    .where(eq(pageAnalyses.id, id));
  return row ?? null;
}

/**
 * Checks after every `pause` until the worker finished the analysis; null once `deadline` passed
 * without a result.
 */
export async function waitForPageAnalysis(
  db: Database,
  id: string,
  options: { deadline: Date; now: () => Date; pause: () => Promise<void> },
): Promise<PageAnalysisState | null> {
  for (;;) {
    const state = await getPageAnalysis(db, id);
    if (state && (state.status === 'done' || state.status === 'failed')) return state;
    if (options.now().getTime() >= options.deadline.getTime()) return null;
    await options.pause();
  }
}

/** Clean-up: analyses are only needed while the user waits for the suggestion. */
export async function deleteOldPageAnalyses(db: Database, before: Date): Promise<number> {
  const deleted = await db
    .delete(pageAnalyses)
    .where(lt(pageAnalyses.createdAt, before))
    .returning({ id: sql`1` });
  return deleted.length;
}
