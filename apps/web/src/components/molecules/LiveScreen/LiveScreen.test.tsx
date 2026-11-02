import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveScreen } from './LiveScreen';

describe('LiveScreen', () => {
  it('shows the picture of the run and the step it is at', () => {
    render(
      <LiveScreen
        frame="data:image/jpeg;base64,eA=="
        overlay={null}
        caption="Schritt 3 von 13 · Klicke auf „Kurse“"
      />,
    );
    expect(screen.getByRole('img', { name: 'Live-Bild des Durchlaufs' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,eA==',
    );
    expect(screen.getByText('Schritt 3 von 13 · Klicke auf „Kurse“')).toBeVisible();
  });

  it('says why there is no picture', () => {
    render(
      <LiveScreen
        frame={null}
        overlay="Ausgeblendet: Die Seite zeigt gerade Zugangsdaten."
        caption={null}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Ausgeblendet: Die Seite zeigt gerade Zugangsdaten.')).toBeVisible();
  });
});
