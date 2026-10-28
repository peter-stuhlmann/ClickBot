import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  it('links the way back and marks the current page', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Jobs', href: '/' },
          { label: 'Kontaktformular-Test' },
          { label: 'Lauf #7', href: '/laeufe/7' },
        ]}
      />,
    );
    const nav = within(screen.getByRole('navigation', { name: 'Pfad' }));
    expect(nav.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/');
    expect(nav.queryByRole('link', { name: 'Kontaktformular-Test' })).not.toBeInTheDocument();
    // The current page is never a link, even with an href.
    expect(nav.queryByRole('link', { name: 'Lauf #7' })).not.toBeInTheDocument();
    expect(nav.getByText('Lauf #7')).toHaveAttribute('aria-current', 'page');
  });
});
