import { beforeEach, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  chain: vi.fn(),
  read: vi.fn(),
  estimate: vi.fn(),
  fees: vi.fn(),
  balance: vi.fn(),
  simulate: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock('thirdweb', () => ({ defineChain: (value: unknown) => value }));
vi.mock('viem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => ({
    getChainId: mock.chain,
    readContract: mock.read,
    estimateGas: mock.estimate,
    estimateFeesPerGas: mock.fees,
    getBalance: mock.balance,
    simulateContract: mock.simulate,
    waitForTransactionReceipt: mock.receipt,
  }),
}));
import { prepareArcBet, prepareArcAction, confirmArcTransaction } from '../arc-wallet';
import type { Wallet } from 'thirdweb/wallets';
const address = '0x0000000000000000000000000000000000000002';
function wallet(chain = 114) {
  const w = {
    getAccount: () => ({ address }),
    getChain: () => ({ id: chain }),
    switchChain: vi.fn(async () => {
      chain = 5042002;
    }),
  };
  return w;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.chain.mockResolvedValue(5042002);
  mock.read.mockImplementation(({ functionName }: { functionName: string }) =>
    Promise.resolve(
      functionName === 'version' ? '2.2.0' : functionName === 'minBetWei' ? 10n ** 16n : 100n,
    ),
  );
  mock.estimate.mockResolvedValue(21000n);
  mock.fees.mockResolvedValue({ maxFeePerGas: 1000n });
  mock.balance.mockResolvedValue(10n ** 18n);
  mock.receipt.mockResolvedValue({ status: 'success' });
});
it('switches the wallet to Arc before simulation', async () => {
  const w = wallet();
  await prepareArcBet(w as unknown as Wallet, address, 0n, true, 10n ** 16n);
  expect(w.switchChain).toHaveBeenCalled();
  expect(mock.simulate).toHaveBeenCalled();
});
it('rejects a wrong RPC chain before transaction simulation', async () => {
  mock.chain.mockResolvedValue(114);
  await expect(
    prepareArcBet(wallet() as unknown as Wallet, address, 0n, true, 10n ** 16n),
  ).rejects.toThrow('Switch to Arc');
  expect(mock.simulate).not.toHaveBeenCalled();
});
it('rejects a disconnect and succeeds after reconnect', async () => {
  await expect(prepareArcAction(undefined, address, 0n)).rejects.toThrow('Reconnect');
  await expect(
    prepareArcAction(wallet() as unknown as Wallet, address, 0n),
  ).resolves.toBeUndefined();
});
it('stops after a rejected network switch', async () => {
  const w = wallet();
  w.switchChain.mockRejectedValueOnce(new Error('User rejected'));
  await expect(
    prepareArcBet(w as unknown as Wallet, address, 0n, true, 10n ** 16n),
  ).rejects.toThrow('User rejected');
  expect(mock.simulate).not.toHaveBeenCalled();
});
it('reserves gas in addition to the stake', async () => {
  mock.balance.mockResolvedValue(10n ** 16n);
  await expect(
    prepareArcBet(wallet() as unknown as Wallet, address, 0n, true, 10n ** 16n),
  ).rejects.toThrow('plus network fees');
});
it('rejects a reverted receipt', async () => {
  mock.receipt.mockResolvedValue({ status: 'reverted' });
  await expect(confirmArcTransaction('0x01')).rejects.toThrow('reverted');
});
