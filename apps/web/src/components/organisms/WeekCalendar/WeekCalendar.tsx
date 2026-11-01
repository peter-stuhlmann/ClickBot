import { Card } from '@/components/atoms/Card';
import { CalendarDay } from '@/components/molecules/CalendarDay';
import type { CalendarDayView } from '@/lib/views';

export type WeekCalendarProps = {
  /** "KW 45 · 02.–08.11.2026" */
  title: string;
  days: CalendarDayView[];
};

function Legend() {
  return (
    <ul aria-label="Legende" className="flex flex-wrap gap-x-4 gap-y-1 text-small text-text-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-neutral-dot" />
        Welle
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-warning-dot" />
        Limit überschritten
      </li>
    </ul>
  );
}

/**
 * The seven days of a week side by side, as soon as the card is wide enough for them (container
 * `@4xl`); narrower, one below the other.
 */
export function WeekCalendar({ title, days }: WeekCalendarProps) {
  return (
    <Card title={title} aside={<Legend />}>
      <div className="@container">
        <div className="grid grid-cols-1 gap-2 @4xl:grid-cols-7">
          {days.map((day) => (
            <CalendarDay key={day.date} {...day} />
          ))}
        </div>
      </div>
    </Card>
  );
}
