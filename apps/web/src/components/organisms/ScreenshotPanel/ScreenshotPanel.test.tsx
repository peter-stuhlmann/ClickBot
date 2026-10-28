import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenshotPanel } from './ScreenshotPanel';

describe('ScreenshotPanel', () => {
  it('shows the screenshot and opens it in full size', () => {
    render(
      <ScreenshotPanel url="/artifacts/runs/r/1-send.png" caption="Bildschirmfoto · Schritt 2" />,
    );
    expect(screen.getByRole('region', { name: 'Bildschirmfoto · Schritt 2' })).toBeVisible();
    const link = screen.getByRole('link', {
      name: 'Bildschirmfoto · Schritt 2, in voller Größe öffnen',
    });
    expect(link).toHaveAttribute('href', '/artifacts/runs/r/1-send.png');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/artifacts/runs/r/1-send.png');
  });
});
