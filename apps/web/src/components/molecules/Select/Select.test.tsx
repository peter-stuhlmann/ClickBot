import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'click', label: 'Klicken' },
  { value: 'fill', label: 'Ausfüllen' },
  { value: 'assert', label: 'Prüfen' },
  { value: 'wait', label: 'Warten' },
];

function Controlled({ onChange = vi.fn(), initial = 'click' }) {
  const [value, setValue] = useState(initial);
  return (
    <Select
      aria-label="Aktion"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const box = () => screen.getByRole('combobox', { name: 'Aktion' });
const optionTexts = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('Select', () => {
  it('shows the chosen entry and stays closed at first', () => {
    render(<Controlled initial="fill" />);
    expect(box()).toHaveTextContent('Ausfüllen');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens a list with a check at the chosen entry and takes a click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(box());

    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(optionTexts()).toEqual(['Klicken', 'Ausfüllen', 'Prüfen', 'Warten']);
    const chosen = screen.getByRole('option', { name: 'Klicken' });
    expect(chosen).toHaveAttribute('aria-selected', 'true');
    expect(chosen.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('option', { name: 'Prüfen' }).querySelector('svg')).toBeNull();

    await user.click(screen.getByRole('option', { name: 'Prüfen' }));
    expect(onChange).toHaveBeenCalledWith('assert');
    expect(box()).toHaveTextContent('Prüfen');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box()).toHaveFocus();
  });

  it('works with the keyboard: arrows, Home/End, Enter and Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    box().focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const active = () => document.getElementById(box().getAttribute('aria-activedescendant') ?? '');
    expect(active()).toHaveTextContent('Klicken');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(active()).toHaveTextContent('Prüfen');
    await user.keyboard('{End}');
    expect(active()).toHaveTextContent('Warten');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('Warten');
    await user.keyboard('{Home}{ArrowUp}');
    expect(active()).toHaveTextContent('Klicken');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('fill');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.keyboard('{Enter}{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('jumps to an entry by typing its first letters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    box().focus();
    await user.keyboard('pr');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('assert');
  });

  it('closes on a click outside without changing anything', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Controlled onChange={onChange} />
        <p>Daneben</p>
      </>,
    );
    await user.click(box());
    await user.click(screen.getByText('Daneben'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts with an empty placeholder entry, shown muted', async () => {
    const user = userEvent.setup();
    render(<Select aria-label="Kampagne" options={options} placeholder="Kampagne wählen" />);
    const combobox = screen.getByRole('combobox', { name: 'Kampagne' });
    expect(combobox).toHaveTextContent('Kampagne wählen');
    expect(combobox.querySelector('.text-text-muted')).not.toBeNull();
    await user.click(combobox);
    expect(optionTexts()).toEqual(['Kampagne wählen', 'Klicken', 'Ausfüllen', 'Prüfen', 'Warten']);
  });

  it('sends its value with a plain form, also without a parent keeping it', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Filter">
        <Select aria-label="Ergebnis" name="ergebnis" options={options} defaultValue="fill" />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Filter' }) as HTMLFormElement;
    expect(new FormData(form).get('ergebnis')).toBe('fill');
    await user.click(screen.getByRole('combobox', { name: 'Ergebnis' }));
    await user.click(screen.getByRole('option', { name: 'Warten' }));
    expect(new FormData(form).get('ergebnis')).toBe('wait');
  });

  it('takes the first entry without a value, like a native select', () => {
    render(
      <form aria-label="Filter">
        <Select aria-label="Zeitraum" name="zeitraum" options={options} />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Filter' }) as HTMLFormElement;
    expect(new FormData(form).get('zeitraum')).toBe('click');
  });

  it('is named by the label of its field, also for the list', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label id="mode-label" htmlFor="mode">
          Start
        </label>
        <Select id="mode" options={options} aria-describedby="mode-hint" aria-invalid />
      </>,
    );
    const combobox = screen.getByRole('combobox', { name: 'Start' });
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toHaveAttribute('aria-describedby', 'mode-hint');
    await user.click(combobox);
    expect(screen.getByRole('listbox', { name: 'Start' })).toBeInTheDocument();
  });

  it('cannot be opened while disabled', () => {
    render(<Select aria-label="Aktion" options={options} disabled />);
    expect(box()).toBeDisabled();
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
