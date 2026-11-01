import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('shows busy while the form action runs, and is a normal button again afterwards', async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <form action={action}>
        <SubmitButton>Speichern</SubmitButton>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button).toHaveAttribute('type', 'submit');

    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'true'));
    expect(button).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();

    finish();
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
    expect(button).toBeEnabled();
  });
});
