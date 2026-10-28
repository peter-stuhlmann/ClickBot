import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('passes typed text to onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Job-Name" onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Job-Name' }), 'Test');

    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('shows the error state through aria-invalid', () => {
    render(<Input aria-label="Start-URL" aria-invalid />);
    const input = screen.getByRole('textbox', { name: 'Start-URL' });
    expect(input).toBeInvalid();
    expect(input).toHaveClass('aria-invalid:border-danger');
  });

  it('uses the code font for technical values', () => {
    render(<Input aria-label="Selektor" mono />);
    expect(screen.getByRole('textbox')).toHaveClass('font-mono');
  });
});
