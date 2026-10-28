import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthLayout } from './AuthLayout';

describe('AuthLayout', () => {
  it('shows the logo, the title as the only level-1 heading and the content', () => {
    render(
      <AuthLayout title="Anmelden" description="Willkommen zurück.">
        <form aria-label="Anmelden" />
      </AuthLayout>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anmelden');
    expect(screen.getByText('Click-Bot')).toBeVisible();
    expect(screen.getByText('Willkommen zurück.')).toBeVisible();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('form'));
    expect(screen.getByText(/Testwerkzeug für eigene und freigegebene Websites/)).toBeVisible();
  });
});
