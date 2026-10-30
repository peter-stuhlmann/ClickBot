import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, initials } from './Avatar';

describe('initials', () => {
  it.each([
    ['Peter Stuhlmann', 'PS'],
    ['Anna Maria Schmidt', 'AS'],
    ['  lena   schmidt ', 'LS'],
    ['Lena', 'LE'],
    ['', '?'],
  ])('turns %j into %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('shows the initials and stays out of the accessibility tree', () => {
    render(<Avatar name="Peter Stuhlmann" />);
    expect(screen.getByText('PS')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the picture instead of the initials, also hidden: the name stands beside it', () => {
    const { container } = render(<Avatar name="Peter Stuhlmann" src="/avatar/1?v=2" />);
    expect(screen.queryByText('PS')).not.toBeInTheDocument();
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', '/avatar/1?v=2');
    expect(image).toHaveAttribute('alt', '');
    expect(image?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('comes large for the profile page', () => {
    render(<Avatar name="Peter Stuhlmann" size="lg" />);
    expect(screen.getByText('PS')).toHaveClass('size-20');
  });
});
