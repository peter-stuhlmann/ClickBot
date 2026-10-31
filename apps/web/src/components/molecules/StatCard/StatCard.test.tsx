import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('is a labelled region with value and hint', () => {
    render(<StatCard label="Durchläufe heute" value="42" hint="+8 gegenüber gestern" />);
    const card = screen.getByRole('region', { name: 'Durchläufe heute' });
    expect(within(card).getByText('42')).toBeInTheDocument();
    expect(within(card).getByText('+8 gegenüber gestern')).toBeInTheDocument();
  });

  it('uses the stat type token for the value', () => {
    render(<StatCard label="Aktive Tests" value="3" hint="1 Test beendet" />);
    expect(screen.getByText('3')).toHaveClass('text-stat');
  });
});
