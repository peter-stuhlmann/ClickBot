import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

/** Checkbox with its label; clicking the text toggles it too. */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-body text-text', className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-primary"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
