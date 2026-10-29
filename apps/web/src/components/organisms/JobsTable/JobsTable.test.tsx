import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JobRowView } from '@/lib/views';
import { JobsTable } from './JobsTable';

const row = (overrides: Partial<JobRowView> = {}): JobRowView => ({
  id: 'job-1',
  name: 'Kontaktformular-Test',
  campaign: 'Black Friday',
  url: 'beispiel.de/kontakt',
  schedule: { primary: 'alle 15 Min.', secondary: 'max. 20 Läufe' },
  progress: { label: '7 / 20 Läufe', value: 0.35 },
  lastRun: { tone: 'success', label: 'Erfolgreich', when: 'vor 3 Min.', href: '/laeufe/run-7' },
  successRate: { text: '100 %', tone: 'success' },
  status: { label: 'Aktiv', active: true, toggleable: true },
  ...overrides,
});

const noop = () => {};

describe('JobsTable', () => {
  it('has the six columns of the design', () => {
    render(<JobsTable rows={[row()]} toggleAction={noop} />);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Job',
      'Zeitplan',
      'Fortschritt',
      'Letzter Lauf',
      'Erfolgsquote',
      'Status',
    ]);
  });

  it('shows everything about a job in one row', () => {
    render(<JobsTable rows={[row()]} toggleAction={noop} />);
    const [, dataRow] = screen.getAllByRole('row');
    const cells = within(dataRow as HTMLElement);

    expect(cells.getByText('Kontaktformular-Test')).toBeInTheDocument();
    expect(cells.getByText('beispiel.de/kontakt')).toBeInTheDocument();
    expect(cells.getByText('Black Friday')).toBeInTheDocument();
    expect(cells.getByText('alle 15 Min.')).toBeInTheDocument();
    expect(cells.getByText('7 / 20 Läufe')).toBeInTheDocument();
    expect(
      cells.getByRole('progressbar', { name: 'Fortschritt Kontaktformular-Test' }),
    ).toHaveAttribute('aria-valuenow', '35');
    expect(cells.getByText('Erfolgreich')).toBeInTheDocument();
    expect(cells.getByText('vor 3 Min.')).toBeInTheDocument();
    expect(cells.getByText('100 %')).toHaveClass('text-success');
  });

  it('names the columns inside the row for small screens, but not twice for screen readers', () => {
    render(<JobsTable rows={[row()]} toggleAction={noop} />);
    const [, dataRow] = screen.getAllByRole('row');
    for (const column of ['Zeitplan', 'Fortschritt', 'Letzter Lauf', 'Erfolgsquote', 'Status']) {
      expect(within(dataRow as HTMLElement).getByText(column)).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
  });

  it('colours the success rate by its tone', () => {
    render(
      <JobsTable
        rows={[row({ successRate: { text: '87 %', tone: 'danger' } })]}
        toggleAction={noop}
      />,
    );
    expect(screen.getByText('87 %')).toHaveClass('text-danger');
  });

  it('marks jobs that never ran', () => {
    render(<JobsTable rows={[row({ lastRun: null, successRate: null })]} toggleAction={noop} />);
    expect(screen.getByText('noch kein Lauf')).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('pauses an active job through the server action', async () => {
    const user = userEvent.setup();
    const toggleAction = vi.fn();
    render(<JobsTable rows={[row()]} toggleAction={toggleAction} />);

    await user.click(screen.getByRole('switch', { name: 'Kontaktformular-Test pausieren' }));

    await vi.waitFor(() => expect(toggleAction).toHaveBeenCalledTimes(1));
    const data = toggleAction.mock.calls[0]?.[0] as FormData;
    expect(data.get('jobId')).toBe('job-1');
    expect(data.get('active')).toBe('false');
  });

  it('offers to resume a paused job', () => {
    render(
      <JobsTable
        rows={[row({ status: { label: 'Pausiert', active: false, toggleable: true } })]}
        toggleAction={noop}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Kontaktformular-Test fortsetzen' });
    expect(new FormData(toggle.closest('form') as HTMLFormElement).get('active')).toBe('true');
  });

  it('shows finished jobs with a disabled switch and no form', () => {
    render(
      <JobsTable
        rows={[row({ status: { label: 'Beendet', active: false, toggleable: false } })]}
        toggleAction={noop}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Kontaktformular-Test: Beendet' });
    expect(toggle).toBeDisabled();
    expect(toggle.closest('form')).toBeNull();
    expect(screen.getByText('Beendet')).toBeInTheDocument();
  });

  it('explains the empty state', () => {
    render(<JobsTable rows={[]} toggleAction={noop} />);
    expect(screen.getByText(/Noch keine Jobs/)).toBeInTheDocument();
  });

  it('links the last run to its report', () => {
    render(<JobsTable rows={[row()]} toggleAction={noop} />);
    expect(
      screen.getByRole('link', {
        name: 'Letzter Lauf von Kontaktformular-Test: Erfolgreich, vor 3 Min.',
      }),
    ).toHaveAttribute('href', '/laeufe/run-7');
  });

  it('opens the editor from the job name', () => {
    render(<JobsTable rows={[row()]} toggleAction={noop} />);
    expect(screen.getByRole('link', { name: 'Kontaktformular-Test' })).toHaveAttribute(
      'href',
      '/jobs/job-1',
    );
  });
});
