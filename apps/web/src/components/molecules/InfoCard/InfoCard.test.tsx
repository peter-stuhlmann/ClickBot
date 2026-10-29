import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoCard } from './InfoCard';

describe('InfoCard', () => {
  it('lists the facts under its title', () => {
    render(
      <InfoCard
        title="Sicherheit"
        items={[
          { title: 'Verschlüsselt gespeichert', text: 'AES-256.' },
          { title: 'Nur für Admins', text: 'Andere sehen nur den Status.' },
        ]}
      />,
    );
    const card = within(screen.getByRole('region', { name: 'Sicherheit' }));
    expect(card.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Verschlüsselt gespeichertAES-256.',
      'Nur für AdminsAndere sehen nur den Status.',
    ]);
  });
});
