import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  chainId: vi.fn(), read: vi.fn(), block: vi.fn(), current: vi.fn(), worker: vi.fn(), update: vi.fn(), audit: vi.fn(),
}));
vi.mock('viem', async (importOriginal) => ({ ...(await importOriginal<typeof import('viem')>()),
  createPublicClient: () => ({ getChainId: mock.chainId, readContract: mock.read, getBlockNumber: mock.block }),
}));
vi.mock('@/lib/prisma', () => ({ default: {
  liquidityConfig: { findUniqueOrThrow: mock.current },
  liquidityWorkerState: { findUnique: mock.worker },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    $executeRaw: async () => 1,
    liquidityConfig: { findUniqueOrThrow: mock.current, update: mock.update },
    adminLog: { create: mock.audit },
  }),
} }));

import { LiquidityConfigError, saveLiquidityConfig } from '../admin-config';

const config = {
  id: 'default', version: 1, seedAmountWei: '2500000000000000000', seedingEnabled: false,
  claimsEnabled: true, walletAddress: '0x0000000000000000000000000000000000000001',
  deploymentKey: '5042002:0x0000000000000000000000000000000000000002',
  firstEligibleMarketId: null, activationBlockNumber: null, activatedAt: null,
};

describe('liquidity configuration service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('LIQUIDITY_ADMIN_WRITES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000002');
    vi.stubEnv('RPC_URL', 'http://127.0.0.1:8545');
    mock.chainId.mockResolvedValue(5042002);
    mock.read.mockImplementation(async ({ functionName }: { functionName: string }) => functionName === 'version' ? '2.4.0' : functionName === 'minBetWei' ? 10000000000000000n : 42n);
    mock.block.mockResolvedValue(100n);
    mock.current.mockResolvedValue({ ...config });
    mock.worker.mockResolvedValue({ ready: true, lastHeartbeatAt: new Date() });
    mock.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...config, ...data, version: 2 }));
    mock.audit.mockResolvedValue({});
  });

  it('blocks edits when the narrow flag is disabled', async () => {
    vi.stubEnv('LIQUIDITY_ADMIN_WRITES_ENABLED', 'false');
    await expect(saveLiquidityConfig('0xadmin', { expectedVersion: 1, seedingEnabled: true })).rejects.toMatchObject({ status: 403 });
    expect(mock.update).not.toHaveBeenCalled();
  });

  it('persists a seeding pause while the chain RPC is unavailable', async () => {
    mock.chainId.mockRejectedValue(new Error('RPC offline'));
    await saveLiquidityConfig('0xadmin', { expectedVersion: 1, seedingEnabled: false });
    expect(mock.chainId).not.toHaveBeenCalled();
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ seedingEnabled: false }) }));
    expect(mock.audit).toHaveBeenCalledTimes(1);
  });

  it('freezes the first live count and block when first enabled', async () => {
    await saveLiquidityConfig('0xadmin', { expectedVersion: 1, seedingEnabled: true });
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      firstEligibleMarketId: 42, activationBlockNumber: 100n, seedingEnabled: true,
    }) }));
    expect(mock.audit).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale version before settings or audit change', async () => {
    await expect(saveLiquidityConfig('0xadmin', { expectedVersion: 2, seedAmountUsdc: '3' })).rejects.toBeInstanceOf(LiquidityConfigError);
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it('leaves an existing activation boundary untouched after resume', async () => {
    mock.current.mockResolvedValue({ ...config, firstEligibleMarketId: 7, activationBlockNumber: 50n, activatedAt: new Date() });
    await saveLiquidityConfig('0xadmin', { expectedVersion: 1, seedingEnabled: true });
    expect(mock.update.mock.calls[0]?.[0].data).not.toHaveProperty('firstEligibleMarketId');
  });
});
