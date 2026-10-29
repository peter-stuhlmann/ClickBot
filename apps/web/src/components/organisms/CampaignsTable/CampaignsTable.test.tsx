import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CampaignRowView } from '@/lib/views';
import { CampaignsTable } from './CampaignsTable';

const row = (overrides: Partial<CampaignRowView> = {}): CampaignRowView => ({
  id: 'c1',
  name: 'Black Friday',
  detail: '20.11.–30.11.2026 · beispiel.de · 3 Websites',
  jobs: { primary: '4 Jobs', secondary: '3 aktiv · 1 beendet' },
  runs: { label: '312 Läufe · 96,2 % ok', value: 0.962 },
  lastRun: { tone: 'success', label: 'Erfolgreich', when: 'vor 3 Min.', href: '/laeufe/run-1' },
  successRate: { text: '96,2 %', tone: 'success' },
  ...overrides,
});

describe('CampaignsTable', () => {
  it('has the columns of the design, without the weekly PDF that does not exist yet', () => {
    render(<CampaignsTable rows={[row()]} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Kampagne',
      'Jobs',
      'Läufe (30 Tage)',
      'Letzter Lauf',
      'Erfolgsquote',
    ]);
  });

  it('names the columns inside the row for small screens, but not twice for screen readers', () => {
    render(<CampaignsTable rows={[row()]} />);
    const [, dataRow] = screen.getAllByRole('row');
    for (const column of ['Jobs', 'Läufe (30 Tage)', 'Letzter Lauf', 'Erfolgsquote']) {
      expect(within(dataRow as HTMLElement).getByText(column)).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
  });

  it('shows everything about a campaign in one row', () => {
    render(<CampaignsTable rows={[row()]} />);
    const [, dataRow] = screen.getAllByRole('row');
    const cells = within(dataRow as HTMLElement);

    expect(cells.getByRole('link', { name: 'Black Friday' })).toHaveAttribute(
      'href',
      '/kampagnen/c1',
    );
    expect(cells.getByText('20.11.–30.11.2026 · beispiel.de · 3 Websites')).toBeVisible();
    expect(cells.getByText('4 Jobs')).toBeVisible();
    expect(cells.getByText('3 aktiv · 1 beendet')).toBeVisible();
    expect(
      cells.getByRole('progressbar', { name: 'Erfolgreiche Läufe Black Friday' }),
    ).toHaveAttribute('aria-valuenow', '96');
    expect(
      cells.getByRole('link', { name: 'Letzter Lauf von Black Friday: Erfolgreich, vor 3 Min.' }),
    ).toHaveAttribute('href', '/laeufe/run-1');
    expect(cells.getByText('96,2 %')).toHaveClass('text-success');
  });

  it('shows dashes for a campaign without runs', () => {
    render(<CampaignsTable rows={[row({ lastRun: null, successRate: null })]} />);
    expect(screen.getByText('noch kein Lauf')).toBeVisible();
    expect(screen.getByText('–')).toBeVisible();
  });

  it('invites to create the first campaign when there is none', () => {
    render(<CampaignsTable rows={[]} />);
    expect(screen.getByText(/Noch keine Kampagnen/)).toBeVisible();
  });
});
