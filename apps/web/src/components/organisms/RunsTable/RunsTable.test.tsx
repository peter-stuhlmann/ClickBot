import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunListRowView } from '@/lib/views';
import { RunsTable } from './RunsTable';

const row = (overrides: Partial<RunListRowView> = {}): RunListRowView => ({
  id: 'run-7',
  href: '/laeufe/run-7',
  jobName: 'Kontaktformular-Test',
  detail: 'Lauf #7 · Desktop · Bot 1',
  testRun: false,
  customer: 'Beispiel GmbH',
  when: '05.11. 14:30',
  duration: '8,4 s',
  status: { tone: 'success', label: 'Erfolgreich' },
  failed: false,
  ...overrides,
});

const pager = { label: 'Seite 1 von 1' };

describe('RunsTable', () => {
  it('has the columns of the design, without the location that does not exist yet', () => {
    render(<RunsTable rows={[row()]} summary="1 Lauf" pager={pager} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Job · Lauf',
      'Kunde',
      'Zeitpunkt · Dauer',
      'Ergebnis',
    ]);
    expect(screen.getByRole('region', { name: 'Läufe' })).toHaveTextContent('1 Lauf');
  });

  it('links each run to its report and shows what happened', () => {
    render(<RunsTable rows={[row()]} summary="1 Lauf" pager={pager} />);
    const [, dataRow] = screen.getAllByRole('row');
    const cells = within(dataRow as HTMLElement);
    expect(
      cells.getByRole('link', { name: 'Kontaktformular-Test Lauf #7 · Desktop · Bot 1' }),
    ).toHaveAttribute('href', '/laeufe/run-7');
    expect(cells.getByText('Beispiel GmbH')).toBeVisible();
    expect(cells.getByText('05.11. 14:30 · 8,4 s')).toBeVisible();
    expect(cells.getByText('Erfolgreich')).toBeVisible();
  });

  it('marks test runs and colours failed runs red', () => {
    render(
      <RunsTable
        rows={[
          row({ testRun: true, failed: true, status: { tone: 'danger', label: 'Fehlgeschlagen' } }),
        ]}
        summary="1 Lauf"
        pager={pager}
      />,
    );
    const [, dataRow] = screen.getAllByRole('row');
    expect(dataRow).toHaveClass('bg-danger-soft');
    expect(
      screen.getByRole('link', { name: 'Kontaktformular-Test Testlauf Lauf #7 · Desktop · Bot 1' }),
    ).toBeVisible();
    expect(screen.getByText('05.11. 14:30 · 8,4 s')).toHaveClass('text-danger');
  });

  it('says when no run matches and pages through many', () => {
    render(
      <RunsTable
        rows={[]}
        summary="keine Läufe"
        pager={{ label: 'Seite 2 von 2', previousHref: '/laeufe' }}
      />,
    );
    expect(screen.getByText('Keine Läufe für diese Filter.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Neuere' })).toHaveAttribute('href', '/laeufe');
  });
});
