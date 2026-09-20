import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ default: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: vi.fn(), systemConfig: { findUniqueOrThrow: vi.fn(async () => ({ deploymentKey: '5042002:0xd86e2774e4a9bf2e86199791068b9350b718b891' })) } })) } }));
import { requireRestartContract } from '../market-state';
const client = (version: string) => ({ getChainId: async () => 5042002, readContract: async () => version }) as never;
const address = '0xd86e2774e4a9bf2e86199791068b9350b718b891';
describe('requireRestartContract', () => {
  it.each(['2.2.0', '2.3.0', '2.4.0'])('accepts %s', async (v) => { await expect(requireRestartContract(client(v), address)).resolves.toBeUndefined(); });
  it.each(['2.0.0', '2.1.0', '3.0.0'])('rejects %s', async (v) => { await expect(requireRestartContract(client(v), address)).rejects.toThrow(/2\.2\.0 or 2\.3\.0/); });
});
