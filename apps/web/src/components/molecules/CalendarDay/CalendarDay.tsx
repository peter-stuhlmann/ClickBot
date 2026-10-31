import { cva } from 'class-variance-authority';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { CalendarDayView } from '@/lib/views';

export type CalendarDayProps = CalendarDayView;

const entry = cva(
  'inline-block max-w-full rounded-chip px-2 py-1 text-small break-words transition-colors focus-visible:outline-2 focus-visible:outline-primary',
  {
    variants: {
      over: {
        false: 'bg-neutral-soft text-text-muted hover:text-text',
        true: 'bg-warning-chip text-warning',
      },
    },
  },
);

/**
 * One day of the week calendar: its waves as small links to their jobs. The date shows the load
 * of the day below the calendar. In a wide calendar (container `@4xl`) the day is a column.
 */
export function CalendarDay({ label, href, selected, today, entries }: CalendarDayProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        'flex flex-col gap-1.5 rounded-input bg-subtle p-3 @4xl:min-h-64',
        selected && 'ring-1 ring-primary',
      )}
    >
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${label}${today ? ' (heute)' : ''}: Auslastung zeigen`}
        className={cn(
          'self-start rounded-chip text-small font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary',
          today ? 'text-primary' : 'text-text',
        )}
      >
        {label}
      </Link>
      {entries.length === 0 ? (
        <p className="text-small text-text-muted">keine Termine</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 @4xl:flex-col @4xl:items-start">
          {entries.map((item) => (
            <li key={item.key} className="max-w-full">
              <Link
                href={item.href}
                aria-label={`${item.time} ${item.name}, ${item.runs === 1 ? '1 Durchlauf' : `${item.runs} Durchläufe`}${item.over ? ', Limit überschritten' : ''}`}
                className={entry({ over: item.over })}
              >
                <span className="tabular-nums">{item.time}</span> {item.name}
                {item.runs > 1 && ` ×${item.runs}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
