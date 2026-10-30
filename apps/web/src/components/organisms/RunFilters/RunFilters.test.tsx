import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunFilters } from './RunFilters';

const props = {
  values: { kampagne: 'c2', ergebnis: 'fehlgeschlagen', zeitraum: '24h', geraet: '' },
  campaigns: [
    { value: 'c1', label: 'Beispiel GmbH' },
    { value: 'c2', label: 'Müller Shop' },
  ],
  results: [{ value: 'fehlgeschlagen', label: 'Fehlgeschlagen' }],
  periods: [
    { value: '24h', label: 'Letzte 24 Stunden' },
    { value: '7d', label: 'Letzte 7 Tage' },
  ],
  devices: [{ value: 'desktop', label: 'Desktop' }],
};

describe('RunFilters', () => {
  it('is a GET form for the run list, so the filters end up in the address', () => {
    render(<RunFilters {...props} />);
    const form = screen.getByRole('form', { name: 'Läufe filtern' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/laeufe');
    expect(Object.fromEntries(new FormData(form as HTMLFormElement))).toEqual({
      kampagne: 'c2',
      ergebnis: 'fehlgeschlagen',
      zeitraum: '24h',
      geraet: '',
    });
  });

  it('shows the current filters', () => {
    render(<RunFilters {...props} />);
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toHaveTextContent('Müller Shop');
    expect(screen.getByRole('combobox', { name: 'Ergebnis' })).toHaveTextContent('Fehlgeschlagen');
    expect(screen.getByRole('combobox', { name: 'Zeitraum' })).toHaveTextContent(
      'Letzte 24 Stunden',
    );
    expect(screen.getByRole('combobox', { name: 'Gerät' })).toHaveTextContent('Alle Geräte');
  });

  it('applies and resets the filters', () => {
    render(<RunFilters {...props} />);
    expect(screen.getByRole('button', { name: 'Filter anwenden' })).toHaveAttribute(
      'type',
      'submit',
    );
    expect(screen.getByRole('link', { name: 'Filter zurücksetzen' })).toHaveAttribute(
      'href',
      '/laeufe',
    );
  });

  it('shows new filters after a navigation within the app, e.g. "Filter zurücksetzen"', () => {
    const { rerender } = render(<RunFilters {...props} />);
    rerender(
      <RunFilters {...props} values={{ kampagne: '', ergebnis: '', zeitraum: '7d', geraet: '' }} />,
    );
    expect(screen.getByRole('combobox', { name: 'Kampagne' })).toHaveTextContent('Alle Kampagnen');
    expect(screen.getByRole('combobox', { name: 'Ergebnis' })).toHaveTextContent('Alle');
    expect(screen.getByRole('combobox', { name: 'Zeitraum' })).toHaveTextContent('Letzte 7 Tage');
  });
});
