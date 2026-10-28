import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'role'> & {
  checked: boolean;
  /** Accessible name, e.g. "Kontaktformular-Test pausieren". */
  label: string;
  /** "submit" lets the toggle send a surrounding form (server action) without JavaScript. */
  type?: 'button' | 'submit';
};

export function Toggle({ checked, label, type = 'button', className, ...props }: ToggleProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-border-strong',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-4 rounded-full bg-surface transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
