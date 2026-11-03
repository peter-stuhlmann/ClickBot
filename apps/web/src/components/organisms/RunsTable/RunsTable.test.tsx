import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NO_AI_COST } from '@/lib/cost';
import type { RunListRowView } from '@/lib/views';
import { RunsTable } from './RunsTable';

const row = (overrides: Partial<RunListRowView> = {}): RunListRowView => ({
  id: 'run-7',
  href: '/laeufe/run-7',
  jobName: 'Kontaktformular-Test',
  detail: 'Durchlauf 7 · Desktop · Browser 1',
  testRun: false,
  campaign: 'Black Friday',
  when: '05.11. 14:30',
  duration: '8,4 s',
  status: { tone: 'success', label: 'Bestanden' },
  failed: false,
  cost: NO_AI_COST,
  ...overrides,
});

const pager = { label: 'Seite 1 von 1' };

describe('RunsTable', () => {
  it('has the columns of the design, without the location that does not exist yet', () => {
    render(<RunsTable rows={[row()]} summary="1 Durchlauf" pager={pager} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Test · Durchlauf',
      'Kampagne',
      'Zeitpunkt · Dauer',
      'Ergebnis',
    ]);
    expect(screen.getByRole('region', { name: 'Durchläufe' })).toHaveTextContent('1 Durchlauf');
  });

  it('links each run to its report and shows what happened', () => {
    render(<RunsTable rows={[row()]} summary="1 Durchlauf" pager={pager} />);
    const [, dataRow] = screen.getAllByRole('row');
    const cells = within(dataRow as HTMLElement);
    expect(
      cells.getByRole('link', { name: 'Kontaktformular-Test Durchlauf 7 · Desktop · Browser 1' }),
    ).toHaveAttribute('href', '/laeufe/run-7');
    expect(cells.getByText('Black Friday')).toBeVisible();
    // On one line, never broken inside.
    expect(cells.getByText('05.11. 14:30 · 8,4 s')).toHaveClass('whitespace-nowrap');
    expect(cells.getByText('Bestanden')).toBeVisible();
  });

  it('marks test runs and colours failed runs red', () => {
    render(
      <RunsTable
        rows={[
          row({ testRun: true, failed: true, status: { tone: 'danger', label: 'Fehlgeschlagen' } }),
        ]}
        summary="1 Durchlauf"
        pager={pager}
      />,
    );
    const [, dataRow] = screen.getAllByRole('row');
    expect(dataRow).toHaveClass('bg-danger-soft');
    expect(
      screen.getByRole('link', {
        name: 'Kontaktformular-Test Manuell Durchlauf 7 · Desktop · Browser 1',
      }),
    ).toBeVisible();
    expect(screen.getByText('05.11. 14:30 · 8,4 s')).toHaveClass('text-danger');
  });

  it('says when no run matches and pages through many', () => {
    render(
      <RunsTable
        rows={[]}
        summary="keine Durchläufe"
        pager={{ label: 'Seite 2 von 2', previousHref: '/laeufe' }}
      />,
    );
    expect(screen.getByText('Keine Durchläufe für diese Filter.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Neuere' })).toHaveAttribute('href', '/laeufe');
  });

  it('has a coin button for every run that shows what its AI cost', async () => {
    const user = userEvent.setup();
    const cost = {
      model: 'Claude · claude-x',
      rows: [{ label: 'Eingabe', tokens: '1.000', price: '0,01 $' }],
      total: '0,01 $',
      note: null,
    };
    render(
      <RunsTable
        rows={[row({ cost }), row({ id: 'run-8', jobName: 'Login-Test' })]}
        summary="2 Durchläufe"
        pager={pager}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^KI-Kosten von / })).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: 'KI-Kosten von Kontaktformular-Test, 05.11. 14:30' }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Claude · claude-x');
    expect(screen.getByRole('dialog')).toHaveTextContent('0,01 $');
  });
});
