import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunFilters } from './RunFilters';

const props = {
  values: { projekt: 'c2', ergebnis: 'fehlgeschlagen', zeitraum: '24h', geraet: '' },
  customers: [
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
    expect(screen.getByRole('combobox', { name: 'Projekt' })).toHaveAttribute('name', 'projekt');
    expect(screen.getByRole('combobox', { name: 'Gerät' })).toHaveAttribute('name', 'geraet');
  });

  it('shows the current filters', () => {
    render(<RunFilters {...props} />);
    expect(screen.getByRole('combobox', { name: 'Projekt' })).toHaveValue('c2');
    expect(screen.getByRole('combobox', { name: 'Ergebnis' })).toHaveValue('fehlgeschlagen');
    expect(screen.getByRole('combobox', { name: 'Zeitraum' })).toHaveValue('24h');
    expect(screen.getByRole('combobox', { name: 'Gerät' })).toHaveValue('');
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
      <RunFilters {...props} values={{ projekt: '', ergebnis: '', zeitraum: '7d', geraet: '' }} />,
    );
    expect(screen.getByRole('combobox', { name: 'Projekt' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Ergebnis' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Zeitraum' })).toHaveValue('7d');
  });
});
