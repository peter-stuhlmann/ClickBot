import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  describeDay,
  earliestEnd,
  endAfterNewStart,
  endOfWeek,
  formatGermanDate,
  isIsoDate,
  monthGrid,
  monthLabel,
  parseGermanDate,
  startOfWeek,
  todayIn,
} from './calendar';

describe('parseGermanDate', () => {
  it.each([
    ['20.11.2026', '2026-11-20'],
    ['1.2.2027', '2027-02-01'],
    [' 05.03.26 ', '2026-03-05'],
    ['2026-11-20', '2026-11-20'],
    ['29.02.2028', '2028-02-29'],
  ])('reads %j as %s', (text, iso) => {
    expect(parseGermanDate(text)).toBe(iso);
  });

  it.each([
    ['31.11.2026'],
    ['29.02.2027'],
    ['20.13.2026'],
    ['0.1.2026'],
    ['2026-02-30'],
    ['20.11.'],
    ['morgen'],
    [''],
  ])('refuses %j, which is no day', (text) => {
    expect(parseGermanDate(text)).toBeNull();
  });
});

describe('formatGermanDate', () => {
  it('writes a stored date the German way', () => {
    expect(formatGermanDate('2026-03-05')).toBe('05.03.2026');
  });

  it('leaves anything else as it is, so a typo stays visible', () => {
    expect(formatGermanDate('31.11.2026')).toBe('31.11.2026');
    expect(formatGermanDate('')).toBe('');
  });
});

describe('isIsoDate', () => {
  it('accepts only real days in the stored form', () => {
    expect(isIsoDate('2026-11-20')).toBe(true);
    expect(isIsoDate('2026-11-31')).toBe(false);
    expect(isIsoDate('20.11.2026')).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('moves by days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('moves by months and keeps the day where the month is long enough', () => {
    expect(addMonths('2026-11-20', 1)).toBe('2026-12-20');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -12)).toBe('2025-01-15');
  });

  it('knows Monday and Sunday of a week (German weeks start on Monday)', () => {
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(endOfWeek('2026-11-16')).toBe('2026-11-22');
  });
});

describe('monthGrid', () => {
  it('fills six weeks from Monday, with the days of the neighbouring months', () => {
    const weeks = monthGrid('2026-11-20');
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // 1 November 2026 is a Sunday.
    expect(weeks[0]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(weeks[5]?.at(-1)).toBe('2026-12-06');
  });
});

describe('labels', () => {
  it('names the month and the day in German', () => {
    expect(monthLabel('2026-11-20')).toBe('November 2026');
    expect(describeDay('2026-11-20')).toBe('Freitag, 20. November 2026');
  });

  it('knows today in German time, also shortly after midnight there', () => {
    expect(todayIn(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-20');
  });
});

describe('periods', () => {
  it('lets the end start at the start, once the start is a day', () => {
    expect(earliestEnd('2026-11-20')).toBe('2026-11-20');
    expect(earliestEnd('')).toBeUndefined();
    expect(earliestEnd('31.11.2026')).toBeUndefined();
  });

  it('clears an end that lies before a newly chosen start, and keeps one that fits', () => {
    expect(endAfterNewStart('2026-11-20', '2026-11-19')).toBe('');
    expect(endAfterNewStart('2026-11-20', '2026-11-20')).toBe('2026-11-20');
    expect(endAfterNewStart('2026-11-20', '2026-12-01')).toBe('2026-12-01');
    expect(endAfterNewStart('2026-11-20', '')).toBe('');
  });
});
