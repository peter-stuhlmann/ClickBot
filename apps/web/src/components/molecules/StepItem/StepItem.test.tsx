import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StepItemView } from '@/lib/views';
import { StepItem } from './StepItem';

const click: StepItemView = {
  typeLabel: 'Klicken',
  tone: 'primary',
  title: 'Klicke auf „Kontakt“',
  detail: 'text = "Kontakt"',
};

const handlers = () => ({
  onSelect: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onRemove: vi.fn(),
});

describe('StepItem', () => {
  it('shows number, type, title and locator of the step', () => {
    render(<StepItem index={1} step={click} selected={false} {...handlers()} />);
    const select = screen.getByRole('button', { name: 'Schritt 2: Klicke auf „Kontakt“' });
    expect(select).toHaveTextContent('2');
    expect(select).toHaveTextContent('Klicken');
    expect(select).toHaveTextContent('text = "Kontakt"');
    expect(screen.getByText('Klicken')).toHaveClass('bg-primary-soft');
  });

  it('is selected with a click and reports its selection', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<StepItem index={0} step={click} selected {...props} />);
    const select = screen.getByRole('button', { name: /^Schritt 1:/ });
    expect(select).toHaveAttribute('aria-pressed', 'true');

    await user.click(select);
    expect(props.onSelect).toHaveBeenCalledOnce();
  });

  it('moves and removes the step', async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(<StepItem index={1} step={click} selected={false} {...props} />);

    await user.click(screen.getByRole('button', { name: 'Schritt 2 nach oben' }));
    await user.click(screen.getByRole('button', { name: 'Schritt 2 nach unten' }));
    await user.click(screen.getByRole('button', { name: 'Schritt 2 löschen' }));

    expect(props.onMoveUp).toHaveBeenCalledOnce();
    expect(props.onMoveDown).toHaveBeenCalledOnce();
    expect(props.onRemove).toHaveBeenCalledOnce();
  });

  it('cannot move past the start or the end of the list', () => {
    const { onSelect, onRemove } = handlers();
    render(
      <StepItem index={0} step={click} selected={false} onSelect={onSelect} onRemove={onRemove} />,
    );
    expect(screen.getByRole('button', { name: 'Schritt 1 nach oben' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Schritt 1 nach unten' })).toBeDisabled();
  });

  it('marks a step with an error in red', () => {
    const { container } = render(
      <StepItem index={0} step={click} selected={false} invalid {...handlers()} />,
    );
    expect(container.firstChild).toHaveClass('border-danger');
  });
});
