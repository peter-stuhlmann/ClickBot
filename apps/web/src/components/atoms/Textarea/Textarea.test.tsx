import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('takes several lines of text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea aria-label="Beschreibung" onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Beschreibung' });

    await user.type(field, 'Öffne{Enter}Klicke');
    expect(field).toHaveValue('Öffne\nKlicke');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows the error state through aria-invalid', () => {
    render(<Textarea aria-label="Beschreibung" aria-invalid />);
    expect(screen.getByRole('textbox')).toBeInvalid();
  });
});
