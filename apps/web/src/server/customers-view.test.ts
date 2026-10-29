// @vitest-environment node
import type { CustomerOverviewRow, CustomerStats } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { toCustomerRow, toCustomerStatCards } from './customers-view';

const now = new Date('2026-11-05T12:30:00Z');

const row = (overrides: Partial<CustomerOverviewRow> = {}): CustomerOverviewRow => ({
  id: 'c1',
  name: 'Beispiel GmbH',
  jobs: { total: 4, active: 3, finished: 1 },
  hosts: ['beispiel.de', 'shop.beispiel.de', 'staging.beispiel.de'],
  runs30d: { finished: 312, successful: 300 },
  lastRun: { id: 'run-1', status: 'passed', finishedAt: new Date(now.getTime() - 3 * 60_000) },
  ...overrides,
});

describe('toCustomerRow', () => {
  it('builds the row of the customer table', () => {
    expect(toCustomerRow(row(), now)).toEqual({
      id: 'c1',
      name: 'Beispiel GmbH',
      websites: 'beispiel.de · 3 Websites',
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

  it('describes a new customer without jobs and runs', () => {
    expect(
      toCustomerRow(
        row({
          jobs: { total: 0, active: 0, finished: 0 },
          hosts: [],
          runs30d: { finished: 0, successful: 0 },
          lastRun: null,
        }),
        now,
      ),
    ).toMatchObject({
      websites: 'noch keine Website',
      jobs: { primary: '0 Jobs', secondary: 'noch keine Jobs' },
      runs: { label: 'keine Läufe', value: 0 },
      lastRun: null,
      successRate: null,
    });
  });

  it('counts a single website and job in the singular', () => {
    expect(
      toCustomerRow(
        row({ hosts: ['mueller-shop.de'], jobs: { total: 1, active: 1, finished: 0 } }),
        now,
      ),
    ).toMatchObject({ websites: 'mueller-shop.de · 1 Website', jobs: { primary: '1 Job' } });
  });
});

describe('toCustomerStatCards', () => {
  const stats: CustomerStats = {
    customers: 4,
    newThisMonth: 1,
    jobs: { total: 14, active: 11, finished: 3 },
    runs30d: 1_240,
    runsPrevious30d: 1_050,
    successRate30d: { successful: 1_185, finished: 1_240 },
  };

  it('shows the four figures of the design', () => {
    expect(toCustomerStatCards(stats)).toEqual([
      { label: 'Projekte', value: '4', hint: '1 neu in diesem Monat' },
      { label: 'Jobs gesamt', value: '14', hint: '11 aktiv · 3 beendet' },
      { label: 'Läufe (30 Tage)', value: '1.240', hint: '+18 % zu den 30 Tagen davor' },
      { label: 'Erfolgsquote (30 Tage)', value: '95,6 %', hint: '1.185 von 1.240 Läufen' },
    ]);
  });

  it('copes with an empty database', () => {
    expect(
      toCustomerStatCards({
        customers: 0,
        newThisMonth: 0,
        jobs: { total: 0, active: 0, finished: 0 },
        runs30d: 0,
        runsPrevious30d: 0,
        successRate30d: { successful: 0, finished: 0 },
      }),
    ).toEqual([
      { label: 'Projekte', value: '0', hint: 'noch keine Projekte' },
      { label: 'Jobs gesamt', value: '0', hint: '0 aktiv · 0 beendet' },
      { label: 'Läufe (30 Tage)', value: '0', hint: 'kein Vergleich' },
      { label: 'Erfolgsquote (30 Tage)', value: '–', hint: 'noch keine Läufe' },
    ]);
  });

  it('shows fewer runs with a minus sign', () => {
    const fewer = toCustomerStatCards({ ...stats, runs30d: 800, runsPrevious30d: 1_000 });
    expect(fewer[2]?.hint).toBe('−20 % zu den 30 Tagen davor');
  });
});
