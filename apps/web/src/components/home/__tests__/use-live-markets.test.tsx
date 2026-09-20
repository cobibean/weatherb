import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SerializedMarket } from '@/lib/contract-data';
import { useLiveMarkets } from '../use-live-markets';
const market: SerializedMarket = {
  id: '1',
  cityId: 'austin',
  cityName: 'Austin',
  latitude: 30,
  longitude: -97,
  resolveTime: 1800000000000,
  thresholdF_tenths: 960,
  currency: 'USDC',
  status: 'open',
  yesPool: '10000000000000000',
  noPool: '10000000000000000',
  totalFees: '0',
};
const fetchMock = vi.fn();
const response = (markets: SerializedMarket[]) => ({ ok: true, json: async () => ({ markets }) });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response([market]));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('updates pools from other wallets without a page reload', async () => {
  const { result } = renderHook(() => useLiveMarkets([market]));
  await act(async () => {});
  fetchMock.mockResolvedValue(response([{ ...market, yesPool: '30000000000000000' }]));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.markets[0]?.yesPool).toBe('30000000000000000');
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/markets?status=active',
    expect.objectContaining({ cache: 'no-store' }),
  );
});
it('refreshes immediately after a confirmed bet and ignores older in-flight results', async () => {
  let finish!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useLiveMarkets([market]));
  fetchMock.mockResolvedValue(response([{ ...market, noPool: '40000000000000000' }]));
  await act(async () => {
    await result.current.refresh();
  });
  await act(async () => {
    finish(response([market]));
  });
  expect(result.current.markets[0]?.noPool).toBe('40000000000000000');
});
it('keeps the last pool on failure and recovers, including terminal market removal', async () => {
  const { result } = renderHook(() => useLiveMarkets([market]));
  await act(async () => {});
  fetchMock.mockResolvedValueOnce({ ok: false });
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.markets).toEqual([market]);
  expect(result.current.error).toContain('Retrying');
  fetchMock.mockResolvedValue(response([]));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(result.current.markets).toEqual([]);
  expect(result.current.error).toBeUndefined();
});
it('pauses in hidden tabs, resumes on focus and cleans up on unmount', async () => {
  const { unmount } = renderHook(() => useLiveMarkets([market]));
  await act(async () => {});
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false);
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  unmount();
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
