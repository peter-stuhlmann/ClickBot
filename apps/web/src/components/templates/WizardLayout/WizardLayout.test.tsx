import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WizardLayout } from './WizardLayout';

describe('WizardLayout', () => {
  it('puts title, step, actions, form and summary in place', () => {
    render(
      <WizardLayout
        title="Neuer Job"
        subtitle="Schritt 1 von 4 · Welche Website soll getestet werden?"
        actions={<button type="button">Weiter</button>}
        stepper={<nav aria-label="Schritte" />}
        aside={<p>Kunde: –</p>}
      >
        <form aria-label="Website" />
      </WizardLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Neuer Job' })).toBeVisible();
    expect(screen.getByText(/Schritt 1 von 4/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Schritte' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Website' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Zusammenfassung' })).toHaveTextContent(
      'Kunde: –',
    );
  });
});
