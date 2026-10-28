import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CustomerRowView } from '@/lib/views';
import { CustomersTable } from './CustomersTable';

const row = (overrides: Partial<CustomerRowView> = {}): CustomerRowView => ({
  id: 'c1',
  name: 'Beispiel GmbH',
  websites: 'beispiel.de · 3 Websites',
  jobs: { primary: '4 Jobs', secondary: '3 aktiv · 1 beendet' },
  runs: { label: '312 Läufe · 96,2 % ok', value: 0.962 },
  lastRun: { tone: 'success', label: 'Erfolgreich', when: 'vor 3 Min.', href: '/laeufe/run-1' },
  successRate: { text: '96,2 %', tone: 'success' },
  ...overrides,
});

describe('CustomersTable', () => {
  it('has the columns of the design, without the weekly PDF that does not exist yet', () => {
    render(<CustomersTable rows={[row()]} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Kunde',
      'Jobs',
      'Läufe (30 Tage)',
      'Letzter Lauf',
      'Erfolgsquote',
    ]);
  });

  it('shows everything about a customer in one row', () => {
    render(<CustomersTable rows={[row()]} />);
    const [, dataRow] = screen.getAllByRole('row');
    const cells = within(dataRow as HTMLElement);

    expect(cells.getByText('Beispiel GmbH')).toBeVisible();
    expect(cells.getByText('beispiel.de · 3 Websites')).toBeVisible();
    expect(cells.getByText('4 Jobs')).toBeVisible();
    expect(cells.getByText('3 aktiv · 1 beendet')).toBeVisible();
    expect(
      cells.getByRole('progressbar', { name: 'Erfolgreiche Läufe Beispiel GmbH' }),
    ).toHaveAttribute('aria-valuenow', '96');
    expect(
      cells.getByRole('link', { name: 'Letzter Lauf von Beispiel GmbH: Erfolgreich, vor 3 Min.' }),
    ).toHaveAttribute('href', '/laeufe/run-1');
    expect(cells.getByText('96,2 %')).toHaveClass('text-success');
  });

  it('shows dashes for a customer without runs', () => {
    render(<CustomersTable rows={[row({ lastRun: null, successRate: null })]} />);
    expect(screen.getByText('noch kein Lauf')).toBeVisible();
    expect(screen.getByText('–')).toBeVisible();
  });

  it('invites to create the first customer when there is none', () => {
    render(<CustomersTable rows={[]} />);
    expect(screen.getByText(/Noch keine Kunden/)).toBeVisible();
  });
});
