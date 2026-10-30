import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';

/** A parent that keeps the value, like the schedule form. */
function Controlled({ initial = '', onChange = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return (
    <DatePicker
      label="Startdatum"
      aria-label="Startdatum"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const field = () => screen.getByRole('textbox', { name: 'Startdatum' });
const openButton = () => screen.getByRole('button', { name: 'Kalender für Startdatum' });
const calendar = () => screen.getByRole('dialog', { name: 'Startdatum wählen' });

beforeEach(() => {
  // Only the clock: user-event keeps its real timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T10:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('DatePicker', () => {
  it('shows a stored date the German way', () => {
    render(<Controlled initial="2026-11-20" />);
    expect(field()).toHaveValue('20.11.2026');
  });

  it('takes a typed German date and passes it on in the stored form', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.type(field(), '1.12.26');
    expect(onChange).toHaveBeenLastCalledWith('2026-12-01');
    await user.tab();
    expect(field()).toHaveValue('01.12.2026');
  });

  it('passes on a typo as it is, so the form can say what is wrong', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.type(field(), '31.11.2026');
    expect(onChange).toHaveBeenLastCalledWith('31.11.2026');
    await user.tab();
    expect(field()).toHaveValue('31.11.2026');
  });

  it('opens on the month of the date, with that day chosen and focused', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="2026-12-24" />);
    await user.click(openButton());

    expect(openButton()).toHaveAttribute('aria-expanded', 'true');
    expect(calendar()).toHaveTextContent('Dezember 2026');
    const day = screen.getByRole('button', { name: 'Donnerstag, 24. Dezember 2026' });
    expect(day).toHaveFocus();
    expect(day.closest('td')).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on today without a date, and marks today', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(openButton());
    const today = screen.getByRole('button', { name: 'Donnerstag, 5. November 2026' });
    expect(today).toHaveFocus();
    expect(today).toHaveAttribute('aria-current', 'date');
  });

  it('chooses a day with the mouse, closes and goes back to the field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-11-20" onChange={onChange} />);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: 'Freitag, 27. November 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-11-27');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field()).toHaveValue('27.11.2026');
    expect(field()).toHaveFocus();
  });

  it('pages through the months with the arrows beside the month', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="2026-11-20" />);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    expect(calendar()).toHaveTextContent('Dezember 2026');
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    await user.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    expect(calendar()).toHaveTextContent('Oktober 2026');
  });

  it('works with the keyboard: arrows, Home/End, PageUp/PageDown and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-11-20" onChange={onChange} />);
    field().focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(screen.getByRole('button', { name: 'Freitag, 20. November 2026' })).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Samstag, 28. November 2026' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Montag, 23. November 2026' })).toHaveFocus();
    await user.keyboard('{End}{ArrowUp}{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Samstag, 21. November 2026' })).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(calendar()).toHaveTextContent('Dezember 2026');
    expect(screen.getByRole('button', { name: 'Montag, 21. Dezember 2026' })).toHaveFocus();
    await user.keyboard('{Shift>}{PageUp}{/Shift}');
    expect(screen.getByRole('button', { name: 'Sonntag, 21. Dezember 2025' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2025-12-21');
    expect(field()).toHaveValue('21.12.2025');
  });

  it('closes with Escape without changing anything, back on the calendar button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-11-20" onChange={onChange} />);
    await user.click(openButton());
    await user.keyboard('{ArrowRight}{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openButton()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled />
        <p>Daneben</p>
      </>,
    );
    await user.click(openButton());
    await user.click(screen.getByText('Daneben'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('jumps to today, and empties an optional date', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-01-10" onChange={onChange} />);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: 'Heute' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-05');

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(field()).toHaveValue('');
  });

  it('offers no removal for a required date', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Datum" aria-label="Datum" required defaultValue="2026-11-20" />);
    await user.click(screen.getByRole('button', { name: 'Kalender für Datum' }));
    expect(screen.queryByRole('button', { name: 'Entfernen' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Datum' })).toBeRequired();
  });

  it('sends the stored form with a plain form, also without a parent keeping it', async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form aria-label="Formular" onSubmit={(event) => submit(event.nativeEvent as SubmitEvent)}>
        <DatePicker label="Ende" aria-label="Ende" name="endsOn" defaultValue="2026-11-30" />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Formular' }) as HTMLFormElement;
    expect(new FormData(form).get('endsOn')).toBe('2026-11-30');

    const input = screen.getByRole('textbox', { name: 'Ende' });
    await user.clear(input);
    await user.type(input, '24.12.2026');
    expect(new FormData(form).get('endsOn')).toBe('2026-12-24');
    // The visible field carries no name: only the stored form is sent.
    expect([...new FormData(form).keys()]).toEqual(['endsOn']);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalled();
  });

  it('cannot be changed while disabled', () => {
    render(<DatePicker label="Datum" aria-label="Datum" disabled defaultValue="2026-11-20" />);
    expect(screen.getByRole('textbox', { name: 'Datum' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kalender für Datum' })).toBeDisabled();
  });

  it('passes the error state of its field on to the text field', () => {
    render(
      <DatePicker label="Datum" id="d" aria-invalid aria-describedby="d-error" defaultValue="" />,
    );
    const input = document.getElementById('d');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'd-error');
    expect(input).toHaveAttribute('placeholder', 'TT.MM.JJJJ');
  });
});
