import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db, insertCampaign } from '../test/db';
import { createCipher } from './crypto';
import { createJob } from './jobs';
import { queueTestRun } from './test-runs';
import { createWatchToken, getRunStatus, readWatchToken } from './watch-tokens';

const cipher = createCipher(randomBytes(32));
const now = new Date('2026-11-02T20:00:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const RUN = '0b7c3b5e-3f2a-4d0e-9a51-6f1d2c3b4a59';

describe('watch tokens', () => {
  it('lets the worker read which run may be watched, for two minutes', () => {
    const token = createWatchToken(cipher, RUN, now);
    expect(readWatchToken(cipher, token, later(119))).toBe(RUN);
    expect(readWatchToken(cipher, token, later(121))).toBeNull();
  });

  it('refuses a changed token, one of another key, and other encrypted values', () => {
    const token = createWatchToken(cipher, RUN, now);
    const [version, iv, tag, data] = token.split(':') as [string, string, string, string];
    const flipped = Buffer.from(data, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(
      readWatchToken(cipher, [version, iv, tag, flipped.toString('base64')].join(':'), now),
    ).toBeNull();
    expect(readWatchToken(createCipher(randomBytes(32)), token, now)).toBeNull();
    // A stored secret is encrypted with the same key, but it is no token.
    expect(readWatchToken(cipher, cipher.encrypt('geheim'), now)).toBeNull();
    expect(readWatchToken(cipher, cipher.encrypt(JSON.stringify({ runId: RUN })), now)).toBeNull();
    expect(readWatchToken(cipher, 'kaputt', now)).toBeNull();
  });
});

describe('getRunStatus', () => {
  it('tells whether a run still waits, runs or is done; null for an unknown one', async () => {
    const { campaignId } = await insertCampaign();
    const job = await createJob(db, {
      campaignId,
      name: 'Kurse',
      startUrl: 'https://beispiel.de',
      flow: { version: 1, steps: [{ id: 'open', type: 'open', url: '/' }] },
      schedule: { type: 'interval', everyMinutes: 60, maxRuns: 1, startAt: now.toISOString() },
    });
    const { runId } = await queueTestRun(db, job.id, now, { once: true });

    expect(await getRunStatus(db, runId)).toBe('queued');
    expect(await getRunStatus(db, RUN)).toBeNull();
    expect(await getRunStatus(db, 'run-1')).toBeNull();
  });
});
