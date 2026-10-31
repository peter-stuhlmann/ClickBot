import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeekSwitcher } from './WeekSwitcher';

describe('WeekSwitcher', () => {
  it('links the week before, this week and the week after', () => {
    render(
      <WeekSwitcher
        previousHref="/kalender?woche=2026-10-26"
        currentHref="/kalender"
        nextHref="/kalender?woche=2026-11-09"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Woche wechseln' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vorherige Woche' })).toHaveAttribute(
      'href',
      '/kalender?woche=2026-10-26',
    );
    expect(screen.getByRole('link', { name: 'Diese Woche' })).toHaveAttribute('href', '/kalender');
    expect(screen.getByRole('link', { name: 'Nächste Woche' })).toHaveAttribute(
      'href',
      '/kalender?woche=2026-11-09',
    );
  });
});
