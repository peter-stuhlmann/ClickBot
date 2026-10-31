import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('passes typed text to onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="Name des Tests" onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Name des Tests' }), 'Test');

    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('shows the error state through aria-invalid', () => {
    render(<Input aria-label="Adresse der Website" aria-invalid />);
    const input = screen.getByRole('textbox', { name: 'Adresse der Website' });
    expect(input).toBeInvalid();
    expect(input).toHaveClass('aria-invalid:border-danger');
  });

  it('uses the code font for technical values', () => {
    render(<Input aria-label="Selektor" mono />);
    expect(screen.getByRole('textbox')).toHaveClass('font-mono');
  });
});
