import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TemplateDetailsForm } from './TemplateDetailsForm';

describe('TemplateDetailsForm', () => {
  it('changes name and description and shows their problems', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TemplateDetailsForm
        values={{ name: '', description: '' }}
        errors={{ name: 'Name fehlt.' }}
        onChange={onChange}
      />,
    );
    const name = screen.getByRole('textbox', { name: 'Name der Vorlage' });
    expect(name).toHaveAccessibleDescription('Name fehlt.');
    await user.type(name, 'K');
    expect(onChange).toHaveBeenLastCalledWith({ name: 'K' });
    await user.type(screen.getByRole('textbox', { name: 'Beschreibung (optional)' }), 'F');
    expect(onChange).toHaveBeenLastCalledWith({ description: 'F' });
    expect(screen.getByText(/Seiten der Website trägst du als Pfad ein/)).toBeInTheDocument();
  });
});
