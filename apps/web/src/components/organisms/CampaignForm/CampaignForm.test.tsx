import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormState } from '@/lib/views';
import { CampaignForm } from './CampaignForm';

describe('CampaignForm', () => {
  it('sends name, period and note', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: FormState, _data: FormData): Promise<FormState> => ({}));
    render(<CampaignForm projectName="Müller Shop" action={action} />);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Black Friday');
    await user.type(screen.getByLabelText('Start (optional)'), '2026-11-20');
    await user.type(screen.getByLabelText('Ende (optional)'), '2026-11-30');
    await user.type(
      screen.getByRole('textbox', { name: 'Notiz (optional)' }),
      'Rabattcode prüfen.',
    );
    await user.click(screen.getByRole('button', { name: 'Kampagne anlegen' }));

    const data = action.mock.calls[0]?.[1] as FormData;
    expect(Object.fromEntries(data.entries())).toEqual({
      name: 'Black Friday',
      startsOn: '2026-11-20',
      endsOn: '2026-11-30',
      description: 'Rabattcode prüfen.',
    });
  });

  it('names the project the campaign is created in', () => {
    render(<CampaignForm projectName="Müller Shop" action={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Neue Kampagne' })).toHaveTextContent('Müller Shop');
  });

  it('shows the problems at their fields and keeps what was typed', async () => {
    const user = userEvent.setup();
    render(
      <CampaignForm
        projectName="Müller Shop"
        action={async () => ({
          fieldErrors: { name: 'Diese Kampagne gibt es in diesem Projekt schon.' },
          values: { name: 'Sommer', startsOn: '', endsOn: '', description: '' },
        })}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Sommer');
    await user.click(screen.getByRole('button', { name: 'Kampagne anlegen' }));
    const name = await screen.findByRole('textbox', {
      name: 'Name',
      description: 'Diese Kampagne gibt es in diesem Projekt schon.',
    });
    expect(name).toHaveValue('Sommer');
  });

  it('changes an existing campaign', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: FormState, _data: FormData): Promise<FormState> => ({}));
    render(
      <CampaignForm
        projectName="Müller Shop"
        action={action}
        campaign={{
          id: 'k1',
          name: 'Black Friday',
          startsOn: '2026-11-20',
          endsOn: null,
          description: null,
        }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Black Friday');
    expect(screen.getByLabelText('Start (optional)')).toHaveValue('2026-11-20');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toMatchObject({
      id: 'k1',
      name: 'Black Friday',
      startsOn: '2026-11-20',
      endsOn: '',
    });
  });
});
