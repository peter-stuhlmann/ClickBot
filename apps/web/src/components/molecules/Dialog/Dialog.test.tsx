import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog, useDialog } from './Dialog';

function CloseFromInside() {
  const dialog = useDialog();
  return (
    <button type="button" onClick={dialog?.close}>
      Abbrechen
    </button>
  );
}

function OutsideOfADialog() {
  return <p>{useDialog() ? 'im Dialog' : 'ohne Dialog'}</p>;
}

describe('Dialog', () => {
  it('opens behind an icon button that says what it opens', async () => {
    const user = userEvent.setup();
    render(
      <Dialog label="Kampagne bearbeiten" title="Kampagne bearbeiten">
        <p>Formular</p>
      </Dialog>,
    );
    const button = screen.getByRole('button', { name: 'Kampagne bearbeiten' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Kampagne bearbeiten' });
    expect(dialog).toHaveTextContent('Formular');

    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets what is inside close it, e.g. a cancel button of a form', async () => {
    const user = userEvent.setup();
    render(
      <Dialog label="Einstellungen" title="Einstellungen">
        <CloseFromInside />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on a click on the backdrop, not on one inside', async () => {
    const user = userEvent.setup();
    render(
      <Dialog label="Einstellungen" title="Einstellungen">
        <p>Inhalt</p>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }));
    await user.click(screen.getByText('Inhalt'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The backdrop belongs to the <dialog> element itself.
    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells components outside of a dialog that there is none', () => {
    render(<OutsideOfADialog />);
    expect(screen.getByText('ohne Dialog')).toBeInTheDocument();
  });

  it('puts the focus on the first field of its content', async () => {
    const user = userEvent.setup();
    render(
      <Dialog label="Einstellungen" title="Einstellungen">
        <input aria-label="Name" type="text" />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });
});
