import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const items = [
  { href: '/einstellungen/team', label: 'Team' },
  { href: '/einstellungen/ki', label: 'KI & API' },
];

describe('Tabs', () => {
  it('links the pages and marks the open one', () => {
    render(<Tabs label="Einstellungen" items={items} current="/einstellungen/ki" />);
    const nav = within(screen.getByRole('navigation', { name: 'Einstellungen' }));

    expect(nav.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/einstellungen/team');
    expect(nav.getByRole('link', { name: 'Team' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: 'KI & API' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'KI & API' })).toHaveClass('bg-surface');
  });
});
