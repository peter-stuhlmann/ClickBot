import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeyValueRow } from './KeyValueRow';

describe('KeyValueRow', () => {
  it('pairs the label with its value in a description list', () => {
    render(
      <dl>
        <KeyValueRow label="Kunde" value="Beispiel GmbH" />
      </dl>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Kunde');
    expect(screen.getByRole('definition')).toHaveTextContent('Beispiel GmbH');
  });
});
