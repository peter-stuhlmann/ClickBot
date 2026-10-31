import Link from 'next/link';
import { Icon } from '@/components/atoms/Icon';
import type { WeekNavView } from '@/lib/views';

export type WeekSwitcherProps = WeekNavView;

const part =
  'flex items-center px-3 py-2.5 text-body font-medium text-text transition-colors hover:bg-neutral-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

/** "‹ Diese Woche ›" above the calendar: one week back, back to this week, one week ahead. */
export function WeekSwitcher({ previousHref, currentHref, nextHref }: WeekSwitcherProps) {
  return (
    <nav
      aria-label="Woche wechseln"
      className="flex divide-x divide-border-strong overflow-hidden rounded-input border border-border-strong bg-surface"
    >
      <Link href={previousHref} aria-label="Vorherige Woche" className={part}>
        <Icon name="chevronLeft" size={16} />
      </Link>
      <Link href={currentHref} className={part}>
        Diese Woche
      </Link>
      <Link href={nextHref} aria-label="Nächste Woche" className={part}>
        <Icon name="chevronRight" size={16} />
      </Link>
    </nav>
  );
}
