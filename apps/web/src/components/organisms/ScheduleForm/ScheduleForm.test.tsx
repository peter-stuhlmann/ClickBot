import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { emptyDraft, type ScheduleDraft, type ScheduleErrors } from '@/lib/job-draft';
import { ScheduleForm } from './ScheduleForm';

const initial = emptyDraft(new Date('2026-11-05T12:30:00Z')).schedule;
const noErrors: ScheduleErrors = { fields: {}, slots: {} };

function Harness({
  start = initial,
  errors = noErrors,
  onChange = () => {},
}: {
  start?: ScheduleDraft;
  errors?: ScheduleErrors;
  onChange?: (schedule: ScheduleDraft) => void;
}) {
  const [schedule, setSchedule] = useState(start);
  return (
    <ScheduleForm
      schedule={schedule}
      errors={errors}
      note="24 Starts × 1 Gerät = 24 Läufe"
      onChange={(next) => {
        setSchedule(next);
        onChange(next);
      }}
    />
  );
}

describe('ScheduleForm', () => {
  it('starts with an interval: every n minutes, at most m runs, starting now', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Alle (Minuten)' })).toHaveValue('60');
    expect(screen.getByRole('textbox', { name: 'Max. Läufe' })).toHaveValue('24');
    expect(screen.getByRole('combobox', { name: 'Start' })).toHaveValue('now');
    expect(screen.getByText('24 Starts × 1 Gerät = 24 Läufe')).toBeVisible();
  });

  it('reports changed interval values', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Alle (Minuten)' }), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Max. Läufe' }), {
      target: { value: '20' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ everyMinutes: '15', maxRuns: '20' }),
    );
  });

  it('asks for date and time when the interval starts later', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Start' }), 'Zu einem Zeitpunkt');
    fireEvent.change(screen.getByLabelText('Startdatum'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('Startzeit'), { target: { value: '09:00' } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ startMode: 'at', startDate: '2026-11-06', startTime: '09:00' }),
    );
  });

  it('shows interval errors at their fields', () => {
    render(
      <Harness
        start={{ ...initial, startMode: 'at' }}
        errors={{
          fields: { everyMinutes: 'Abstand …', startAt: 'Der Start liegt in der Vergangenheit.' },
          slots: {},
        }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Alle (Minuten)' })).toBeInvalid();
    expect(screen.getByLabelText('Startdatum')).toHaveAccessibleDescription(
      'Der Start liegt in der Vergangenheit.',
    );
  });

  it('manages dates with a wave of bots each', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Termine' }));
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveValue('14:00');

    await user.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    expect(screen.getByLabelText('Uhrzeit Termin 2')).toHaveValue('15:00');

    await user.click(screen.getByRole('button', { name: 'Ein Bot mehr (Termin 2)' }));
    await user.click(screen.getByRole('button', { name: 'Termin 1 entfernen' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'times',
        slots: [{ key: 'slot-2', date: '2026-11-05', time: '15:00', bots: 2 }],
      }),
    );
    expect(screen.getByRole('button', { name: 'Termin 1 entfernen' })).toBeDisabled();
  });

  it('switches staggered starts off and on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness start={{ ...initial, type: 'times' }} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Gestaffelt starten' });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ stagger: false }));
  });

  it('shows slot errors in their row and list errors below', () => {
    render(
      <Harness
        start={{ ...initial, type: 'times' }}
        errors={{
          fields: { slots: 'Mindestens einen Termin anlegen.' },
          slots: { 0: 'Der Termin liegt in der Vergangenheit.' },
        }}
      />,
    );
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveAccessibleDescription(
      'Der Termin liegt in der Vergangenheit.',
    );
    expect(screen.getByText('Mindestens einen Termin anlegen.')).toBeVisible();
  });

  it('keeps dates with runs and the kind of schedule in the editor', () => {
    render(
      <ScheduleForm
        schedule={{ ...initial, type: 'times' }}
        errors={{
          fields: { type: 'Die Art des Zeitplans lässt sich nicht mehr ändern.' },
          slots: {},
        }}
        lockedSlots={[0]}
        typeLocked
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeDisabled();
    expect(screen.getByText(/bleibt die Art des Zeitplans/)).toBeVisible();
    expect(screen.getByText('Die Art des Zeitplans lässt sich nicht mehr ändern.')).toBeVisible();
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toBeDisabled();
  });

  it('names the stagger distance of the job', () => {
    render(
      <ScheduleForm
        schedule={{ ...initial, type: 'times', staggerSeconds: 5 }}
        errors={noErrors}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/im Abstand von 5 s/)).toBeVisible();
  });

  it('does not remove a date before one with runs, which would move it', () => {
    const slots = [
      { key: 'slot-1', date: '2026-11-06', time: '10:00', bots: 1 },
      { key: 'slot-2', date: '2026-11-05', time: '11:00', bots: 1 },
      { key: 'slot-3', date: '2026-11-07', time: '12:00', bots: 1 },
    ];
    render(
      <ScheduleForm
        schedule={{ ...initial, type: 'times', slots }}
        errors={noErrors}
        lockedSlots={[1]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Termin 1 entfernen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Termin 2 entfernen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Termin 3 entfernen' })).toBeEnabled();
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toBeEnabled();
  });
});
