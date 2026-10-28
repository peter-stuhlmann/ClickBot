import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps a font-size token and a text colour token side by side', () => {
    expect(cn('text-body text-text-muted')).toBe('text-body text-text-muted');
  });

  it('lets a later font-size token override an earlier one', () => {
    expect(cn('text-body', 'text-small')).toBe('text-small');
  });

  it('lets a later colour token override an earlier one', () => {
    expect(cn('bg-primary', 'bg-danger')).toBe('bg-danger');
  });

  it('drops falsy values', () => {
    expect(cn('px-4', false, undefined, null, 'py-2')).toBe('px-4 py-2');
  });
});
