import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LiquidityPanel } from './liquidity-panel';

const base = {
  config: { version: 1, seedAmountUsdc: '2.50', maxActiveMarkets: 5, seedingEnabled: false,
    claimsEnabled: true, walletAddress: '0x0000000000000000000000000000000000000001', chainId: 5042002,
    firstEligibleMarketId: null, activationBlockNumber: null, activatedAt: null, canEdit: true, workerReady: true },
  balance: { amountUsdc: '0.00', observedAt: new Date().toISOString(), blockNumber: '100' },
  worker: { ready: true, stale: false, currentFailure: null, lastReconciledAt: null },
  slots: { held: 0, maximum: 5 },
  totals: { principalWei: '0', recoveredWei: '0', claimableWei: '0', gasWei: '0' },
  incidents: [{ id: 'funding', code: 'liquidity-funding-required', severity: 'WARNING', message: 'Fund the maker wallet.',
    contractMarketId: null, transactionHash: null, firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), occurrenceCount: 1 }],
  positions: [], activity: [], nextCursor: null, nextPositionCursor: null,
};
const response = (body: object, status = 200) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('liquidity Operations panel', () => {
  it('shows funding notice, 2.50 per side and 5.00 per market after loading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(base)));
    render(<LiquidityPanel />);
    expect(await screen.findByDisplayValue('2.50')).toBeInTheDocument();
    expect(screen.getByText(/5\.00 USDC per market/)).toBeInTheDocument();
    expect(screen.getByText('Fund the maker wallet.')).toBeInTheDocument();
    expect(screen.getByText('0.00 native USDC')).toBeInTheDocument();
  });

  it('keeps the draft visible when a concurrent edit conflicts', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'PATCH'
      ? response({ error: 'Settings changed; reload and reapply your edits' }, 409)
      : response(base));
    vi.stubGlobal('fetch', fetch);
    render(<LiquidityPanel />);
    const input = await screen.findByLabelText('Native USDC per side');
    fireEvent.change(input, { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save liquidity settings' }));
    expect(await screen.findByText('Settings changed; reload and reapply your edits')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload current settings' })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('keeps the original expected version when polling sees another admin edit', async () => {
    vi.useFakeTimers();
    let reads = 0;
    const patches: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        patches.push(JSON.parse(init.body as string) as Record<string, unknown>);
        return response({ error: 'Settings changed; reload and reapply your edits' }, 409);
      }
      reads++;
      return response({ ...base, config: { ...base.config, version: reads === 1 ? 1 : 2, seedAmountUsdc: reads === 1 ? '2.50' : '4.00' } });
    }));
    render(<LiquidityPanel />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByDisplayValue('2.50')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Native USDC per side'), { target: { value: '3.00' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByDisplayValue('3.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save liquidity settings' }));
    await act(async () => { await Promise.resolve(); });
    expect(patches).toEqual([{ expectedVersion: 1, seedAmountUsdc: '3.00' }]);
    expect(screen.getByDisplayValue('3.00')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('loads older activity without dropping the live notice', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('?cursor=older')
      ? response({ ...base, activity: [{ id: 'old', code: 'liquidity-claim-confirmed', message: 'Earlier refund verified', createdAt: new Date().toISOString() }], nextCursor: null })
      : response({ ...base, nextCursor: 'older' })));
    render(<LiquidityPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load older activity' }));
    expect(await screen.findByText(/Earlier refund verified/)).toBeInTheDocument();
    expect(screen.getByText('Fund the maker wallet.')).toBeInTheDocument();
  });
});
