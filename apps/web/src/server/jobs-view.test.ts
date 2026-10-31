// @vitest-environment node
import type { DashboardStats, JobOverviewRow } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toJobRow, toStatCards } from './jobs-view';

const now = new Date('2026-11-05T12:30:00Z');

const row = (overrides: Partial<JobOverviewRow> = {}): JobOverviewRow => ({
  id: 'job-1',
  name: 'Kontaktformular-Test',
  startUrl: 'https://beispiel.de/kontakt',
  status: 'active',
  customerName: 'Beispiel GmbH',
  campaignName: 'Black Friday',
  schedule: { type: 'interval', everyMinutes: 15, maxRuns: 20, startAt: '2026-11-05T10:00:00Z' },
  runsDone: 7,
  runsPlanned: 20,
  lastRun: { id: 'run-7', status: 'passed', finishedAt: new Date(now.getTime() - 3 * 60_000) },
  successRate: 1,
  ...overrides,
});

describe('toJobRow', () => {
  it('builds the row of the jobs table', () => {
    expect(toJobRow(row(), now)).toEqual({
      id: 'job-1',
      name: 'Kontaktformular-Test',
      campaign: 'Black Friday',
      url: 'beispiel.de/kontakt',
      schedule: { primary: 'alle 15 Min.', secondary: '20-mal' },
      progress: { label: '7 / 20 Durchläufe', value: 0.35 },
      lastRun: {
        tone: 'success',
        label: 'Erfolgreich',
        when: 'vor 3 Min.',
        href: '/laeufe/run-7',
      },
      successRate: { text: '100 %', tone: 'success' },
      status: { label: 'Aktiv', active: true, toggleable: true },
    });
  });

  it.each([
    ['passed', 'success', 'Erfolgreich'],
    ['warning', 'warning', 'Mit Hinweis'],
    ['failed', 'danger', 'Fehlgeschlagen'],
  ] as const)('shows a %s run as %s badge', (status, tone, label) => {
    const view = toJobRow(row({ lastRun: { id: 'run-1', status, finishedAt: now } }), now);
    expect(view.lastRun).toMatchObject({ tone, label });
  });

  it.each([
    [1, 'success'],
    [0.95, 'success'],
    [0.94, 'warning'],
    [0.85, 'warning'],
    [0.84, 'danger'],
  ])('colours a success rate of %f as %s', (rate, tone) => {
    expect(toJobRow(row({ successRate: rate }), now).successRate?.tone).toBe(tone);
  });

  it('shows no last run and no rate for a job that never ran', () => {
    const view = toJobRow(row({ runsDone: 0, lastRun: null, successRate: null }), now);
    expect(view).toMatchObject({ lastRun: null, successRate: null });
    expect(view.progress).toEqual({ label: '0 / 20 Durchläufe', value: 0 });
  });

  it('keeps progress between 0 and 1, also without planned runs', () => {
    expect(toJobRow(row({ runsDone: 3, runsPlanned: 0 }), now).progress.value).toBe(0);
    expect(toJobRow(row({ runsDone: 30, runsPlanned: 20 }), now).progress.value).toBe(1);
  });

  it.each([
    ['active', 'Aktiv', true, true],
    ['paused', 'Pausiert', false, true],
    ['draft', 'Entwurf', false, false],
    ['finished', 'Beendet', false, false],
  ] as const)('shows status %s as %s', (status, label, active, toggleable) => {
    expect(toJobRow(row({ status }), now).status).toEqual({ label, active, toggleable });
  });
});

describe('toStatCards', () => {
  const stats: DashboardStats = {
    activeJobs: 3,
    finishedJobs: 1,
    runsToday: 42,
    runsYesterday: 34,
    successRate7d: { successful: 312, finished: 328 },
    failures24h: { count: 2, jobNames: ['Login & Bestellstatus'] },
  };

  it('builds the four cards of the design', () => {
    expect(toStatCards(stats)).toEqual([
      { label: 'Aktive Tests', value: '3', hint: '1 Test beendet' },
      { label: 'Durchläufe heute', value: '42', hint: '+8 gegenüber gestern' },
      { label: 'Erfolgsquote (7 Tage)', value: '95,1 %', hint: '312 von 328 Durchläufen' },
      { label: 'Fehler (24 Std.)', value: '2', hint: 'Login & Bestellstatus' },
    ]);
  });

  it('explains empty figures instead of showing 0 %', () => {
    const cards = toStatCards({
      activeJobs: 0,
      finishedJobs: 0,
      runsToday: 0,
      runsYesterday: 0,
      successRate7d: { successful: 0, finished: 0 },
      failures24h: { count: 0, jobNames: [] },
    });
    expect(cards.map((card) => [card.value, card.hint])).toEqual([
      ['0', 'keine beendeten Tests'],
      ['0', 'wie gestern'],
      ['–', 'noch keine Durchläufe'],
      ['0', 'keine Fehler'],
    ]);
  });

  it('shows fewer runs than yesterday with a real minus sign', () => {
    const cards = toStatCards({ ...stats, runsToday: 5, runsYesterday: 8 });
    expect(cards[1]?.hint).toBe('−3 gegenüber gestern');
  });

  it('shortens a long list of failing jobs', () => {
    const cards = toStatCards({
      ...stats,
      failures24h: { count: 5, jobNames: ['Login', 'Shop', 'Newsletter', 'Kontakt'] },
    });
    expect(cards[3]?.hint).toBe('Login, Shop +2');
  });
});
