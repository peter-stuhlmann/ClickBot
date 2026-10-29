import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartUrlCard } from './StartUrlCard';

describe('StartUrlCard', () => {
  it('asks where the test starts and reports what is typed', () => {
    const onChange = vi.fn();
    render(<StartUrlCard value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Website (Start-URL)' }), {
      target: { value: 'beispiel.de' },
    });
    expect(onChange).toHaveBeenCalledWith('beispiel.de');
  });

  it('shows the error at the field', () => {
    render(
      <StartUrlCard
        value="ftp://x"
        error="Start-URL muss mit http:// oder https:// beginnen."
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Website (Start-URL)' })).toBeInvalid();
    expect(screen.getByText('Start-URL muss mit http:// oder https:// beginnen.')).toBeVisible();
  });
});
