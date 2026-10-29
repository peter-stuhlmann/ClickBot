import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorLayout } from './EditorLayout';

describe('EditorLayout', () => {
  it('shows header, buttons, message, settings and flow', () => {
    render(
      <EditorLayout
        header={<h1>Kontaktformular-Test</h1>}
        actions={<button type="button">Speichern</button>}
        message={<p role="status">Gespeichert.</p>}
        settings={<p>Zeitplan</p>}
      >
        <p>Schritte</p>
      </EditorLayout>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kontaktformular-Test');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert.');
    expect(screen.getByRole('region', { name: 'Einstellungen' })).toHaveTextContent('Zeitplan');
    expect(screen.getByRole('region', { name: 'Ablauf bearbeiten' })).toHaveTextContent('Schritte');
  });
});
