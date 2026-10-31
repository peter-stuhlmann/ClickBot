import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AdBlockingForm } from './AdBlockingForm';

function Harness({ onChange = () => {} }: { onChange?: (blockAds: boolean) => void }) {
  const [blockAds, setBlockAds] = useState(true);
  return (
    <AdBlockingForm
      blockAds={blockAds}
      onChange={(next) => {
        setBlockAds(next);
        onChange(next);
      }}
    />
  );
}

describe('AdBlockingForm', () => {
  it('blocks ads by default, without a warning', () => {
    render(<Harness />);
    expect(screen.getByRole('switch', { name: /Werbung blockieren/ })).toBeChecked();
    expect(screen.queryByText(/zählen als Impressionen/)).not.toBeInTheDocument();
  });

  it('warns clearly when ads are allowed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: /Werbung blockieren/ }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText('Anzeigen zählen als Impressionen')).toBeVisible();
    expect(screen.getByText(/ungültige Zugriffe/)).toBeVisible();
  });
});
