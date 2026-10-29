import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options: readonly SelectOption[];
  /** First, empty entry, e.g. "Projekt wählen". */
  placeholder?: string;
};

export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full rounded-input border border-border-strong bg-surface px-3 py-2.5 text-body text-text',
        'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft',
        'disabled:cursor-not-allowed disabled:bg-neutral-soft aria-invalid:border-danger',
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
