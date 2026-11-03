'use client';

import {
  CURVE_MAX,
  CURVE_POINTS,
  curveValue,
  QUARTERS_PER_DAY,
  type PlannedStart,
} from '@click-bot/shared';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { bendCurve, curveLabel, curvePath, quarterLabel, runsText, startText } from '@/lib/curve';

export type CurveEditorProps = {
  /** Names the curve for screen readers, e.g. "Verteilung am Montag". */
  label: string;
  /** 25 points from 0 to 24 o'clock; 0 never, 1 normal, CURVE_MAX twice as often. */
  points: readonly number[];
  onChange: (points: number[]) => void;
  /**
   * The starts planned on this day of the week, sorted into the 96 quarter hours of the day. With
   * it, hovering the curve lists the starts of the quarter hour under the pointer.
   */
  plannedByQuarter?: readonly (readonly PlannedStart[])[];
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
export function CurveEditor({ label, points, onChange, plannedByQuarter }: CurveEditorProps) {
  const [hour, setHour] = useState(12);
  const [hovered, setHovered] = useState<number | null>(null);
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

  function hover(event: PointerEvent<SVGSVGElement>) {
    const point = at(event);
    if (point) setHovered(Math.min(QUARTERS_PER_DAY - 1, Math.floor((point.hour / 24) * 96)));
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
        <div className="relative min-w-0 flex-1">
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
              hover(event);
              if (dragging.current) bend(event);
            }}
            onPointerLeave={() => setHovered(null)}
            onPointerUp={(event) => {
              dragging.current = false;
              if (event.pointerType !== 'mouse') setHovered(null);
            }}
            onPointerCancel={() => {
              dragging.current = false;
              setHovered(null);
            }}
            className="h-40 w-full cursor-ns-resize touch-none rounded-input border border-border bg-subtle focus-visible:outline-2 focus-visible:outline-primary"
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
          {plannedByQuarter && hovered !== null ? (
            <CurveTooltip
              quarter={hovered}
              level={curveValue(points, (hovered + 0.5) / 4)}
              starts={plannedByQuarter[hovered] ?? []}
            />
          ) : null}
        </div>
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

/** Sits on the curve at the middle of the quarter hour, above it (below near the top). */
const LISTED = 3;

function CurveTooltip({
  quarter,
  level,
  starts,
}: {
  quarter: number;
  level: number;
  starts: readonly PlannedStart[];
}) {
  const left = ((quarter + 0.5) / QUARTERS_PER_DAY) * 100;
  const top = (1 - level / CURVE_MAX) * 100;
  const below = level > CURVE_MAX * 0.6;
  return (
    <>
      <span
        aria-hidden="true"
        style={{ left: `${left}%`, top: `${top}%` }}
        className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary"
      />
      <div
        role="tooltip"
        style={{ left: `${left}%`, top: `${top}%` }}
        className={cn(
          'pointer-events-none absolute z-10 rounded-input bg-text px-2 py-1 text-small whitespace-nowrap text-on-primary shadow-dialog',
          left < 15 ? 'translate-x-0' : left > 85 ? '-translate-x-full' : '-translate-x-1/2',
          below ? 'mt-3' : '-mt-3 -translate-y-full',
        )}
      >
        <span className="block font-medium">{quarterLabel(quarter)}</span>
        <span className="block">{runsText(starts.length)}</span>
        {starts.slice(0, LISTED).map((start, index) => (
          <span key={index} className="block text-border-strong">
            {startText(start)}
          </span>
        ))}
        {starts.length > LISTED ? (
          <span className="block text-border-strong">{`und ${starts.length - LISTED} weitere`}</span>
        ) : null}
      </div>
    </>
  );
}
