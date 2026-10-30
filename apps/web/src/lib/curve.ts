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
