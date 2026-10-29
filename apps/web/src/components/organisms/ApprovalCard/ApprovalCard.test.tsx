import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from './ApprovalCard';

describe('ApprovalCard', () => {
  it('asks to confirm that the website may be tested', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ApprovalCard confirmed={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox', { name: /Kunde hat den Test freigegeben/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows why the job cannot be created without it', () => {
    render(
      <ApprovalCard
        confirmed={false}
        error="Bitte bestätigen, dass ihr diese Website testen dürft."
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Bitte bestätigen, dass ihr diese Website testen dürft.',
    );
  });
});
