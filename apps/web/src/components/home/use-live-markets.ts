'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SerializedMarket } from '@/lib/contract-data';

/** Refresh confirmed chain data without replacing the page or interrupting a wallet modal. */
export function useLiveMarkets(
  initialMarkets: SerializedMarket[],
  initialError?: string,
): {
  markets: SerializedMarket[];
  error: string | undefined;
  refresh: (force?: boolean) => Promise<void>;
} {
  const [markets, setMarkets] = useState(initialMarkets);
  const [error, setError] = useState(initialError);
  const mounted = useRef(false);
  const pending = useRef<AbortController | null>(null);

  const refresh = useCallback(async (force = true): Promise<void> => {
    if (!mounted.current || (!force && (pending.current || document.hidden))) return;
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    try {
      const response = await fetch('/api/markets?status=active', {
        cache: 'no-store',
        signal: request.signal,
      });
      if (!response.ok) throw new Error('Market refresh failed');
      const data = (await response.json()) as { markets?: SerializedMarket[] };
      if (!Array.isArray(data.markets)) throw new Error('Invalid market response');
      if (mounted.current && pending.current === request) {
        setMarkets(data.markets);
        setError(undefined);
      }
    } catch {
      if (mounted.current && pending.current === request && !request.signal.aborted)
        setError('Live market updates are temporarily unavailable. Retrying automatically.');
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Starts a network request; updates reflect its result, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(false);
    const timer = window.setInterval(() => void refresh(false), 5000);
    const resume = (): void => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      pending.current?.abort();
      pending.current = null;
    };
  }, [refresh]);

  return { markets, error, refresh };
}
