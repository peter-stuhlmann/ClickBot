import Link from 'next/link';
import { cn } from '@/lib/cn';

export type TabItem = { href: string; label: string };

export type TabsProps = {
  /** Accessible name of the navigation, e.g. "Einstellungen". */
  label: string;
  items: readonly TabItem[];
  /** href of the page that is open. */
  current: string;
};

/** Pages of one area side by side, e.g. the tabs of "Einstellungen" (Figma "Modus-Tabs"). */
export function Tabs({ label, items, current }: TabsProps) {
  return (
    <nav aria-label={label}>
      <ul className="flex w-fit gap-0.5 rounded-input bg-neutral-soft p-0.75">
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-chip px-2.5 py-1.5 text-meta font-medium',
                  'focus-visible:outline-2 focus-visible:outline-primary',
                  active ? 'bg-surface text-text shadow-tab' : 'text-text-muted hover:text-text',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
