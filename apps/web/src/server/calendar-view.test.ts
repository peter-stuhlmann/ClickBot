// @vitest-environment node
import type { CalendarJob } from '@click-bot/db';
import { describe, expect, it } from 'vitest';
import { browserLimit, toCalendarView } from './calendar-view';

const PROJECT = 'projekt-1';
const now = new Date('2026-11-04T08:00:00Z');

const job = (
  id: string,
  slots: { date: string; time: string; bots: number }[],
  overrides: Partial<CalendarJob> = {},
): CalendarJob => ({
  id,
  name: id,
  customerId: PROJECT,
  customerName: 'Beispiel GmbH',
  schedule: { type: 'times', slots, staggerSeconds: 0, timezone: 'Europe/Berlin' },
  devices: ['desktop'],
  deviceBrowsers: { desktop: ['chromium'] },
  typicalRunMs: 60_000,
  ...overrides,
});

const jobs = [
  job('Login', [{ date: '2026-11-03', time: '14:00', bots: 2 }]),
  job('Kontakt', [{ date: '2026-11-05', time: '13:38', bots: 6 }]),
  job('Newsletter', [{ date: '2026-11-05', time: '13:38', bots: 6 }]),
  job('Fremd', [{ date: '2026-11-06', time: '09:00', bots: 1 }], {
    customerId: 'projekt-2',
    customerName: 'Müller Shop',
  }),
];

const view = (options: { selected?: string; project?: string | null } = {}) =>
  toCalendarView(jobs, {
    monday: '2026-11-02',
    selected: options.selected,
    now,
    limit: 6,
    project: options.project === undefined ? PROJECT : options.project,
  });

describe('toCalendarView', () => {
  it('shows the week with seven days and the entries of the current project only', () => {
    const { title, days } = view();
    expect(title).toBe('KW 45 · 02.–08.11.2026');
    expect(days.map((day) => day.label)).toEqual([
      'Mo 02.11.',
      'Di 03.11.',
      'Mi 04.11.',
      'Do 05.11.',
      'Fr 06.11.',
      'Sa 07.11.',
      'So 08.11.',
    ]);
    expect(days[1]?.entries).toEqual([
      {
        key: 'Login-14:00',
        time: '14:00',
        name: 'Login',
        runs: 2,
        over: false,
        href: '/jobs/Login',
      },
    ]);
    expect(days[3]?.entries.map((entry) => [entry.name, entry.over])).toEqual([
      ['Kontakt', true],
      ['Newsletter', true],
    ]);
    expect(days[4]?.entries).toEqual([]);
    expect(days[2]?.today).toBe(true);
    expect(days[1]?.href).toBe('/kalender?woche=2026-11-02&tag=2026-11-03');
  });

  it('opens the load of the first day with an overload', () => {
    const { days, load } = view();
    expect(days.filter((day) => day.selected).map((day) => day.date)).toEqual(['2026-11-05']);
    expect(load.title).toBe('Auslastung Do, 05.11.');
    expect(load.summary).toBeNull();
    expect(load.overloads).toEqual([
      {
        key: '2026-11-05T12:38:00.000Z',
        title: '13:38 Uhr: 12 Durchläufe für 6 Browser',
        text: expect.stringContaining('„Kontakt“ (6 Durchläufe) und „Newsletter“ (6 Durchläufe)'),
        suggestion: {
          title: 'Vorschlag: „Newsletter“ auf 13:39 verschieben',
          text: 'Dann laufen höchstens 6 von 6 Browsern gleichzeitig, und alle Durchläufe starten pünktlich.',
          fields: {
            jobId: 'Newsletter',
            slotIndex: '0',
            fromDate: '2026-11-05',
            fromTime: '13:38',
            toDate: '2026-11-05',
            toTime: '13:39',
          },
        },
      },
    ]);
    expect(load.note).toContain('6 Browser');
  });

  it('shows the chosen day, and how busy it gets without overloads', () => {
    expect(view({ selected: '2026-11-03' }).load).toMatchObject({
      title: 'Auslastung Di, 03.11.',
      overloads: [],
      summary: 'Keine Engpässe: höchstens 2 von 6 Browsern gleichzeitig belegt.',
    });
    // Jobs of other projects take browsers too.
    expect(view({ selected: '2026-11-06' }).load.summary).toBe(
      'Keine Engpässe: höchstens 1 von 6 Browsern gleichzeitig belegt.',
    );
    expect(view({ selected: '2026-11-07' }).load.summary).toBe('An diesem Tag läuft nichts.');
  });

  it('opens today without overloads, and Monday in other weeks; ignores days of other weeks', () => {
    const quiet = (selected?: string, monday = '2026-11-02') =>
      toCalendarView([jobs[0] as CalendarJob], {
        monday,
        selected,
        now,
        limit: 6,
        project: PROJECT,
      });
    expect(quiet().load.title).toBe('Auslastung Mi, 04.11.');
    expect(quiet('2026-11-20').load.title).toBe('Auslastung Mi, 04.11.');
    expect(quiet(undefined, '2026-11-09').load.title).toBe('Auslastung Mo, 09.11.');
  });

  it('offers no suggestion for jobs of other projects and links the weeks around', () => {
    const { load, nav } = view({ project: null });
    expect(load.overloads[0]?.suggestion).toBeNull();
    expect(nav).toEqual({
      previousHref: '/kalender?woche=2026-10-26',
      currentHref: '/kalender',
      nextHref: '/kalender?woche=2026-11-09',
    });
  });
});

describe('browserLimit', () => {
  it('takes what the worker reported, else its configuration, else 6', () => {
    expect(browserLimit(4, '8')).toBe(4);
    expect(browserLimit(null, '8')).toBe(8);
    expect(browserLimit(null, undefined)).toBe(6);
    expect(browserLimit(null, 'viele')).toBe(6);
    expect(browserLimit(null, '0')).toBe(6);
  });
});
