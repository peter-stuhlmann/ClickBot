import { CURVE_MAX, curveValue } from '@click-bot/shared';

/** How far a pull reaches into the hours around it (standard deviation, in hours). */
const REACH_HOURS = 1.3;
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Pulls the curve at `hour` towards `value`; the hours around follow less the farther they are
 * (a bell shape), so the curve stays smooth wherever it is grabbed.
 */
export function bendCurve(points: readonly number[], hour: number, value: number): number[] {
  const target = Math.min(CURVE_MAX, Math.max(0, value));
  const current = curveValue(points, hour);
  return points.map((point, index) => {
    const pull = Math.exp(-((index - hour) ** 2) / (2 * REACH_HOURS ** 2));
    const moved = point + (target - current) * pull;
    return round(Math.min(CURVE_MAX, Math.max(0, moved)));
  });
}

/** The value in words, as the scale of the curve editor names it. */
export function curveLabel(value: number): string {
  if (value <= 0.05) return 'nie';
  if (value < 0.75) return 'selten';
  if (value < 1.25) return 'normal';
  if (value < 1.75) return 'häufig';
  return 'hoch';
}

/** SVG path of the curve in a `width` × `height` box: 0 o'clock left, „hoch“ at the top. */
export function curvePath(points: readonly number[], width: number, height: number): string {
  const steps = 96;
  return Array.from({ length: steps + 1 }, (_, step) => {
    const hour = (step / steps) * 24;
    const x = round((hour / 24) * width);
    const y = round(height - (curveValue(points, hour) / CURVE_MAX) * height);
    return `${step === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
}

/** A quarter hour of the day (0–95) as "14:15–14:30 Uhr". */
export function quarterLabel(quarter: number): string {
  const time = (minutes: number) =>
    `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  return `${time(quarter * 15)}–${time(quarter * 15 + 15)} Uhr`;
}

/** How many runs start in a quarter hour: "Kein Durchlauf", "1 Durchlauf", "3 Durchläufe". */
export function runsText(count: number): string {
  if (count === 0) return 'Kein Durchlauf';
  return `${count} ${count === 1 ? 'Durchlauf' : 'Durchläufe'}`;
}

/** One start of the preview: "10.11. um 14:22 Uhr". */
export function startText(start: { date: string; time: string }): string {
  const [, month, day] = start.date.split('-');
  return `${day}.${month}. um ${start.time} Uhr`;
}
