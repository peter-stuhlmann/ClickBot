import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '@/lib/views';
import { CampaignForm } from './CampaignForm';

describe('CampaignForm', () => {
  it('sends name, period and note', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: FormState, _data: FormData): Promise<FormState> => ({}));
    render(<CampaignForm projectName="Müller Shop" action={action} />);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Black Friday');
    await user.type(screen.getByLabelText('Start (optional)'), '20.11.2026');
    await user.type(screen.getByLabelText('Ende (optional)'), '30.11.26');
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
    expect(screen.getByLabelText('Start (optional)')).toHaveValue('20.11.2026');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toMatchObject({
      id: 'k1',
      name: 'Black Friday',
      startsOn: '2026-11-20',
      endsOn: '',
    });
  });

  describe('period', () => {
    afterEach(() => vi.useRealTimers());

    const newCampaign = () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-05T10:00:00Z'));
      const action = vi.fn(async (_state: FormState, _data: FormData): Promise<FormState> => ({}));
      render(<CampaignForm projectName="Müller Shop" action={action} />);
      return action;
    };
    const day = (name: string) => screen.getByRole('button', { name });

    it('opens the calendar of the end once the start is chosen, with no day before it', async () => {
      const user = userEvent.setup();
      newCampaign();
      await user.click(screen.getByRole('button', { name: 'Kalender für Start' }));
      await user.click(day('Freitag, 20. November 2026'));

      expect(screen.getByLabelText('Start (optional)')).toHaveValue('20.11.2026');
      expect(screen.getByRole('dialog', { name: 'Ende wählen' })).toBeInTheDocument();
      expect(day('Freitag, 20. November 2026')).toHaveFocus();
      expect(day('Donnerstag, 19. November 2026')).toBeDisabled();

      await user.click(day('Montag, 30. November 2026'));
      expect(screen.getByLabelText('Ende (optional)')).toHaveValue('30.11.2026');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // The same start once more: the end opens again, on its own month.
      await user.click(screen.getByRole('button', { name: 'Kalender für Start' }));
      await user.click(day('Freitag, 20. November 2026'));
      expect(screen.getByRole('dialog', { name: 'Ende wählen' })).toBeInTheDocument();
      expect(day('Montag, 30. November 2026')).toHaveFocus();
    });

    it('clears an end that no longer fits a later start', async () => {
      const user = userEvent.setup();
      newCampaign();
      await user.type(screen.getByLabelText('Ende (optional)'), '10.11.2026');
      await user.click(screen.getByRole('button', { name: 'Kalender für Start' }));
      await user.click(day('Freitag, 20. November 2026'));
      expect(screen.getByLabelText('Ende (optional)')).toHaveValue('');
    });

    it('refuses a typed end before the start, at the field and on sending', async () => {
      const user = userEvent.setup();
      const action = newCampaign();
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Sommer');
      await user.type(screen.getByLabelText('Start (optional)'), '20.11.2026');
      await user.type(screen.getByLabelText('Ende (optional)'), '19.11.2026');

      expect(screen.getByLabelText('Ende (optional)')).toHaveAccessibleDescription(
        'Das Ende liegt vor dem Start.',
      );
      await user.click(screen.getByRole('button', { name: 'Kampagne anlegen' }));
      expect(action).not.toHaveBeenCalled();
    });
  });
});
