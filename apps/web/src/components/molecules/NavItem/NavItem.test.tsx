import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavItem } from './NavItem';

const linkStatus = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useLinkStatus: () => linkStatus,
}));

describe('NavItem', () => {
  it('links to its page', () => {
    render(<NavItem href="/kalender" label="Kalender" icon="calendar" />);
    expect(screen.getByRole('link', { name: 'Kalender' })).toHaveAttribute('href', '/kalender');
  });

  it('marks the current page for screen readers and visually', () => {
    render(<NavItem href="/" label="Tests" icon="bot" active />);
    const link = screen.getByRole('link', { name: 'Tests' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('bg-sidebar-active');
  });

  it('does not mark other pages', () => {
    render(<NavItem href="/laeufe" label="Durchläufe" icon="history" />);
    expect(screen.getByRole('link', { name: 'Durchläufe' })).not.toHaveAttribute('aria-current');
  });

  it('shows a spinner while its page loads, and none otherwise', () => {
    const { rerender } = render(<NavItem href="/laeufe" label="Durchläufe" icon="history" />);
    const spinner = () =>
      screen.getByRole('link', { name: 'Durchläufe' }).querySelector('.animate-spin');
    expect(spinner()).toBeNull();

    linkStatus.pending = true;
    rerender(<NavItem href="/laeufe" label="Durchläufe" icon="history" />);
    expect(spinner()).not.toBeNull();
    linkStatus.pending = false;
  });
});
