import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pager } from './Pager';

describe('Pager', () => {
  it('links to newer and older entries', () => {
    render(<Pager label="Seite 2 von 3" previousHref="/laeufe" nextHref="/laeufe?seite=3" />);
    const nav = screen.getByRole('navigation', { name: 'Seiten' });
    expect(nav).toHaveTextContent('Seite 2 von 3');
    expect(screen.getByRole('link', { name: 'Neuere' })).toHaveAttribute('href', '/laeufe');
    expect(screen.getByRole('link', { name: 'Ältere' })).toHaveAttribute('href', '/laeufe?seite=3');
  });

  it('offers only the way that exists', () => {
    render(<Pager label="Seite 1 von 3" nextHref="/laeufe?seite=2" />);
    expect(screen.queryByRole('link', { name: 'Neuere' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ältere' })).toBeVisible();
  });

  it('is not shown for a single page', () => {
    const { container } = render(<Pager label="Seite 1 von 1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
