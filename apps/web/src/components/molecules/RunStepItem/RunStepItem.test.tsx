import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RunStepView } from '@/lib/views';
import { RunStepItem } from './RunStepItem';

const step = (overrides: Partial<RunStepView> = {}): RunStepView => ({
  number: 2,
  status: 'passed',
  title: 'Klicke auf „Absenden“',
  detail: 'role = button, name = "Absenden"',
  duration: '0,6 s',
  screenshotUrl: null,
  ...overrides,
});

describe('RunStepItem', () => {
  it('shows title, locator and duration of a passed step', () => {
    render(<RunStepItem {...step()} />);
    expect(screen.getByText('Klicke auf „Absenden“')).toBeVisible();
    expect(screen.getByText('role = button, name = "Absenden"')).toHaveClass('font-mono');
    expect(screen.getByText('0,6 s')).toBeVisible();
    expect(screen.getByText('Schritt 2 bestanden')).toBeInTheDocument();
  });

  it.each([
    ['failed', 'Schritt 2 fehlgeschlagen'],
    ['healed', 'Schritt 2 mit KI-Hilfe bestanden'],
    ['skipped', 'Schritt 2 übersprungen'],
    ['pending', 'Schritt 2 noch offen'],
  ] as const)('names the status %s for screen readers', (status, label) => {
    render(<RunStepItem {...step({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the error of a failed step in red and links its screenshot', () => {
    render(
      <RunStepItem
        {...step({
          status: 'failed',
          detail: 'Element nicht gefunden.',
          screenshotUrl: '/artifacts/runs/r/1-send.png',
        })}
      />,
    );
    expect(screen.getByText('Element nicht gefunden.')).toHaveClass('text-danger');
    expect(screen.getByRole('link', { name: 'Bildschirmfoto von Schritt 2' })).toHaveAttribute(
      'href',
      '/artifacts/runs/r/1-send.png',
    );
  });

  it('lists what the AI did in an AI step, in order', () => {
    render(
      <RunStepItem
        {...step({
          title: 'Prüf das Impressum.',
          detail: '',
          aiActions: ['Klick auf Link „Impressum“: ok', 'Fertig: Alles da.'],
        })}
      />,
    );
    const list = screen.getByRole('list', { name: 'Aktionen der KI' });
    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Klick auf Link „Impressum“: ok',
      'Fertig: Alles da.',
    ]);
  });

  it('leaves out an empty detail line', () => {
    const { container } = render(<RunStepItem {...step({ detail: '' })} />);
    expect(container.querySelectorAll('.truncate')).toHaveLength(0);
  });
});
