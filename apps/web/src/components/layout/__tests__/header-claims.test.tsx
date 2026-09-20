import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Header } from '../header';
import { notifyPositionsUpdated } from '@/lib/position-events';

vi.mock('thirdweb/react', () => ({ useActiveAccount: () => ({ address: '0x123' }) }));
vi.mock('../wallet-button', () => ({ WalletButton: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const response = (claimable: boolean): Response =>
  ({
    ok: true,
    json: async () => ({
      positions: claimable ? [{ status: 'claimable', claimableAmount: '600000000000000000' }] : [],
    }),
  }) as Response;

describe('Claim notification badge', () => {
  it('clears immediately after confirmation and ignores an older in-flight snapshot', async () => {
    let finishOld!: (value: Response) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(true))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce(response(false));
    vi.stubGlobal('fetch', fetcher);
    render(<Header />);
    await waitFor(() => expect(screen.getByTitle('0.60 USDC to claim')).toBeInTheDocument());
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    act(() => notifyPositionsUpdated('0x123'));
    await waitFor(() => expect(screen.queryByTitle('0.60 USDC to claim')).toBeNull());
    await act(async () => {
      finishOld(response(true));
    });
    expect(screen.queryByTitle('0.60 USDC to claim')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });
  it('does not clear the badge for an unrelated wallet event', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal('fetch', fetcher);
    render(<Header />);
    await waitFor(() => expect(screen.getByTitle('0.60 USDC to claim')).toBeInTheDocument());
    act(() => notifyPositionsUpdated('0x456'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
