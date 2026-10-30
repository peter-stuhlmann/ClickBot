import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotRow, type SlotDateControl } from './SlotRow';

const slot = { date: '2026-11-05', time: '13:24', bots: 3 };

/** Stands in for the date picker the organism renders here. */
const dateField = ({
  label: _label,
  onChange,
  className: _className,
  ...props
}: SlotDateControl) => <input {...props} onChange={(event) => onChange(event.target.value)} />;

describe('SlotRow', () => {
  it('shows date, time and bots of the slot', () => {
    render(
      <SlotRow index={0} slot={slot} onChange={vi.fn()} onRemove={vi.fn()}>
        {dateField}
      </SlotRow>,
    );
    expect(screen.getByLabelText('Datum Termin 1')).toHaveValue('2026-11-05');
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toHaveValue('13:24');
    expect(screen.getByText('3')).toHaveTextContent('3 Bots');
  });

  it('reports a changed date and time', () => {
    const onChange = vi.fn();
    render(
      <SlotRow index={0} slot={slot} onChange={onChange}>
        {dateField}
      </SlotRow>,
    );

    fireEvent.change(screen.getByLabelText('Datum Termin 1'), { target: { value: '2026-11-06' } });
    fireEvent.change(screen.getByLabelText('Uhrzeit Termin 1'), { target: { value: '14:00' } });

    expect(onChange).toHaveBeenNthCalledWith(1, { ...slot, date: '2026-11-06' });
    expect(onChange).toHaveBeenNthCalledWith(2, { ...slot, time: '14:00' });
  });

  it('counts bots up and down', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SlotRow index={1} slot={slot} onChange={onChange}>
        {dateField}
      </SlotRow>,
    );

    await user.click(screen.getByRole('button', { name: 'Ein Bot mehr (Termin 2)' }));
    await user.click(screen.getByRole('button', { name: 'Ein Bot weniger (Termin 2)' }));

    expect(onChange).toHaveBeenNthCalledWith(1, { ...slot, bots: 4 });
    expect(onChange).toHaveBeenNthCalledWith(2, { ...slot, bots: 2 });
  });

  it('keeps the bots between 1 and 50', () => {
    const { rerender } = render(
      <SlotRow index={0} slot={{ ...slot, bots: 1 }} onChange={vi.fn()}>
        {dateField}
      </SlotRow>,
    );
    expect(screen.getByRole('button', { name: /Ein Bot weniger/ })).toBeDisabled();
    expect(screen.getByText('1')).toHaveTextContent('1 Bot');

    rerender(
      <SlotRow index={0} slot={{ ...slot, bots: 50 }} onChange={vi.fn()}>
        {dateField}
      </SlotRow>,
    );
    expect(screen.getByRole('button', { name: /Ein Bot mehr/ })).toBeDisabled();
  });

  it('can be removed unless it is the only slot', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const { rerender } = render(
      <SlotRow index={0} slot={slot} onChange={vi.fn()} onRemove={onRemove}>
        {dateField}
      </SlotRow>,
    );
    await user.click(screen.getByRole('button', { name: 'Termin 1 entfernen' }));
    expect(onRemove).toHaveBeenCalledOnce();

    rerender(
      <SlotRow index={0} slot={slot} onChange={vi.fn()}>
        {dateField}
      </SlotRow>,
    );
    expect(screen.getByRole('button', { name: 'Termin 1 entfernen' })).toBeDisabled();
  });

  it('shows its error and marks the inputs invalid', () => {
    render(
      <SlotRow
        index={0}
        slot={slot}
        error="Der Termin liegt in der Vergangenheit."
        onChange={vi.fn()}
      >
        {dateField}
      </SlotRow>,
    );
    const time = screen.getByLabelText('Uhrzeit Termin 1');
    expect(time).toBeInvalid();
    expect(time).toHaveAccessibleDescription('Der Termin liegt in der Vergangenheit.');
  });

  it('keeps date and time of a slot that already has runs', () => {
    render(
      <SlotRow index={0} slot={slot} locked onChange={vi.fn()} onRemove={vi.fn()}>
        {dateField}
      </SlotRow>,
    );
    expect(screen.getByLabelText('Datum Termin 1')).toBeDisabled();
    expect(screen.getByLabelText('Uhrzeit Termin 1')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Termin 1 entfernen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Ein Bot mehr/ })).toBeEnabled();
    expect(screen.getByText(/Hat schon Läufe/)).toBeVisible();
  });
});
