import { describe, expect, it } from 'vitest';
import { describeSchedule, displayUrl, formatPercent, formatRelative } from './format';

describe('formatPercent', () => {
  it.each([
    [0.952, '95,2 %'],
    [1, '100 %'],
    [17 / 18, '94,4 %'],
    [0, '0 %'],
  ])('formats %f as %s', (rate, text) => {
    expect(formatPercent(rate)).toBe(text);
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-05T12:30:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it.each([
    [20_000, 'gerade eben'],
    [3 * 60_000, 'vor 3 Min.'],
    [59 * 60_000, 'vor 59 Min.'],
    [2 * 3_600_000, 'vor 2 Std.'],
    [23 * 3_600_000, 'vor 23 Std.'],
    [26 * 3_600_000, 'vor 1 Tag'],
    [5 * 86_400_000, 'vor 5 Tagen'],
  ])('describes %i ms ago as %s', (ms, text) => {
    expect(formatRelative(ago(ms), now)).toBe(text);
  });

  it('describes future times', () => {
    expect(formatRelative(new Date(now.getTime() + 14 * 60_000), now)).toBe('in 14 Min.');
  });
});

describe('displayUrl', () => {
  it.each([
    ['https://beispiel.de/kontakt', 'beispiel.de/kontakt'],
    ['https://shop.beispiel.de/', 'shop.beispiel.de'],
    ['http://localhost:3000/a?b=1', 'localhost:3000/a?b=1'],
    ['kein url', 'kein url'],
  ])('shortens %s to %s', (url, text) => {
    expect(displayUrl(url)).toBe(text);
  });
});

describe('describeSchedule', () => {
  const interval = (everyMinutes: number, maxRuns: number) => ({
    type: 'interval' as const,
    everyMinutes,
    maxRuns,
    startAt: '2026-11-05T10:00:00Z',
  });

  it.each([
    [15, 20, 'alle 15 Min.', 'max. 20 Läufe'],
    [60, 24, 'alle 60 Min.', 'max. 24 Läufe'],
    [120, 10, 'alle 2 Std.', 'max. 10 Läufe'],
    [90, 1, 'alle 90 Min.', 'max. 1 Lauf'],
  ])('describes every %i min, %i runs', (every, max, primary, secondary) => {
    expect(describeSchedule(interval(every, max))).toEqual({ primary, secondary });
  });

  it('describes a schedule by dates with its number of bots', () => {
    expect(
      describeSchedule({
        type: 'times',
        slots: [
          { date: '2026-11-05', time: '13:24', bots: 3 },
          { date: '2026-11-05', time: '13:38', bots: 6 },
          { date: '2026-11-06', time: '14:00', bots: 1 },
        ],
        staggerSeconds: 5,
        timezone: 'Europe/Berlin',
      }),
    ).toEqual({ primary: '3 Termine', secondary: '10 Bots' });
  });

  it('uses the singular for one slot with one bot', () => {
    expect(
      describeSchedule({
        type: 'times',
        slots: [{ date: '2026-11-05', time: '13:24', bots: 1 }],
        staggerSeconds: 5,
        timezone: 'Europe/Berlin',
      }),
    ).toEqual({ primary: '1 Termin', secondary: '1 Bot' });
  });
});
