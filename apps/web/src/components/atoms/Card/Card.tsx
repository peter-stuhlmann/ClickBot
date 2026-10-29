import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = {
  title?: string;
  description?: ReactNode;
  /** Content to the right of the title, e.g. a step count. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** White panel with border and an optional heading; named by its title for screen readers. */
export function Card({ title, description, aside, children, className }: CardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        'flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5',
        className,
      )}
    >
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 id={titleId} className="text-card font-semibold text-text">
              {title}
            </h2>
            {description && <p className="text-meta text-text-muted">{description}</p>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}
