import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'interval', label: 'Intervall' },
  { value: 'times', label: 'Termine' },
] as const;

function Harness() {
  const [value, setValue] = useState<'interval' | 'times'>('interval');
  return <SegmentedControl label="Zeitplan" options={options} value={value} onChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('is a radio group with the current option checked', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Zeitplan' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Termine' })).not.toBeChecked();
  });

  it('switches on click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Termine' }));
    expect(screen.getByRole('radio', { name: 'Termine' })).toBeChecked();
  });

  it('moves the choice and the focus with the arrow keys, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Intervall' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Termine' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Termine' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeChecked();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Termine' })).toBeChecked();
  });

  it('can be left with Tab, because only the checked option is focusable', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Termine' })).toHaveAttribute('tabindex', '-1');
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    await user.keyboard('a');
    expect(screen.getByRole('radio', { name: 'Intervall' })).toBeChecked();
  });

  it('can show a choice that may not change', async () => {
    const user = userEvent.setup();
    let changed = false;
    render(
      <SegmentedControl
        label="Zeitplan"
        options={options}
        value="times"
        disabled
        onChange={() => {
          changed = true;
        }}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'Intervall' }));
    expect(changed).toBe(false);
    expect(screen.getByRole('radio', { name: 'Termine' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Termine' })).toBeDisabled();
  });
});
