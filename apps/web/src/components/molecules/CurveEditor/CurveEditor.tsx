'use client';

import { CURVE_MAX, CURVE_POINTS } from '@click-bot/shared';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { bendCurve, curveLabel, curvePath } from '@/lib/curve';

export type CurveEditorProps = {
  /** Names the curve for screen readers, e.g. "Verteilung am Montag". */
  label: string;
  /** 25 points from 0 to 24 o'clock; 0 never, 1 normal, CURVE_MAX twice as often. */
  points: readonly number[];
  onChange: (points: number[]) => void;
};

// The drawing box; the SVG stretches it to its width.
const WIDTH = 240;
const HEIGHT = 100;
const STEP = 0.1;
const TICKS = [0, 6, 12, 18, 24];

/**
 * How often something happens over a day, as a smooth curve: dragged with the mouse or a finger
 * wherever it should be higher or lower. With the keyboard, left and right pick the hour, up and
 * down make it more or less frequent.
 */
export function CurveEditor({ label, points, onChange }: CurveEditorProps) {
  const [hour, setHour] = useState(12);
  const dragging = useRef(false);
  const hintId = useId();
  const value = points[hour] ?? 1;
  const path = curvePath(points, WIDTH, HEIGHT);

  function at(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    return { hour: x * 24, value: (1 - y) * CURVE_MAX };
  }

  function bend(event: PointerEvent<SVGSVGElement>) {
    const point = at(event);
    if (!point) return;
    setHour(Math.round(point.hour));
    onChange(bendCurve(points, point.hour, point.value));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => setHour(Math.max(0, hour - 1)),
      ArrowRight: () => setHour(Math.min(CURVE_POINTS - 1, hour + 1)),
      Home: () => setHour(0),
      End: () => setHour(CURVE_POINTS - 1),
      ArrowUp: () => onChange(bendCurve(points, hour, value + STEP)),
      ArrowDown: () => onChange(bendCurve(points, hour, value - STEP)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  }

  const x = (hour / 24) * WIDTH;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between py-0.5 text-right text-small text-text-muted"
        >
          <span>hoch</span>
          <span>normal</span>
          <span>nie</span>
        </div>
        <svg
          role="slider"
          aria-label={label}
          aria-describedby={hintId}
          aria-valuemin={0}
          aria-valuemax={CURVE_MAX}
          aria-valuenow={value}
          aria-valuetext={`${hour} Uhr: ${curveLabel(value)}`}
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            bend(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) bend(event);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          className="h-40 min-w-0 flex-1 cursor-ns-resize touch-none rounded-input border border-border bg-subtle focus-visible:outline-2 focus-visible:outline-primary"
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="4 4"
            className="stroke-border-strong"
          />
          <path d={`${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} className="fill-primary-soft" />
          <path
            d={path}
            fill="none"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="stroke-primary"
          />
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
            className="stroke-primary opacity-40"
          />
        </svg>
      </div>
      <div aria-hidden="true" className="ml-12 flex justify-between text-small text-text-muted">
        {TICKS.map((tick) => (
          <span key={tick}>{tick} Uhr</span>
        ))}
      </div>
      <p id={hintId} className="text-small text-text-muted">
        Ziehe die Kurve, wo mehr oder weniger los sein soll. Tastatur: links/rechts Uhrzeit,
        hoch/runter häufiger oder seltener.
      </p>
    </div>
  );
}
