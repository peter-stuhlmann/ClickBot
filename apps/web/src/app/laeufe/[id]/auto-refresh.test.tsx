import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoRefresh, REFRESH_MS } from './auto-refresh';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AutoRefresh', () => {
  it('reloads the page data every two seconds while the run is open', () => {
    render(<AutoRefresh active />);
    vi.advanceTimersByTime(REFRESH_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('stops once the run has finished', () => {
    const { rerender } = render(<AutoRefresh active />);
    vi.advanceTimersByTime(REFRESH_MS);
    rerender(<AutoRefresh active={false} />);
    vi.advanceTimersByTime(REFRESH_MS * 5);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a finished run', () => {
    render(<AutoRefresh active={false} />);
    vi.advanceTimersByTime(REFRESH_MS * 5);
    expect(refresh).not.toHaveBeenCalled();
  });
});
