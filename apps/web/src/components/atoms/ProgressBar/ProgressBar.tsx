export type ProgressBarProps = {
  /** Share done, 0–1. Values outside are clamped. */
  value: number;
  /** Accessible name, e.g. "Fortschritt Kontaktformular-Test". */
  label: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-40 overflow-hidden rounded-full bg-divider"
    >
      {/* The width is the only truly dynamic value, so it is set inline. */}
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
