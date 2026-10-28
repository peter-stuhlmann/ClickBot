import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoMark } from './LogoMark';

describe('LogoMark', () => {
  it('is decorative, so screen readers read the product name next to it instead', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes its background from the primary colour token', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')).toHaveClass('text-primary');
  });
});
