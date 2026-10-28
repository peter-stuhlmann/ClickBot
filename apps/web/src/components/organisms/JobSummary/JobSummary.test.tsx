import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JobSummary } from './JobSummary';

describe('JobSummary', () => {
  it('lists every row and the note', () => {
    render(
      <JobSummary
        rows={[
          { label: 'Kunde', value: 'Beispiel GmbH' },
          { label: 'Zeitplan', value: '–' },
        ]}
        note="Gespeichert wird erst am Ende."
      />,
    );
    const card = within(screen.getByRole('region', { name: 'Zusammenfassung' }));
    expect(card.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Kunde',
      'Zeitplan',
    ]);
    expect(card.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      'Beispiel GmbH',
      '–',
    ]);
    expect(screen.getByText('Gespeichert wird erst am Ende.')).toBeInTheDocument();
  });
});
