import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a plain button by default, so it never submits a surrounding form by accident', () => {
    render(<Button>Speichern</Button>);
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute('type', 'button');
  });

  it('can be a submit button', () => {
    render(<Button type="submit">Anmelden</Button>);
    expect(screen.getByRole('button', { name: 'Anmelden' })).toHaveAttribute('type', 'submit');
  });

  it('calls onClick on click and on keyboard activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Jetzt ausführen</Button>);

    await user.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('does not react when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Speichern
      </Button>,
    );

    await user.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('while loading: keeps its name, announces busy state and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Speichern' });

    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    ['primary', 'bg-primary'],
    ['secondary', 'bg-surface'],
    ['danger', 'bg-danger'],
    ['ghost', 'bg-transparent'],
  ] as const)('renders the %s variant with token classes', (variant, expectedClass) => {
    render(<Button variant={variant}>Aktion</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('stretches to the full width when asked', () => {
    render(<Button fullWidth>Anmelden</Button>);
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('renders leading icon content without changing the accessible name', () => {
    render(<Button icon={<svg aria-hidden="true" />}>Neuer Test</Button>);
    expect(screen.getByRole('button', { name: 'Neuer Test' })).toBeInTheDocument();
  });

  it('lets a caller override spacing without duplicate padding classes', () => {
    render(<Button className="px-8">Aktion</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-8');
    expect(button).not.toHaveClass('px-4');
  });

  it('renders a link styled as a button when given an href', () => {
    render(
      <Button href="/" variant="secondary">
        Abbrechen
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Abbrechen' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveClass('bg-surface');
  });
});
