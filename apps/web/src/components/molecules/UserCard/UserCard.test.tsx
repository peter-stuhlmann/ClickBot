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
});
