import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('leads to the profile, marked while it is open', () => {
    const { rerender } = render(<UserCard name="Peter Stuhlmann" role="Admin" />);
    const link = screen.getByRole('link', { name: 'Profil: Peter Stuhlmann' });
    expect(link).toHaveAttribute('href', '/profil');
    expect(link).not.toHaveAttribute('aria-current');
    rerender(<UserCard name="Peter Stuhlmann" role="Admin" current />);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('shows the profile picture when there is one', () => {
    const { container } = render(
      <UserCard name="Peter Stuhlmann" role="Admin" avatarSrc="/avatar/1?v=2" />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', '/avatar/1?v=2');
  });

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
