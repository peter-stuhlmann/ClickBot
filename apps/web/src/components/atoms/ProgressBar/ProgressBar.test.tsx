import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes its progress to assistive technology', () => {
    render(<ProgressBar value={0.35} label="Fortschritt Kontaktformular-Test" />);
    const bar = screen.getByRole('progressbar', { name: 'Fortschritt Kontaktformular-Test' });
    expect(bar).toHaveAttribute('aria-valuenow', '35');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('fills the track according to the value', () => {
    render(<ProgressBar value={0.35} label="Fortschritt" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '35%' });
  });

  it.each([
    [-0.2, '0'],
    [1.7, '100'],
  ])('clamps %f to %s %%', (value, expected) => {
    render(<ProgressBar value={value} label="Fortschritt" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected);
  });
});
