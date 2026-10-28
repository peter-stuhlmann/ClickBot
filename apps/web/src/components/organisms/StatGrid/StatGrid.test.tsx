import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatGrid } from './StatGrid';

describe('StatGrid', () => {
  it('renders one card per figure', () => {
    render(
      <StatGrid
        cards={[
          { label: 'Aktive Jobs', value: '3', hint: '1 Job beendet' },
          { label: 'Läufe heute', value: '42', hint: '+8 gegenüber gestern' },
        ]}
      />,
    );
    expect(screen.getAllByRole('region').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Aktive Jobs',
      'Läufe heute',
    ]);
  });
});
