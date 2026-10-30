import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LiveBrowser, type LiveBrowserProps } from './LiveBrowser';

const steps = [
  { typeLabel: 'Öffnen', tone: 'neutral' as const, title: 'Öffne beispiel.de', detail: 'url' },
  { typeLabel: 'Klicken', tone: 'primary' as const, title: 'Klicke auf „Kontakt“', detail: 'role' },
];

function props(overrides: Partial<LiveBrowserProps> = {}): LiveBrowserProps {
  return {
    status: 'live',
    frame: 'data:image/jpeg;base64,AAAA',
    url: 'https://beispiel.de/',
    viewport: { width: 1280, height: 800 },
    mode: 'record',
    steps,
    onStart: vi.fn(),
    onInput: vi.fn(),
    onRemoveStep: vi.fn(),
    onFinish: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('LiveBrowser', () => {
  it('explains the recording and starts it on request', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<LiveBrowser {...props({ status: 'idle', steps: [], onStart })} />);
    expect(screen.getByText(/Passwörter werden nie aufgezeichnet/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Aufnahme starten' }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('passes a click on the stream to the live browser, in its coordinates', () => {
    const onInput = vi.fn();
    render(<LiveBrowser {...props({ onInput })} />);
    const stream = screen.getByRole('application', { name: 'Live-Browser' });
    stream.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 400 }) as DOMRect;
    fireEvent.click(stream, { clientX: 320, clientY: 100 });
    expect(onInput).toHaveBeenCalledWith({ type: 'click', x: 640, y: 200 });
  });

  it('types into the live browser, with key combinations, and leaves copying alone', () => {
    const onInput = vi.fn();
    render(<LiveBrowser {...props({ onInput })} />);
    const stream = screen.getByRole('application', { name: 'Live-Browser' });
    fireEvent.keyDown(stream, { key: 'L' });
    fireEvent.keyDown(stream, { key: 'Enter' });
    fireEvent.keyDown(stream, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(stream, { key: 'c', ctrlKey: true });
    expect(onInput.mock.calls).toEqual([
      [{ type: 'text', text: 'L' }],
      [{ type: 'key', key: 'Enter' }],
      [{ type: 'key', key: 'Control+a' }],
    ]);
  });

  it('opens an address typed into the address bar', async () => {
    const user = userEvent.setup();
    const onInput = vi.fn();
    render(<LiveBrowser {...props({ onInput })} />);
    const address = screen.getByRole('textbox', { name: 'Adresse' });
    await user.clear(address);
    await user.type(address, 'beispiel.de/kontakt{Enter}');
    expect(onInput).toHaveBeenCalledWith({ type: 'navigate', url: 'https://beispiel.de/kontakt' });
  });

  it('goes back, forward and reloads', async () => {
    const user = userEvent.setup();
    const onInput = vi.fn();
    render(<LiveBrowser {...props({ onInput })} />);
    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    await user.click(screen.getByRole('button', { name: 'Vor' }));
    await user.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(onInput.mock.calls).toEqual([
      [{ type: 'back' }],
      [{ type: 'forward' }],
      [{ type: 'reload' }],
    ]);
  });

  it('always records; next to the address it takes a photo or turns the next click into a check', async () => {
    const user = userEvent.setup();
    const onInput = vi.fn();
    const { rerender } = render(<LiveBrowser {...props({ onInput })} />);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText(/Alles wird aufgezeichnet/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Bildschirmfoto aufnehmen' }));
    const check = screen.getByRole('button', { name: 'Prüfung hinzufügen' });
    expect(check).toHaveAttribute('aria-pressed', 'false');
    await user.click(check);
    expect(onInput.mock.calls).toEqual([
      [{ type: 'screenshot' }],
      [{ type: 'mode', mode: 'assert' }],
    ]);

    rerender(<LiveBrowser {...props({ onInput, mode: 'assert' })} />);
    expect(check).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Der nächste Klick wird eine Prüfung.')).toBeVisible();
  });

  it('lists the recorded steps, removes one and takes them over', async () => {
    const user = userEvent.setup();
    const onRemoveStep = vi.fn();
    const onFinish = vi.fn();
    render(<LiveBrowser {...props({ onRemoveStep, onFinish })} />);
    const recorded = screen.getByRole('region', { name: 'Aufgezeichnet' });
    expect(within(recorded).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Schritt 2 entfernen' }));
    expect(onRemoveStep).toHaveBeenCalledWith(1);
    await user.click(
      screen.getByRole('button', { name: 'Aufnahme beenden · 2 Schritte übernehmen' }),
    );
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('shows what went wrong and that the connection ended', () => {
    render(
      <LiveBrowser {...props({ status: 'ended', error: 'Die Aufnahme endet nach 15 Minuten.' })} />,
    );
    expect(screen.getByText('Die Aufnahme endet nach 15 Minuten.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Neu verbinden' })).toBeVisible();
  });
});
