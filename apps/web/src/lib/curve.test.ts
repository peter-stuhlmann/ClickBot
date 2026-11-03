import { FLAT_CURVE } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { bendCurve, curveLabel, curvePath, quarterLabel, runsText, startText } from './curve';

describe('bendCurve', () => {
  it('pulls the curve to the value at the hour, and the hours nearby along, softly', () => {
    const bent = bendCurve(FLAT_CURVE, 12, 2);
    expect(bent[12]).toBe(2);
    expect(bent[11]).toBeGreaterThan(1);
    expect(bent[11]).toBeLessThan(2);
    expect(bent[13]).toBe(bent[11]);
    // Far away nothing moves.
    expect(bent[3]).toBe(1);
    expect(bent[21]).toBe(1);
  });

  it('keeps the points between „nie“ and „hoch“, in steps of a hundredth', () => {
    const bent = bendCurve(bendCurve(FLAT_CURVE, 6, -5), 18, 9);
    expect(bent[6]).toBe(0);
    expect(bent[18]).toBe(2);
    for (const point of bent) expect(Math.round(point * 100) / 100).toBe(point);
  });

  it('works between full hours too', () => {
    const bent = bendCurve(FLAT_CURVE, 6.5, 0);
    expect(bent[6]).toBe(bent[7]);
    expect(bent[6]).toBeLessThan(1);
  });
});

describe('curveLabel', () => {
  it.each([
    [0, 'nie'],
    [0.4, 'selten'],
    [1, 'normal'],
    [1.5, 'häufig'],
    [2, 'hoch'],
  ])('names %d as %s', (value, label) => {
    expect(curveLabel(value)).toBe(label);
  });
});

describe('curvePath', () => {
  it('draws a flat curve in the middle of the box, from 0 to 24 o’clock', () => {
    const path = curvePath(FLAT_CURVE, 240, 100);
    expect(path.startsWith('M0,50')).toBe(true);
    expect(path.endsWith('L240,50')).toBe(true);
  });
});

describe('quarterLabel', () => {
  it('names the quarter hour with its start and end', () => {
    expect(quarterLabel(0)).toBe('0:00–0:15 Uhr');
    expect(quarterLabel(57)).toBe('14:15–14:30 Uhr');
    expect(quarterLabel(95)).toBe('23:45–24:00 Uhr');
  });
});

describe('runsText', () => {
  it('counts whole runs, with the singular only for exactly one', () => {
    expect(runsText(0)).toBe('Kein Durchlauf');
    expect(runsText(1)).toBe('1 Durchlauf');
    expect(runsText(3)).toBe('3 Durchläufe');
  });
});

describe('startText', () => {
  it('writes a start with day, month and time', () => {
    expect(startText({ date: '2026-11-10', time: '14:22' })).toBe('10.11. um 14:22 Uhr');
  });
});
