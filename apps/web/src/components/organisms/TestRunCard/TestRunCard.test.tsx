import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TestRunView } from '@/lib/views';
import { TestRunCard } from './TestRunCard';

const HINT = 'Einmal auf Desktop in Chrome, sofort.';

const failed: TestRunView = {
  runId: 'run-1',
  href: '/laeufe/run-1',
  status: { tone: 'danger', label: 'Fehlgeschlagen' },
  open: false,
  where: 'Desktop · Chrome',
  message: 'Fehlgeschlagen bei Schritt 2.',
  failedIndex: 1,
  failedStep: 'Schritt 2 · Klicke auf „Kurse“',
  reason: 'Element nicht gefunden.',
};

describe('TestRunCard', () => {
  it('starts a test run of the flow', () => {
    const onStart = vi.fn();
    render(<TestRunCard run={null} hint={HINT} busy={false} onStart={onStart} />);
    expect(screen.getByRole('region', { name: 'Testlauf' })).toHaveTextContent(HINT);
    fireEvent.click(screen.getByRole('button', { name: 'Testlauf' }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('shows where and why the run failed, with the report to open', () => {
    render(<TestRunCard run={failed} hint={HINT} busy={false} onStart={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Fehlgeschlagen');
    expect(status).toHaveTextContent('Schritt 2 · Klicke auf „Kurse“');
    expect(status).toHaveTextContent('Element nicht gefunden.');
    expect(screen.getByRole('link', { name: 'Report öffnen' })).toHaveAttribute(
      'href',
      '/laeufe/run-1',
    );
    expect(screen.getByRole('button', { name: 'Erneut testen' })).toBeEnabled();
  });

  it('waits for an open run before another one, and shows why nothing started', () => {
    render(
      <TestRunCard
        run={{ ...failed, open: true, status: { tone: 'neutral', label: 'Läuft' } }}
        hint={HINT}
        busy={false}
        error="Bitte die markierten Angaben prüfen."
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Erneut testen' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte die markierten Angaben prüfen.');
  });

  it('shows the run live while it goes', () => {
    render(
      <TestRunCard
        run={{ ...failed, open: true, status: { tone: 'neutral', label: 'Läuft' } }}
        hint={HINT}
        busy={false}
        live={{
          frame: 'data:image/jpeg;base64,eA==',
          overlay: null,
          caption: 'Schritt 1 von 2 · Öffne beispiel.de',
        }}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Live-Bild des Durchlaufs' })).toBeVisible();
    expect(screen.getByText('Schritt 1 von 2 · Öffne beispiel.de')).toBeVisible();
  });

  it('is busy while the draft is saved and the run queued', () => {
    render(<TestRunCard run={null} hint={HINT} busy onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Testlauf' })).toHaveAttribute('aria-busy', 'true');
  });
});
