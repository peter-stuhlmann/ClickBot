// @vitest-environment node
import type { CampaignOverviewRow, CampaignStats } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { describePeriod, toCampaignRow, toCampaignStatCards } from './campaigns-view';

const now = new Date('2026-11-05T12:30:00Z');

const row = (overrides: Partial<CampaignOverviewRow> = {}): CampaignOverviewRow => ({
  id: 'k1',
  name: 'Black Friday',
  startsOn: '2026-11-20',
  endsOn: '2026-11-30',
  jobs: { total: 4, active: 3, finished: 1 },
  hosts: ['beispiel.de', 'shop.beispiel.de'],
  runs30d: { finished: 312, successful: 300 },
  lastRun: { id: 'run-1', status: 'passed', finishedAt: new Date(now.getTime() - 3 * 60_000) },
  ...overrides,
});

describe('describePeriod', () => {
  it.each([
    ['2026-11-20', '2026-11-30', '20.11.–30.11.2026'],
    ['2026-12-20', '2027-01-06', '20.12.2026–06.01.2027'],
    ['2026-11-20', null, 'ab 20.11.2026'],
    [null, '2026-11-30', 'bis 30.11.2026'],
    [null, null, null],
  ])('%s – %s → %s', (from, to, text) => {
    expect(describePeriod(from, to)).toBe(text);
  });
});

describe('toCampaignRow', () => {
  it('builds the row of the campaign table', () => {
    expect(toCampaignRow(row(), now)).toEqual({
      id: 'k1',
      name: 'Black Friday',
      detail: '20.11.–30.11.2026 · beispiel.de · 2 Websites',
      jobs: { primary: '4 Jobs', secondary: '3 aktiv · 1 beendet' },
      runs: { label: '312 Läufe · 96,2 % ok', value: 300 / 312 },
      lastRun: {
        tone: 'success',
        label: 'Erfolgreich',
        when: 'vor 3 Min.',
        href: '/laeufe/run-1',
      },
      successRate: { text: '96,2 %', tone: 'success' },
    });
  });

  it('describes a new campaign without period, jobs and runs', () => {
    expect(
      toCampaignRow(
        row({
          startsOn: null,
          endsOn: null,
          jobs: { total: 0, active: 0, finished: 0 },
          hosts: [],
          runs30d: { finished: 0, successful: 0 },
          lastRun: null,
        }),
        now,
      ),
    ).toMatchObject({
      detail: 'noch keine Website',
      jobs: { primary: '0 Jobs', secondary: 'noch keine Jobs' },
      runs: { label: 'keine Läufe', value: 0 },
      lastRun: null,
      successRate: null,
    });
  });
});

describe('toCampaignStatCards', () => {
  it('shows campaigns, jobs, runs and success rate of the project', () => {
    const stats: CampaignStats = {
      campaigns: 3,
      jobs: { total: 5, active: 4, finished: 1 },
      runs30d: 120,
      runsPrevious30d: 100,
      successRate30d: { successful: 114, finished: 120 },
    };
    expect(toCampaignStatCards(stats)).toEqual([
      { label: 'Kampagnen', value: '3', hint: 'in diesem Projekt' },
      { label: 'Jobs gesamt', value: '5', hint: '4 aktiv · 1 beendet' },
      { label: 'Läufe (30 Tage)', value: '120', hint: '+20 % zu den 30 Tagen davor' },
      { label: 'Erfolgsquote (30 Tage)', value: '95 %', hint: '114 von 120 Läufen' },
    ]);
  });

  it('says plainly when there is nothing yet', () => {
    const cards = toCampaignStatCards({
      campaigns: 0,
      jobs: { total: 0, active: 0, finished: 0 },
      runs30d: 0,
      runsPrevious30d: 0,
      successRate30d: { successful: 0, finished: 0 },
    });
    expect(cards.map((card) => card.hint)).toEqual([
      'noch keine Kampagnen',
      '0 aktiv · 0 beendet',
      'kein Vergleich',
      'noch keine Läufe',
    ]);
  });
});
