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

describe('CurveEditor tooltip', () => {
  const planned = Array.from({ length: 96 }, (_, quarter) => {
    if (quarter === 57) {
      return [
        { date: '2026-11-02', time: '14:22' },
        { date: '2026-11-09', time: '14:16' },
      ];
    }
    if (quarter === 58) return [{ date: '2026-11-02', time: '14:40' }];
    if (quarter === 59) {
      return ['01', '02', '03', '04', '05'].map((day) => ({
        date: `2026-11-${day}`,
        time: '14:50',
      }));
    }
    return [];
  });
  const props = { label: 'Verteilung am Montag', points: [...FLAT_CURVE], onChange: vi.fn() };

  function stubBox() {
    // jsdom has no layout: a 960 × 160 box at the origin, so 10 px are one quarter hour.
    slider().getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 960, height: 160, right: 960, bottom: 160 }) as DOMRect;
  }
  const hoverAt = (clientX: number) => fireEvent.pointerMove(slider(), { clientX, clientY: 80 });

  it('lists the starts of the quarter hour under the pointer', () => {
    render(<CurveEditor {...props} plannedByQuarter={planned} />);
    stubBox();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    hoverAt(575);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('14:15–14:30 Uhr');
    expect(tip).toHaveTextContent('2 Durchläufe');
    expect(tip).toHaveTextContent('02.11. um 14:22 Uhr');
    expect(tip).toHaveTextContent('09.11. um 14:16 Uhr');
    fireEvent.pointerLeave(slider());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says so when nothing starts, and counts a single run in the singular', () => {
    render(<CurveEditor {...props} plannedByQuarter={planned} />);
    stubBox();
    hoverAt(5);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Kein Durchlauf');
    hoverAt(585);
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 Durchlauf');
  });

  it('lists the first three starts and counts the rest', () => {
    render(<CurveEditor {...props} plannedByQuarter={planned} />);
    stubBox();
    hoverAt(595);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('5 Durchläufe');
    expect(tip).toHaveTextContent('03.11. um 14:50 Uhr');
    expect(tip).not.toHaveTextContent('04.11.');
    expect(tip).toHaveTextContent('und 2 weitere');
  });

  it('lists two runs that start in the same minute without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const same = planned.map((starts, quarter) =>
      quarter === 57
        ? [
            { date: '2026-11-04', time: '21:26' },
            { date: '2026-11-04', time: '21:26' },
          ]
        : starts,
    );
    render(<CurveEditor {...props} plannedByQuarter={same} />);
    stubBox();
    hoverAt(575);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 Durchläufe');
    expect(screen.getAllByText('04.11. um 21:26 Uhr')).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('follows new starts when the plan changes', () => {
    const { rerender } = render(<CurveEditor {...props} plannedByQuarter={planned} />);
    stubBox();
    hoverAt(575);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 Durchläufe');
    rerender(<CurveEditor {...props} plannedByQuarter={planned.map(() => [])} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Kein Durchlauf');
  });

  it('shows no tooltip without a plan', () => {
    render(<Harness />);
    stubBox();
    hoverAt(400);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
