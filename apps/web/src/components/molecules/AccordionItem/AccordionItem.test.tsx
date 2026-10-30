import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccordionItem } from './AccordionItem';

const item = (open: boolean, onToggle = vi.fn()) => (
  <AccordionItem
    id="claude"
    title="Claude"
    description="console.anthropic.com → API Keys"
    aside={<span>Nicht eingerichtet</span>}
    open={open}
    onToggle={onToggle}
  >
    <label>
      Modell <input />
    </label>
  </AccordionItem>
);

describe('AccordionItem', () => {
  it('is a region named by its title, opened by a button with the same name', () => {
    render(item(false));
    expect(screen.getByRole('region', { name: 'Claude' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Claude' });
    expect(button).toHaveAccessibleDescription(
      'console.anthropic.com → API Keys Nicht eingerichtet',
    );
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps its content out of reach while closed, so Tab skips it', () => {
    render(item(false));
    const panel = document.getElementById(
      screen.getByRole('button', { name: 'Claude' }).getAttribute('aria-controls') as string,
    );
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveClass('grid-rows-collapsed');
  });

  it('shows its content while open', () => {
    render(item(true));
    expect(screen.getByRole('button', { name: 'Claude' })).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('textbox', { name: 'Modell' }).closest('[id]');
    expect(panel).not.toHaveAttribute('inert');
    expect(panel).toHaveClass('grid-rows-expanded');
  });

  it('asks to open or close on click and with the keyboard', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(item(false, onToggle));
    await user.click(screen.getByRole('button', { name: 'Claude' }));
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
