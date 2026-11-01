import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type InputProps = ComponentProps<'input'> & {
  /** Roboto Mono, for URLs, selectors and variables like {{faker.email}}. */
  mono?: boolean;
};

/** Text-like input. Turns red when aria-invalid is set (see Field). */
export function Input({ mono = false, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-input border border-border-strong bg-surface px-3.5 py-2.5 text-body text-text',
        'placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft',
        'disabled:cursor-not-allowed disabled:bg-neutral-soft aria-invalid:border-danger',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  );
}
