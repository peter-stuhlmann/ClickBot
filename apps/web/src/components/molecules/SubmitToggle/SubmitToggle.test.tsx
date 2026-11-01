import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmitToggle } from './SubmitToggle';

describe('SubmitToggle', () => {
  it('sends the form and waits visibly until the action is done', async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(
      <form action={action}>
        <input type="hidden" name="jobId" value="job-1" />
        <SubmitToggle checked label="Kontakt pausieren" />
      </form>,
    );
    const toggle = screen.getByRole('switch', { name: 'Kontakt pausieren' });

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-busy', 'true'));
    expect(toggle).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();
    expect((action.mock.calls[0] as unknown[])[0]).toBeInstanceOf(FormData);

    finish();
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toHaveAttribute('aria-busy');
  });

  it('stays disabled when the caller disables it', () => {
    render(
      <form action={() => {}}>
        <SubmitToggle checked={false} disabled label="Beendet" />
      </form>,
    );
    expect(screen.getByRole('switch', { name: 'Beendet' })).toBeDisabled();
  });
});
