import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NO_AI_COST } from '@/lib/cost';
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
  video: null,
  summary: null,
  cost: NO_AI_COST,
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

  it('shows the video of the run once it is done, to play or download', () => {
    const { container } = render(
      <TestRunCard
        run={{
          ...failed,
          video: {
            url: '/artifacts/runs/run-1/video.mp4',
            captionsUrl: '/laeufe/run-1/untertitel',
            fileName: 'kurse-durchlauf-3.mp4',
          },
        }}
        hint={HINT}
        busy={false}
        onStart={vi.fn()}
      />,
    );
    expect(container.querySelector('video')).toHaveAttribute(
      'src',
      '/artifacts/runs/run-1/video.mp4',
    );
    expect(screen.getByRole('link', { name: 'Video herunterladen' })).toHaveAttribute(
      'download',
      'kurse-durchlauf-3.mp4',
    );
  });

  it('says that an open run is recorded as a video', () => {
    const { container } = render(
      <TestRunCard
        run={{ ...failed, open: true, status: { tone: 'neutral', label: 'Läuft' } }}
        hint={HINT}
        busy={false}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Wird als Video aufgenommen.');
    expect(container.querySelector('video')).toBeNull();
  });

  it('is busy while the draft is saved and the run queued', () => {
    render(<TestRunCard run={null} hint={HINT} busy onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Testlauf' })).toHaveAttribute('aria-busy', 'true');
  });

  it('has a coin button for the cost of the run, once there is a run', () => {
    const { rerender } = render(
      <TestRunCard run={null} hint={HINT} busy={false} onStart={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'KI-Kosten dieses Testlaufs' })).toBeNull();
    rerender(<TestRunCard run={failed} hint={HINT} busy={false} onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'KI-Kosten dieses Testlaufs' })).toBeInTheDocument();
  });

  it('states the result of a free test unmistakably, as "Testergebnis"', () => {
    render(
      <TestRunCard
        run={{
          ...failed,
          status: { tone: 'success', label: 'Bestanden' },
          failedStep: null,
          reason: null,
          summary: 'h1-Überschriften sind rot (#C80000)',
        }}
        hint={HINT}
        busy={false}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByText('Testergebnis:').parentElement).toHaveTextContent(
      'Testergebnis: h1-Überschriften sind rot (#C80000)',
    );
  });

  it('shows no Testergebnis for a test without one', () => {
    render(<TestRunCard run={failed} hint={HINT} busy={false} onStart={vi.fn()} />);
    expect(screen.queryByText('Testergebnis:')).not.toBeInTheDocument();
  });
});
