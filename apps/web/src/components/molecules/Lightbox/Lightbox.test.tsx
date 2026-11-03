import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Lightbox, type LightboxImage } from './Lightbox';

const IMAGES: LightboxImage[] = [
  {
    url: '/artifacts/runs/r/0-open.png',
    alt: 'Bildschirmfoto von Schritt 1',
    caption: 'Schritt 1',
  },
  {
    url: '/artifacts/runs/r/4-shot.png',
    alt: 'Bildschirmfoto von Schritt 5',
    caption: 'Schritt 5',
  },
  {
    url: '/artifacts/runs/r/9-fail.png',
    alt: 'Bildschirmfoto von Schritt 10',
    caption: 'Schritt 10',
  },
];

function Controlled({ start = 0, onClose = vi.fn() }: { start?: number; onClose?: () => void }) {
  const [index, setIndex] = useState<number | null>(start);
  return (
    <Lightbox
      images={IMAGES}
      index={index}
      onIndexChange={setIndex}
      onClose={() => {
        setIndex(null);
        onClose();
      }}
    />
  );
}

describe('Lightbox', () => {
  it('shows the picture large, with what it shows, where it is and the original', () => {
    render(<Controlled start={1} />);
    const dialog = screen.getByRole('dialog', { name: 'Schritt 5' });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('img', { name: 'Bildschirmfoto von Schritt 5' })).toHaveAttribute(
      'src',
      '/artifacts/runs/r/4-shot.png',
    );
    expect(screen.getByText('2 / 3')).toBeVisible();
    const original = screen.getByRole('link', { name: 'Original in neuem Tab öffnen' });
    expect(original).toHaveAttribute('href', '/artifacts/runs/r/4-shot.png');
    expect(original).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus();
  });

  it('pages with the buttons and the arrow keys, and stops at either end', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByRole('button', { name: 'Vorheriges Bild' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Nächstes Bild' }));
    expect(screen.getByRole('dialog', { name: 'Schritt 5' })).toBeVisible();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Schritt 10' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nächstes Bild' })).toBeDisabled();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('3 / 3')).toBeVisible();

    await user.keyboard('{ArrowLeft}');
    await user.click(screen.getByRole('button', { name: 'Vorheriges Bild' }));
    expect(screen.getByRole('dialog', { name: 'Schritt 1' })).toBeVisible();
  });

  it('pages with a swipe on a touch screen', () => {
    render(<Controlled />);
    const picture = screen.getByRole('img', { name: 'Bildschirmfoto von Schritt 1' });
    fireEvent.touchStart(picture, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(picture, { changedTouches: [{ clientX: 120, clientY: 210 }] });
    expect(screen.getByRole('dialog', { name: 'Schritt 5' })).toBeVisible();

    // A tap, or a mostly vertical move, does not page.
    fireEvent.touchStart(picture, { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(picture, { changedTouches: [{ clientX: 290, clientY: 400 }] });
    fireEvent.touchStart(picture, { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(picture, { changedTouches: [{ clientX: 300, clientY: 200 }] });
    expect(screen.getByRole('dialog', { name: 'Schritt 1' })).toBeVisible();
  });

  it('closes with its button, with Escape and with a click beside the picture', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Controlled onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    // Escape closes a modal <dialog> in the browser; jsdom only fires its close event.
    rerender(<Controlled key="2" onClose={onClose} />);
    (screen.getByRole('dialog') as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<Controlled key="3" onClose={onClose} />);
    await user.click(screen.getByTestId('lightbox-stage'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows nothing while closed, and no paging for a single picture', () => {
    const { rerender } = render(
      <Lightbox images={IMAGES} index={null} onIndexChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(
      <Lightbox images={IMAGES.slice(0, 1)} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('img')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Nächstes Bild' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });
});
