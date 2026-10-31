import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WaitMenu } from './WaitMenu';

function setup(picking = false) {
  const onInsert = vi.fn();
  const onPickElement = vi.fn();
  render(<WaitMenu picking={picking} onInsert={onInsert} onPickElement={onPickElement} />);
  return { onInsert, onPickElement, user: userEvent.setup() };
}

const opener = () => screen.getByRole('button', { name: 'Warten einfügen' });

describe('WaitMenu', () => {
  it('opens a small menu behind a button and closes on Escape', async () => {
    const { user } = setup();
    expect(opener()).toHaveAttribute('aria-expanded', 'false');
    await user.click(opener());
    expect(opener()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Warten' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Warten' })).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it('waits a number of seconds', async () => {
    const { user, onInsert } = setup();
    await user.click(opener());
    const seconds = screen.getByRole('textbox', { name: 'Sekunden' });
    await user.clear(seconds);
    await user.type(seconds, '1,5');
    await user.click(screen.getByRole('button', { name: 'Sekunden warten' }));
    expect(onInsert).toHaveBeenCalledWith({ kind: 'duration', ms: 1500 });
    expect(screen.queryByRole('group', { name: 'Warten' })).not.toBeInTheDocument();
  });

  it('refuses a time that is no number or longer than a minute', async () => {
    const { user, onInsert } = setup();
    await user.click(opener());
    const seconds = screen.getByRole('textbox', { name: 'Sekunden' });
    for (const value of ['', 'bald', '61', '0']) {
      await user.clear(seconds);
      if (value) await user.type(seconds, value);
      await user.click(screen.getByRole('button', { name: 'Sekunden warten' }));
      expect(seconds).toHaveAccessibleDescription('Zwischen 0,1 und 60 Sekunden.');
    }
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('waits until the page loads nothing more', async () => {
    const { user, onInsert } = setup();
    await user.click(opener());
    await user.click(screen.getByRole('button', { name: 'Bis die Seite nichts mehr lädt' }));
    expect(onInsert).toHaveBeenCalledWith({ kind: 'networkIdle' });
  });

  it('waits until a text shows', async () => {
    const { user, onInsert } = setup();
    await user.click(opener());
    await user.click(screen.getByRole('button', { name: 'Bis der Text erscheint' }));
    expect(onInsert).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Text' }), '  Vielen Dank ');
    await user.click(screen.getByRole('button', { name: 'Bis der Text erscheint' }));
    expect(onInsert).toHaveBeenCalledWith({ kind: 'text', text: 'Vielen Dank' });
  });

  it('lets the next click choose the element to wait for', async () => {
    const { user, onPickElement } = setup();
    await user.click(opener());
    await user.click(screen.getByRole('button', { name: /Bis ein Element erscheint/ }));
    expect(onPickElement).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: 'Warten' })).not.toBeInTheDocument();
  });

  it('shows while the next click chooses the element', () => {
    setup(true);
    expect(opener()).toHaveClass('text-primary');
  });

  it('closes on a click outside', async () => {
    const { user } = setup();
    await user.click(opener());
    await user.click(document.body);
    expect(screen.queryByRole('group', { name: 'Warten' })).not.toBeInTheDocument();
  });
});
