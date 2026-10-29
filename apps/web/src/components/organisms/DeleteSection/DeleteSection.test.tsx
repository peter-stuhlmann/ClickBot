import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormState } from '@/lib/views';
import { DeleteSection, type DeleteSectionProps } from './DeleteSection';

function props(overrides: Partial<DeleteSectionProps> = {}): DeleteSectionProps {
  return {
    title: 'Kampagne löschen',
    description: 'Die Kampagne verschwindet aus dem Projekt.',
    buttonLabel: 'Kampagne löschen',
    fields: { id: 'k1' },
    action: vi.fn(async (): Promise<FormState> => ({})),
    ...overrides,
  };
}

describe('DeleteSection', () => {
  it('asks once more before deleting, and can be called off', async () => {
    const user = userEvent.setup();
    render(<DeleteSection {...props()} />);
    await user.click(screen.getByRole('button', { name: 'Kampagne löschen' }));
    expect(screen.getByText(/lässt sich nicht rückgängig machen/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('button', { name: 'Endgültig löschen' })).not.toBeInTheDocument();
  });

  it('sends the hidden fields to the action on confirmation', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: FormState, _data: FormData): Promise<FormState> => ({}));
    render(<DeleteSection {...props({ action })} />);
    await user.click(screen.getByRole('button', { name: 'Kampagne löschen' }));
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toEqual({
      id: 'k1',
    });
  });

  it('shows why deleting did not work', async () => {
    const user = userEvent.setup();
    render(
      <DeleteSection
        {...props({ action: async () => ({ error: 'Die Kampagne hat noch 1 Job.' }) })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Kampagne löschen' }));
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kampagne hat noch 1 Job.');
  });

  it('explains why deleting is not possible right now', () => {
    render(<DeleteSection {...props({ blocked: 'Die Kampagne hat noch 2 Jobs.' })} />);
    expect(screen.getByRole('button', { name: 'Kampagne löschen' })).toBeDisabled();
    expect(screen.getByText('Die Kampagne hat noch 2 Jobs.')).toBeVisible();
  });
});
