import { describe, expect, it } from 'vitest';
import { db, insertCampaign, single } from '../test/db';
import { runMigrations } from './migrate';
import { aiProviders, customers, jobs, locationProfiles, runs, users } from './schema';

// These rules live in the database itself, so they hold even for writes that bypass the
// repository functions (manual SQL, future scripts).
describe('database constraints', () => {
  it('applies migrations a second time without changes', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });

  it.each(['Beispiel GmbH', 'beispiel_gmbh', '-beispiel', 'beispiel-'])(
    'rejects customer slug %j',
    async (slug) => {
      await expect(db.insert(customers).values({ name: 'X', slug })).rejects.toThrow();
    },
  );

  it('treats e-mail addresses as case-insensitive and unique', async () => {
    await db.insert(users).values({ email: 'peter@agentur.de', name: 'Peter', passwordHash: 'x' });
    await expect(
      db.insert(users).values({ email: 'Peter@Agentur.DE', name: 'Peter 2', passwordHash: 'x' }),
    ).rejects.toThrow();
  });

  it('rejects lowercase country codes and impossible coordinates', async () => {
    const profile = {
      name: 'Berlin',
      country: 'DE',
      latitude: 52.52,
      longitude: 13.4,
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
    };
    await expect(
      db.insert(locationProfiles).values({ ...profile, country: 'de' }),
    ).rejects.toThrow();
    await expect(
      db.insert(locationProfiles).values({ ...profile, latitude: 91 }),
    ).rejects.toThrow();
    await expect(
      db.insert(locationProfiles).values({ ...profile, longitude: -181 }),
    ).rejects.toThrow();
    await expect(db.insert(locationProfiles).values(profile)).resolves.toBeDefined();
  });

  it('rejects a job without devices', async () => {
    const { customerId, campaignId } = await insertCampaign();
    await expect(
      db.insert(jobs).values({
        customerId,
        campaignId,
        name: 'X',
        startUrl: 'https://beispiel.de',
        flow: { version: 1, steps: [] },
        schedule: {
          type: 'interval',
          everyMinutes: 15,
          maxRuns: 1,
          startAt: '2026-11-05T13:00:00Z',
        },
        devices: [],
      }),
    ).rejects.toThrow();
  });

  it('rejects a run that finishes before it started, and two runs with the same number', async () => {
    const { customerId, campaignId } = await insertCampaign();
    const job = single(
      await db
        .insert(jobs)
        .values({
          customerId,
          campaignId,
          name: 'X',
          startUrl: 'https://beispiel.de',
          flow: { version: 1, steps: [] },
          schedule: {
            type: 'interval',
            everyMinutes: 15,
            maxRuns: 1,
            startAt: '2026-11-05T13:00:00Z',
          },
        })
        .returning(),
    );
    const run = { jobId: job.id, runNr: 1, device: 'desktop' as const, scheduledAt: new Date() };

    await expect(
      db.insert(runs).values({
        ...run,
        startedAt: new Date('2026-11-05T13:00:10Z'),
        finishedAt: new Date('2026-11-05T13:00:00Z'),
      }),
    ).rejects.toThrow();

    await db.insert(runs).values(run);
    await expect(db.insert(runs).values(run)).rejects.toThrow();
  });

  it('allows only one default AI provider', async () => {
    const key = { apiKeyEnc: 'x', apiKeyHint: '…1234' };
    await db.insert(aiProviders).values({ kind: 'openai', model: 'm', ...key, isDefault: true });
    await expect(
      db.insert(aiProviders).values({ kind: 'gemini', model: 'm', ...key, isDefault: true }),
    ).rejects.toThrow();
  });

  it('needs a key for every AI provider but a custom one, and an address only for that', async () => {
    await expect(db.insert(aiProviders).values({ kind: 'openai', model: 'm' })).rejects.toThrow();
    await expect(db.insert(aiProviders).values({ kind: 'custom', model: 'm' })).rejects.toThrow();
    await expect(
      db.insert(aiProviders).values({
        kind: 'openai',
        model: 'm',
        apiKeyEnc: 'x',
        apiKeyHint: '…',
        baseUrl: 'http://anders',
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(aiProviders).values({ kind: 'custom', model: 'm', baseUrl: 'http://localhost/v1' }),
    ).resolves.toBeDefined();
  });
});
