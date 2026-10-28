import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MethodPicker } from './MethodPicker';

describe('MethodPicker', () => {
  it('chooses the step builder and marks the other three ways as planned', () => {
    render(<MethodPicker />);
    expect(screen.getByRole('button', { name: /Schritte zusammenklicken/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const planned of ['Mit KI beschreiben', 'Im Browser aufnehmen', 'Code schreiben']) {
      const card = screen.getByRole('button', { name: new RegExp(planned) });
      expect(card).toBeDisabled();
      expect(card).toHaveTextContent('geplant');
    }
  });
});
