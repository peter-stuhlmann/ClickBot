import type { PageFacts } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { db } from '../test/db';
import { ValidationError } from './errors';
import {
  claimPageAnalysis,
  completePageAnalysis,
  deleteOldPageAnalyses,
  getPageAnalysis,
  requestPageAnalysis,
  waitForPageAnalysis,
} from './page-analyses';

const now = new Date('2026-11-05T12:30:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

const facts: PageFacts = {
  url: 'https://beispiel.de/kontakt',
  title: 'Kontakt',
  snapshot: '- button "Absenden"',
  forms: 1,
  requiredFields: 2,
  cookieBanner: null,
  ga4: [],
};

describe('page analyses', () => {
  it('queues a page, hands it to one worker and stores what it found', async () => {
    const id = await requestPageAnalysis(db, 'https://beispiel.de/kontakt', now);
    expect(await getPageAnalysis(db, id)).toEqual({ status: 'queued', result: null, error: null });

    const claimed = await claimPageAnalysis(db, later(1));
    expect(claimed).toEqual({ id, url: 'https://beispiel.de/kontakt' });
    expect(await claimPageAnalysis(db, later(1))).toBeNull();
    expect((await getPageAnalysis(db, id))?.status).toBe('running');

    await completePageAnalysis(db, id, { facts }, later(4));
    expect(await getPageAnalysis(db, id)).toEqual({ status: 'done', result: facts, error: null });
  });

  it('keeps the reason when the page could not be opened', async () => {
    const id = await requestPageAnalysis(db, 'https://beispiel.de', now);
    await claimPageAnalysis(db, now);
    await completePageAnalysis(db, id, { error: 'Seite antwortet mit HTTP 401.' }, later(2));
    expect(await getPageAnalysis(db, id)).toEqual({
      status: 'failed',
      result: null,
      error: 'Seite antwortet mit HTTP 401.',
    });
  });

  it('hands out the oldest page first', async () => {
    const first = await requestPageAnalysis(db, 'https://eins.de', now);
    await requestPageAnalysis(db, 'https://zwei.de', later(1));
    expect((await claimPageAnalysis(db, later(2)))?.id).toBe(first);
  });

  it('only analyses web addresses', async () => {
    await expect(requestPageAnalysis(db, 'file:///etc/passwd', now)).rejects.toThrow(
      ValidationError,
    );
  });

  it('is null for an unknown or malformed id', async () => {
    expect(await getPageAnalysis(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await getPageAnalysis(db, 'kaputt')).toBeNull();
  });

  it('waits until the worker is done, checking between pauses', async () => {
    const id = await requestPageAnalysis(db, 'https://beispiel.de', now);
    let clock = now;
    let pauses = 0;
    const state = await waitForPageAnalysis(db, id, {
      deadline: later(30),
      now: () => clock,
      pause: async () => {
        pauses += 1;
        clock = later(pauses);
        if (pauses === 2) {
          await claimPageAnalysis(db, clock);
          await completePageAnalysis(db, id, { facts }, clock);
        }
      },
    });
    expect(state).toEqual({ status: 'done', result: facts, error: null });
    expect(pauses).toBe(2);
  });

  it('gives up at the deadline, e.g. when no worker picks the page up', async () => {
    const id = await requestPageAnalysis(db, 'https://beispiel.de', now);
    let clock = now;
    const state = await waitForPageAnalysis(db, id, {
      deadline: later(3),
      now: () => clock,
      pause: async () => {
        clock = later((clock.getTime() - now.getTime()) / 1000 + 1);
      },
    });
    expect(state).toBeNull();
  });

  it('forgets analyses older than the given time', async () => {
    const old = await requestPageAnalysis(db, 'https://alt.de', now);
    const fresh = await requestPageAnalysis(db, 'https://neu.de', later(3600));
    expect(await deleteOldPageAnalyses(db, later(60))).toBe(1);
    expect(await getPageAnalysis(db, old)).toBeNull();
    expect(await getPageAnalysis(db, fresh)).not.toBeNull();
  });
});
