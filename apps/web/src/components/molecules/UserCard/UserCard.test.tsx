import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('shows avatar, name and role', () => {
    render(<UserCard name="Peter Stuhlmann" role="Admin" />);
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.getByText('Peter Stuhlmann')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('logs out with a POST form, which works without JavaScript', () => {
    render(<UserCard name="Peter Stuhlmann" role="Admin" />);
    const button = screen.getByRole('button', { name: 'Abmelden' });
    expect(button).toHaveAttribute('type', 'submit');
    const form = button.closest('form');
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('action', '/abmelden');
  });
});
