import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import type { Tone } from '@/lib/views';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full py-0.75 pr-2.5 pl-2 text-small font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        neutral: 'bg-neutral-soft text-text-muted',
      },
    },
  },
);

const dot = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      success: 'bg-success-dot',
      warning: 'bg-warning-dot',
      danger: 'bg-danger-dot',
      neutral: 'bg-neutral-dot',
    },
  },
});

export type BadgeProps = { tone: Tone; children: ReactNode };

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className={badge({ tone })}>
      <span aria-hidden="true" data-testid="badge-dot" className={dot({ tone })} />
      {children}
    </span>
  );
}
