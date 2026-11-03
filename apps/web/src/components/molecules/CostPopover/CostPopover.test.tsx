import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CostView } from '@/lib/views';
import { CostPopover } from './CostPopover';

const cost: CostView = {
  model: 'Claude · claude-x',
  rows: [
    { label: 'Eingabe', tokens: '200.000', price: '0,60 $' },
    { label: 'Ausgabe', tokens: '10.000', price: '0,15 $' },
    { label: 'Zwischengespeichert', tokens: '1.000.000', price: '0,30 $' },
  ],
  total: '1,05 $',
  note: null,
};

const button = () => screen.getByRole('button', { name: 'KI-Kosten von Kontakt-Test' });

describe('CostPopover', () => {
  it('is closed until the coin button is pressed', () => {
    render(<CostPopover label="KI-Kosten von Kontakt-Test" cost={cost} />);
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows tokens and price for input, output and cached tokens, and the total', async () => {
    const user = userEvent.setup();
    render(<CostPopover label="KI-Kosten von Kontakt-Test" cost={cost} />);
    await user.click(button());

    expect(button()).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'KI-Kosten von Kontakt-Test' });
    expect(panel).toHaveTextContent('Claude · claude-x');
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows).toEqual([
      'ArtTokenPreis',
      'Eingabe200.000 Token0,60 $',
      'Ausgabe10.000 Token0,15 $',
      'Zwischengespeichert1.000.000 Token0,30 $',
      'Gesamt1,05 $',
    ]);
  });

  it('says why something is missing: a model without a price, or a test without AI', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CostPopover
        label="KI-Kosten von Kontakt-Test"
        cost={{ ...cost, total: '–', note: 'Kein Preis hinterlegt für Claude · claude-x.' }}
      />,
    );
    await user.click(button());
    expect(screen.getByRole('dialog')).toHaveTextContent('Kein Preis hinterlegt');

    rerender(
      <CostPopover
        label="KI-Kosten von Kontakt-Test"
        cost={{ model: null, rows: [], total: '–', note: 'Kein KI-Aufruf, also keine Kosten.' }}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Kein KI-Aufruf, also keine Kosten.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('closes with a second press, with Escape (focus back on the button) and on a click outside', async () => {
    const user = userEvent.setup();
    render(
      <>
        <CostPopover label="KI-Kosten von Kontakt-Test" cost={cost} />
        <p>Daneben</p>
      </>,
    );
    await user.click(button());
    await user.click(button());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(button());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button()).toHaveFocus();

    await user.click(button());
    fireEvent.pointerDown(screen.getByText('Daneben'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open for a click inside the panel', async () => {
    const user = userEvent.setup();
    render(<CostPopover label="KI-Kosten von Kontakt-Test" cost={cost} />);
    await user.click(button());
    await user.click(screen.getByText('KI-Kosten'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
