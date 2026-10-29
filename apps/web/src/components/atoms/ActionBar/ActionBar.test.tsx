import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('shows its buttons in the given order', () => {
    render(
      <ActionBar>
        <button type="button">Zurück</button>
        <button type="button">Weiter</button>
      </ActionBar>,
    );
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Zurück',
      'Weiter',
    ]);
  });
});
