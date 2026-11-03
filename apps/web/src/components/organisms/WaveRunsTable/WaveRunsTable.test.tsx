import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WaveRunRowView } from '@/lib/views';
import { WaveRunsTable } from './WaveRunsTable';

const NOT_FOUND = 'Element nicht gefunden: Rolle „link“ mit Name „Weiter“ (nach 10 s).';

const rows: WaveRunRowView[] = [
  {
    id: 'a',
    href: '/laeufe/a',
    device: 'Desktop',
    browser: 'Chrome',
    status: { tone: 'success', label: 'Bestanden' },
    failedStep: null,
    reason: null,
    duration: '8,0 s',
    failed: false,
  },
  {
    id: 'b',
    href: '/laeufe/b',
    device: 'iPhone 15',
    browser: 'Safari',
    status: { tone: 'danger', label: 'Fehlgeschlagen' },
    failedStep: 'Schritt 7 · Klicke auf „Weiter“',
    reason: NOT_FOUND,
    duration: '21,0 s',
    failed: true,
  },
];

describe('WaveRunsTable', () => {
  it('has a row per device and browser, each opening the report of its run', () => {
    render(<WaveRunsTable rows={rows} summary="2 Durchläufe · 1 fehlgeschlagen" />);

    expect(screen.getByRole('region', { name: 'Durchläufe dieses Starts' })).toHaveTextContent(
      '2 Durchläufe · 1 fehlgeschlagen',
    );
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
    const [first, second] = within(body).getAllByRole('row');
    expect(within(first as HTMLElement).getByRole('link', { name: 'Desktop' })).toHaveAttribute(
      'href',
      '/laeufe/a',
    );
    expect(first).toHaveTextContent('Chrome');
    expect(first).toHaveTextContent('Bestanden');
    expect(first).toHaveTextContent('8,0 s');
    expect(within(second as HTMLElement).getByRole('link', { name: 'iPhone 15' })).toHaveAttribute(
      'href',
      '/laeufe/b',
    );
  });

  it('says at a failed run which step failed and why, and marks the row', () => {
    render(<WaveRunsTable rows={rows} summary="2 Durchläufe" />);
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
    const [passed, failed] = within(body).getAllByRole('row');

    expect(failed).toHaveTextContent('Schritt 7 · Klicke auf „Weiter“');
    expect(failed).toHaveTextContent(NOT_FOUND);
    expect(failed).toHaveClass('bg-danger-soft');
    expect(passed).not.toHaveClass('bg-danger-soft');
    expect(passed).not.toHaveTextContent('Schritt');
  });

  it('names its columns for screen readers', () => {
    render(<WaveRunsTable rows={rows} summary="2 Durchläufe" />);
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Gerät',
      'Browser',
      'Ergebnis',
      'Problem bei',
      'Dauer',
    ]);
  });
});
