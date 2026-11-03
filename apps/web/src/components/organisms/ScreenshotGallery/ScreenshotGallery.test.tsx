import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ScreenshotView } from '@/lib/views';
import { ScreenshotGallery } from './ScreenshotGallery';

const SHOTS: ScreenshotView[] = [
  { url: '/artifacts/runs/r/3-shot.png', step: 4, title: 'Bildschirmfoto' },
  { url: '/artifacts/runs/r/6-shot.png', step: 7, title: 'Bildschirmfoto' },
  { url: '/artifacts/runs/r/12-fail.png', step: 13, title: 'Klicke auf „Ablehnen“' },
];

const large = () => screen.getByRole('link', { name: /vergrößern$/ });
const thumbnails = () =>
  within(screen.getByRole('list', { name: 'Alle Bildschirmfotos' })).getAllByRole('link');
const thumbnail = (index: number) => {
  const link = thumbnails()[index];
  if (!link) throw new Error(`Kein Vorschaubild ${index}.`);
  return link;
};

describe('ScreenshotGallery', () => {
  it('shows the last screenshot large and all of them small below', () => {
    render(<ScreenshotGallery screenshots={SHOTS} />);
    expect(screen.getByRole('region', { name: 'Bildschirmfotos' })).toHaveTextContent('3 Bilder');
    expect(large()).toHaveAccessibleName('Schritt 13 · Klicke auf „Ablehnen“, vergrößern');
    expect(large()).toHaveAttribute('href', '/artifacts/runs/r/12-fail.png');
    expect(screen.getByText('3 / 3')).toBeVisible();

    expect(thumbnails().map((link) => link.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'true',
    ]);
    expect(thumbnail(0)).toHaveAccessibleName('Schritt 4 · Bildschirmfoto');
  });

  it('shows a screenshot large when its thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<ScreenshotGallery screenshots={SHOTS} />);
    await user.click(thumbnail(1));

    expect(large()).toHaveAttribute('href', '/artifacts/runs/r/6-shot.png');
    expect(screen.getByText('2 / 3')).toBeVisible();
    expect(thumbnail(1)).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the large one in the lightbox and keeps the one paged to', async () => {
    const user = userEvent.setup();
    render(<ScreenshotGallery screenshots={SHOTS} />);
    await user.click(thumbnail(0));
    await user.click(large());

    expect(screen.getByRole('dialog', { name: 'Schritt 4 · Bildschirmfoto' })).toBeVisible();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(large()).toHaveAttribute('href', '/artifacts/runs/r/6-shot.png');
  });

  it('opens the screenshot of a step from its link in the step list', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="#bildschirmfoto-7">Bildschirmfoto von Schritt 7</a>
        <a href="#bildschirmfoto-99">Unbekannt</a>
        <ScreenshotGallery screenshots={SHOTS} />
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Unbekannt' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Bildschirmfoto von Schritt 7' }));
    expect(screen.getByRole('dialog', { name: 'Schritt 7 · Bildschirmfoto' })).toBeVisible();
    // Taken over by the gallery: the address keeps no anchor of it.
    expect(window.location.hash).not.toBe('#bildschirmfoto-7');
    // Without JavaScript the link jumps to the thumbnail.
    expect(document.getElementById('bildschirmfoto-7')).toContainElement(thumbnail(1));
  });

  it('leaves a click with Ctrl or the middle button to the browser: the original in a new tab', () => {
    render(<ScreenshotGallery screenshots={SHOTS} />);
    expect(fireEvent.click(large(), { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(thumbnail(0), { button: 1 })).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(large()).toHaveAttribute('href', '/artifacts/runs/r/12-fail.png');
  });

  it('shows a single screenshot without thumbnails', () => {
    render(<ScreenshotGallery screenshots={SHOTS.slice(0, 1)} />);
    expect(screen.getByRole('region', { name: 'Bildschirmfoto' })).toBeVisible();
    expect(large()).toHaveAccessibleName('Schritt 4 · Bildschirmfoto, vergrößern');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
    expect(document.getElementById('bildschirmfoto-4')).toContainElement(large());
  });
});
