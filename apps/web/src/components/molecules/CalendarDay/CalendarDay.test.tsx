import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CalendarDayView } from '@/lib/views';
import { CalendarDay } from './CalendarDay';

const day = (overrides: Partial<CalendarDayView> = {}): CalendarDayView => ({
  date: '2026-11-05',
  label: 'Do 05.11.',
  href: '/kalender?woche=2026-11-02&tag=2026-11-05',
  selected: false,
  today: false,
  entries: [
    {
      key: 'a',
      time: '13:24',
      name: 'Kontakt',
      runs: 1,
      over: false,
      href: '/jobs/a',
    },
    {
      key: 'b',
      time: '13:38',
      name: 'Newsletter',
      runs: 6,
      over: true,
      href: '/jobs/b',
    },
  ],
  ...overrides,
});

describe('CalendarDay', () => {
  it('links each wave to its job, naming time, job and runs', () => {
    render(<CalendarDay {...day()} />);
    const region = screen.getByRole('region', { name: 'Do 05.11.' });
    const links = within(region).getAllByRole('listitem');
    expect(links).toHaveLength(2);
    expect(screen.getByRole('link', { name: '13:24 Kontakt, 1 Lauf' })).toHaveAttribute(
      'href',
      '/jobs/a',
    );
    const busy = screen.getByRole('link', {
      name: '13:38 Newsletter, 6 Läufe, Limit überschritten',
    });
    expect(busy).toHaveTextContent('×6');
  });

  it('shows the load of the day through its date, and marks the chosen day and today', () => {
    const { rerender } = render(<CalendarDay {...day()} />);
    const date = screen.getByRole('link', { name: 'Do 05.11.: Auslastung zeigen' });
    expect(date).toHaveAttribute('href', '/kalender?woche=2026-11-02&tag=2026-11-05');
    expect(date).not.toHaveAttribute('aria-current');

    rerender(<CalendarDay {...day({ selected: true, today: true })} />);
    expect(
      screen.getByRole('link', { name: 'Do 05.11. (heute): Auslastung zeigen' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('says when a day has nothing planned', () => {
    render(<CalendarDay {...day({ entries: [] })} />);
    expect(screen.getByText('keine Termine')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
