import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('is a region named by its title, with description and content', () => {
    render(
      <Card title="Zusammenfassung" description="Noch nicht gespeichert" aside={<span>3</span>}>
        <p>Inhalt</p>
      </Card>,
    );
    const region = screen.getByRole('region', { name: 'Zusammenfassung' });
    expect(region).toHaveTextContent('Noch nicht gespeichert');
    expect(region).toHaveTextContent('Inhalt');
    expect(region).toHaveTextContent('3');
    expect(screen.getByRole('heading', { level: 2, name: 'Zusammenfassung' })).toBeVisible();
  });

  it('renders without heading when it has no title', () => {
    render(<Card>Nur Inhalt</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Nur Inhalt')).toBeInTheDocument();
  });
});
