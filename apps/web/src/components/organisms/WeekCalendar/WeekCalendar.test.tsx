import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CalendarDayView } from '@/lib/views';
import { WeekCalendar } from './WeekCalendar';

const days: CalendarDayView[] = ['Mo 02.11.', 'Di 03.11.'].map((label, index) => ({
  date: `2026-11-0${index + 2}`,
  label,
  href: `/kalender?tag=${index}`,
  selected: index === 1,
  today: false,
  entries:
    index === 0
      ? [{ key: 'a', time: '09:00', name: 'Preis-Check', runs: 1, over: false, href: '/jobs/a' }]
      : [],
}));

describe('WeekCalendar', () => {
  it('shows the week with its days and explains the colours', () => {
    render(<WeekCalendar title="KW 45 · 02.–08.11.2026" days={days} />);
    const week = screen.getByRole('region', { name: 'KW 45 · 02.–08.11.2026' });
    expect(within(week).getByRole('region', { name: 'Mo 02.11.' })).toHaveTextContent(
      '09:00 Preis-Check',
    );
    expect(within(week).getByRole('region', { name: 'Di 03.11.' })).toHaveTextContent(
      'keine Termine',
    );
    const legend = within(week).getByRole('list', { name: 'Legende' });
    expect(legend).toHaveTextContent('Welle');
    expect(legend).toHaveTextContent('Limit überschritten');
  });
});
