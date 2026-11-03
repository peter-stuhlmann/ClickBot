import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VideoForm } from './VideoForm';

describe('VideoForm', () => {
  it('switches the video of the runs on and off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<VideoForm recordVideo={false} onChange={onChange} />);
    expect(screen.getByRole('region', { name: 'Video' })).toHaveTextContent(
      'Testläufe werden immer aufgenommen.',
    );
    const toggle = screen.getByRole('switch', { name: /Jeden Durchlauf als Video aufnehmen/ });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<VideoForm recordVideo onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: /Jeden Durchlauf als Video aufnehmen/ }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
