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
  screenshotHref: null,
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
          screenshotHref: '#bildschirmfoto-2',
        })}
      />,
    );
    expect(screen.getByText('Element nicht gefunden.')).toHaveClass('text-danger');
    expect(screen.getByRole('link', { name: 'Bildschirmfoto von Schritt 2' })).toHaveAttribute(
      'href',
      '#bildschirmfoto-2',
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

  it('shows each sub-goal of a free test with its verdict and what the AI saw', () => {
    render(
      <RunStepItem
        {...step({
          status: 'unclear',
          title: 'Newsletter-Anmeldung funktioniert.',
          detail: 'Nicht prüfbar: Die Anmeldung kommt an. Captcha.',
          aiVerdict: [
            { goal: 'Es gibt einen blauen Button.', status: 'met', evidence: 'Oben rechts.' },
            { goal: 'Ungültige Adressen werden abgelehnt.', status: 'failed', evidence: 'Nein.' },
            { goal: 'Die Anmeldung kommt an.', status: 'unknown', evidence: 'Captcha.' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Schritt 2 nicht ganz prüfbar')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Ergebnis der KI' });
    expect([...list.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'ErfülltEs gibt einen blauen Button.Oben rechts.',
      'Nicht erfülltUngültige Adressen werden abgelehnt.Nein.',
      'Nicht prüfbarDie Anmeldung kommt an.Captcha.',
    ]);
  });

  it('leaves out an empty detail line', () => {
    const { container } = render(<RunStepItem {...step({ detail: '' })} />);
    expect(container.querySelectorAll('.truncate')).toHaveLength(0);
  });

  it('puts the Testergebnis of a free test above its sub-goals, with the measured values', () => {
    render(
      <RunStepItem
        {...step({
          status: 'passed',
          title: 'Prüfe die Schriftfarbe der h1.',
          aiSummary: 'h1-Überschriften sind rot (#C80000)',
          aiVerdict: [
            { goal: 'Die h1 ist rot.', status: 'met', evidence: 'rgb(200, 0, 0) / #C80000' },
          ],
        })}
      />,
    );
    const summary = screen.getByText('Testergebnis:').parentElement as HTMLElement;
    expect(summary).toHaveTextContent('Testergebnis: h1-Überschriften sind rot (#C80000)');
    const list = screen.getByRole('list', { name: 'Ergebnis der KI' });
    expect(summary.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Testergebnis for a step without one', () => {
    render(<RunStepItem {...step({ status: 'passed' })} />);
    expect(screen.queryByText('Testergebnis:')).not.toBeInTheDocument();
  });
});
