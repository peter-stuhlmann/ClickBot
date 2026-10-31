import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveTemplateCard } from './SaveTemplateCard';

describe('SaveTemplateCard', () => {
  it('sends the job with name and note, and links the new template', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: unknown, data: FormData) => {
      expect(Object.fromEntries(data)).toEqual({
        jobId: 'job-1',
        name: 'Kontaktformular',
        description: 'Für Kundenseiten',
      });
      return { notice: 'Vorlage „Kontaktformular“ gespeichert.', link: '/vorlagen/v1' };
    });
    render(<SaveTemplateCard jobId="job-1" defaultName="Kontaktformular" action={action} />);

    expect(screen.getByRole('textbox', { name: 'Name der Vorlage' })).toHaveValue(
      'Kontaktformular',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Beschreibung (optional)' }),
      'Für Kundenseiten',
    );
    await user.click(screen.getByRole('button', { name: 'Vorlage erstellen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Vorlage „Kontaktformular“ gespeichert.',
    );
    expect(screen.getByRole('link', { name: 'Vorlage öffnen' })).toHaveAttribute(
      'href',
      '/vorlagen/v1',
    );
  });

  it('shows the problems and keeps what was typed', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      fieldErrors: { name: 'Eine Vorlage mit diesem Namen gibt es schon.' },
      values: { name: 'Login', description: 'x' },
    }));
    render(<SaveTemplateCard jobId="job-1" defaultName="Login" action={action} />);
    await user.click(screen.getByRole('button', { name: 'Vorlage erstellen' }));
    // The field is there before the action answers: wait for the message, not the field.
    await screen.findByText('Eine Vorlage mit diesem Namen gibt es schon.');
    expect(screen.getByRole('textbox', { name: 'Name der Vorlage' })).toHaveAccessibleDescription(
      'Eine Vorlage mit diesem Namen gibt es schon.',
    );
    expect(screen.getByRole('textbox', { name: 'Beschreibung (optional)' })).toHaveValue('x');
  });

  it('cannot save while the job has unsaved changes', () => {
    render(
      <SaveTemplateCard
        jobId="job-1"
        defaultName="Login"
        action={vi.fn()}
        blocked="Erst den Job speichern."
      />,
    );
    expect(screen.getByRole('button', { name: 'Vorlage erstellen' })).toBeDisabled();
    expect(screen.getByText('Erst den Job speichern.')).toBeInTheDocument();
  });
});
