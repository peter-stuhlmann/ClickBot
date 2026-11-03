import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import { createJob } from './jobs';
import { runs } from './schema';
import { expireVideos, VIDEO_DAYS } from './videos';

const now = new Date('2026-11-05T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

async function newJob() {
  const { campaignId } = await insertCampaign();
  return createJob(db, {
    campaignId,
    name: 'Kontaktformular',
    startUrl: 'https://beispiel.de',
    flow: { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] },
    schedule: { type: 'interval', everyMinutes: 60, maxRuns: 1, startAt: now.toISOString() },
    devices: ['desktop'],
  });
}

async function runWithVideo(
  jobId: string,
  runNr: number,
  finishedAt: Date | null,
  videoPath: string | null,
) {
  const [run] = await db
    .insert(runs)
    .values({
      jobId,
      runNr,
      botNr: 1,
      device: 'desktop',
      status: finishedAt ? 'passed' : 'running',
      scheduledAt: daysAgo(40),
      startedAt: daysAgo(40),
      finishedAt,
      videoPath,
    })
    .returning();
  return run?.id as string;
}

describe('expireVideos', () => {
  it(`forgets videos older than ${VIDEO_DAYS} days and says which files to remove`, async () => {
    const { id } = await newJob();
    const old = await runWithVideo(id, 1, daysAgo(VIDEO_DAYS + 1), 'runs/alt/video.mp4');
    const recent = await runWithVideo(id, 2, daysAgo(VIDEO_DAYS - 1), 'runs/neu/video.mp4');
    await runWithVideo(id, 3, daysAgo(VIDEO_DAYS + 5), null);

    expect(await expireVideos(db, now)).toEqual(['runs/alt/video.mp4']);
    const [stored] = await db.select().from(runs).where(eq(runs.id, old));
    expect(stored?.videoPath).toBeNull();
    const [kept] = await db.select().from(runs).where(eq(runs.id, recent));
    expect(kept?.videoPath).toBe('runs/neu/video.mp4');

    // Once forgotten, a video is not named again.
    expect(await expireVideos(db, now)).toEqual([]);
  });
});
