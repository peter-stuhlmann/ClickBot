import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('is a region named by its title, coloured by its tone', () => {
    render(
      <Notice tone="danger" title="Schritt 2 fehlgeschlagen">
        Element nicht gefunden.
      </Notice>,
    );
    const region = screen.getByRole('region', { name: 'Schritt 2 fehlgeschlagen' });
    expect(region).toHaveTextContent('Element nicht gefunden.');
    expect(region).toHaveClass('bg-danger-soft');
    expect(screen.getByRole('heading', { name: 'Schritt 2 fehlgeschlagen' })).toHaveClass(
      'text-danger',
    );
  });

  it('can warn instead', () => {
    render(
      <Notice tone="warning" title="Hinweis">
        Text
      </Notice>,
    );
    expect(screen.getByRole('region', { name: 'Hinweis' })).toHaveClass('bg-warning-soft');
  });
});
