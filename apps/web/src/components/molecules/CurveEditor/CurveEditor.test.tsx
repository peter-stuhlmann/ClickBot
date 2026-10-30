import { FLAT_CURVE } from '@click-bot/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CurveEditor } from './CurveEditor';

function Harness({ onChange = vi.fn() }) {
  const [points, setPoints] = useState<number[]>([...FLAT_CURVE]);
  return (
    <CurveEditor
      label="Verteilung am Montag"
      points={points}
      onChange={(next) => {
        setPoints(next);
        onChange(next);
      }}
    />
  );
}

const slider = () => screen.getByRole('slider', { name: 'Verteilung am Montag' });

describe('CurveEditor', () => {
  it('shows the scale from „nie“ to „hoch“ over the day', () => {
    render(<Harness />);
    for (const text of ['hoch', 'normal', 'nie', '0 Uhr', '12 Uhr', '24 Uhr']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(slider()).toHaveAttribute('aria-valuetext', '12 Uhr: normal');
  });

  it('works with the keyboard: left and right pick the hour, up and down the frequency', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    slider().focus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([1.5]));
    expect(slider()).toHaveAttribute('aria-valuetext', '12 Uhr: häufig');

    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(slider()).toHaveAttribute('aria-valuetext', '6 Uhr: normal');
    await user.keyboard('{End}');
    expect(slider()).toHaveAttribute('aria-valuetext', '24 Uhr: normal');
    await user.keyboard('{Home}');
    for (let i = 0; i < 12; i++) await user.keyboard('{ArrowDown}');
    expect(slider()).toHaveAttribute('aria-valuetext', '0 Uhr: nie');
    const last = onChange.mock.calls.at(-1)?.[0] as number[];
    expect(last[0]).toBe(0);
    expect(last[18]).toBe(1);
  });

  it('bends where it is dragged and keeps the rest of the day', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const box = slider();
    box.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 240, height: 100, right: 240, bottom: 100 }) as DOMRect;
    // 6 o'clock, at the bottom: „nie“.
    fireEvent.pointerDown(box, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(box, { pointerId: 1 });
    const last = onChange.mock.calls.at(-1)?.[0] as number[];
    expect(last[6]).toBe(0);
    expect(last[18]).toBe(1);
    expect(slider()).toHaveAttribute('aria-valuetext', '6 Uhr: nie');

    // Moving without pressing changes nothing.
    onChange.mockClear();
    fireEvent.pointerMove(box, { clientX: 200, clientY: 0, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
