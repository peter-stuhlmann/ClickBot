import { and, inArray, isNotNull, lt } from 'drizzle-orm';
import type { Database } from './client';
import { runs } from './schema';

/** How long the video of a run is kept: they are large, the report stays without it. */
export const VIDEO_DAYS = 30;

/**
 * Forgets the videos of runs that ended more than VIDEO_DAYS days before `now` and returns their
 * paths below ARTIFACTS_DIR, for the worker to remove the files.
 */
export async function expireVideos(db: Database, now: Date): Promise<string[]> {
  const before = new Date(now.getTime() - VIDEO_DAYS * 86_400_000);
  return db.transaction(async (tx) => {
    // RETURNING after the update would give the new value, null: read the paths first.
    const expired = await tx
      .select({ id: runs.id, path: runs.videoPath })
      .from(runs)
      .where(and(isNotNull(runs.videoPath), lt(runs.finishedAt, before)))
      .for('update');
    if (expired.length === 0) return [];
    await tx
      .update(runs)
      .set({ videoPath: null, videoCues: null })
      .where(
        inArray(
          runs.id,
          expired.map(({ id }) => id),
        ),
      );
    return expired.flatMap(({ path }) => (path ? [path] : []));
  });
}
