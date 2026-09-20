import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Countdown, CountdownDetailed } from '../countdown';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-18T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Live countdown', () => {
  it('updates from the shared clock and stops its timer when unmounted', () => {
    const { unmount } = render(<Countdown resolveTime={Date.now() + 2000} />);
    expect(screen.getByText('2s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('1s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Resolving...')).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shares one timer across both displays', () => {
    render(
      <>
        <Countdown resolveTime={Date.now() + 60000} />
        <CountdownDetailed resolveTime={Date.now() + 60000} />
      </>,
    );
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(61000));
    expect(screen.getAllByText('Resolving...')).toHaveLength(2);
  });
});
