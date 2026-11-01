import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Multi-line text, e.g. the description for "Mit KI beschreiben". Red with aria-invalid. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full resize-y rounded-input border border-border-strong bg-surface px-3.5 py-2.5 text-body text-text',
        'placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary-soft',
        'disabled:cursor-not-allowed disabled:bg-neutral-soft aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
