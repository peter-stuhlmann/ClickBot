import type { ReactNode } from 'react';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

export type AccordionItemProps = {
  /** Unique on the page; ids of title, button and panel derive from it. */
  id: string;
  title: string;
  description?: ReactNode;
  /** Beside the title, e.g. a status badge. */
  aside?: ReactNode;
  open: boolean;
  /** The parent decides what opens, e.g. only one item at a time. */
  onToggle: () => void;
  children: ReactNode;
};

/**
 * A card whose header opens and closes its content. The content grows and shrinks smoothly
 * (grid rows from 0fr to 1fr) and stays mounted, so typed values survive closing; while closed it
 * is inert, so Tab and screen readers skip it.
 */
export function AccordionItem({
  id,
  title,
  description,
  aside,
  open,
  onToggle,
  children,
}: AccordionItemProps) {
  const titleId = `${id}-title`;
  const panelId = `${id}-panel`;
  const describedBy = [description && `${id}-description`, aside && `${id}-aside`]
    .filter(Boolean)
    .join(' ');
  return (
    <section aria-labelledby={titleId} className="rounded-card border border-border bg-surface">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-labelledby={titleId}
          aria-describedby={describedBy || undefined}
          onClick={onToggle}
          className="flex w-full items-start gap-3 rounded-card p-4 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary sm:p-5"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span id={titleId} className="text-card font-semibold text-text">
              {title}
            </span>
            {description && (
              <span id={`${id}-description`} className="text-meta font-normal text-text-muted">
                {description}
              </span>
            )}
          </span>
          {aside && (
            <span id={`${id}-aside`} className="shrink-0">
              {aside}
            </span>
          )}
          <Icon
            name="chevronDown"
            size={18}
            className={cn(
              'mt-0.5 shrink-0 text-text-muted transition-transform duration-300 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <div
        id={panelId}
        inert={!open}
        className={cn(
          'grid transition-all duration-300 ease-out motion-reduce:transition-none',
          // Hidden only once closing has run: visibility switches at the end of the transition.
          open
            ? 'visible grid-rows-expanded opacity-100'
            : 'invisible grid-rows-collapsed opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}
