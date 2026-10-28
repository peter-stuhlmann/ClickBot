import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkerStatus } from './WorkerStatus';

describe('WorkerStatus', () => {
  it.each([
    [1, 'Worker online · 1 Lauf aktiv'],
    [3, 'Worker online · 3 Läufe aktiv'],
  ])('announces an online worker with %i active runs', (activeRuns, text) => {
    render(<WorkerStatus online activeRuns={activeRuns} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
    expect(screen.getByTestId('worker-dot')).toHaveClass('bg-online');
  });

  it('says plainly that runs wait while the worker is offline', () => {
    render(<WorkerStatus online={false} activeRuns={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Worker offline – Läufe warten');
    expect(screen.getByTestId('worker-dot')).toHaveClass('bg-sidebar-muted');
  });
});
