import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders the named icon in the requested size', () => {
    const { container } = render(<Icon name="calendar" size={16} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'calendar');
    expect(svg).toHaveAttribute('width', '16');
  });

  it('defaults to the navigation size of 18 px', () => {
    const { container } = render(<Icon name="bot" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '18');
  });

  it('is hidden from screen readers', () => {
    const { container } = render(<Icon name="users" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
