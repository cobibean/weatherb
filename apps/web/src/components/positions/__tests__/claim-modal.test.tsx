import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { POSITIONS_UPDATED } from '@/lib/position-events';
import { ClaimModal } from '../claim-modal';
import { BulkClaimModal } from '../bulk-claim-modal';
import type { UserPosition } from '@/types/positions';
const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  send: vi.fn(),
  confirm: vi.fn(),
  preflight: vi.fn(),
}));
vi.mock('@/lib/arc-wallet', () => ({
  appChain: { id: 5042002 },
  prepareArcAction: mocks.preflight,
  confirmArcTransaction: mocks.confirm,
}));
vi.mock('thirdweb', () => ({
  defineChain: vi.fn(),
  createThirdwebClient: vi.fn(() => ({})),
  getContract: vi.fn(() => ({})),
  prepareContractCall: mocks.prepare,
}));
vi.mock('thirdweb/react', () => ({
  useActiveWallet: () => ({}),
  useActiveAccount: () => ({ address: '0x123' }),
  useSendTransaction: () => ({ mutateAsync: mocks.send, isPending: false }),
}));
const position: UserPosition = {
  marketId: '7',
  cityName: 'New York',
  cityId: 'nyc',
  latitude: 1,
  longitude: 2,
  thresholdTenths: 850,
  resolveTime: 0,
  betSide: 'BOTH',
  betAmount: 3000000000000000000n,
  claimableAmount: 3000000000000000000n,
  status: 'refundable',
  claimed: false,
  yesPool: 1000000000000000000n,
  noPool: 2000000000000000000n,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.send.mockResolvedValue({ transactionHash: '0xreceipt' });
});
afterEach(cleanup);
describe('Claim modal transaction selection', () => {
  it('submits claim() for a refund, which supports both Cancelled and NoWinners', async () => {
    render(<ClaimModal position={position} isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Refund 3.000/ }));
    await waitFor(() =>
      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'function claim(uint256 marketId)', params: [7n] }),
      ),
    );
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('submits claim() for winnings as well', async () => {
    render(
      <ClaimModal position={{ ...position, status: 'claimable' }} isOpen onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Claim 3.000/ }));
    await waitFor(() =>
      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'function claim(uint256 marketId)' }),
      ),
    );
  });
});

it('bulk-claims refundable stakes using the same supported method', async () => {
  render(<BulkClaimModal claimablePositions={[position]} isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Claim All/ }));
  await waitFor(() =>
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'function claim(uint256 marketId)', params: [7n] }),
    ),
  );
});

it('does not report success until the receipt is confirmed', async () => {
  let confirm!: () => void;
  mocks.confirm.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
  );
  const updated = vi.fn();
  window.addEventListener(POSITIONS_UPDATED, updated);
  render(<ClaimModal position={position} isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Refund 3.000/ }));
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
  expect(updated).not.toHaveBeenCalled();
  expect(screen.queryByText(/You received/)).toBeNull();
  confirm();
  await waitFor(() => expect(screen.getByText(/You received/)).toBeInTheDocument());
  expect(updated).toHaveBeenCalledTimes(1);
  window.removeEventListener(POSITIONS_UPDATED, updated);
});
it('shows a rejected signature and allows retry', async () => {
  mocks.send.mockRejectedValueOnce(new Error('User rejected request'));
  render(<ClaimModal position={position} isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Refund 3.000/ }));
  await waitFor(() =>
    expect(screen.getByText('Transaction was cancelled by user.')).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole('button', { name: /Refund 3.000/ }));
  await waitFor(() => expect(screen.getByText(/You received/)).toBeInTheDocument());
});
