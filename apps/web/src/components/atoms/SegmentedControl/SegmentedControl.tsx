'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export type SegmentedControlProps<T extends string> = {
  /** Accessible name of the group, e.g. "Zeitplan". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Shows the choice but does not allow changing it. */
  disabled?: boolean;
};

const ARROW_DELTA: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Mutually exclusive options side by side, e.g. "Intervall | Termine". */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  // Radio group keyboard pattern: arrow keys move the choice, Tab leaves the group.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = ARROW_DELTA[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    onChange((options[nextIndex] as { value: T }).value);
    event.currentTarget.parentElement?.querySelectorAll('button')[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-input bg-neutral-soft p-1"
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex-1 rounded-chip px-3 py-1.5 text-body transition-colors',
              'focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed',
              checked
                ? 'bg-surface font-medium text-text shadow-tab'
                : 'text-text-muted hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
