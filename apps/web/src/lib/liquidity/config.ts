import { formatUnits, getAddress, parseUnits, type Hex } from 'viem';
import { z } from 'zod';
import { ARC_TESTNET } from '@weatherb/shared/constants';
import { MAX_ACTIVE_LIQUIDITY_MARKETS } from './types';

export const DEFAULT_SEED_AMOUNT_WEI = '2500000000000000000';
const MAX_PAIR_SIDE = ((1n << 256n) - 1n) / 2n;

export function parseSeedAmount(amount: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) throw new Error('Use a positive decimal USDC amount with at most 18 places');
  const wei = parseUnits(amount, 18);
  if (wei === 0n || wei > MAX_PAIR_SIDE) throw new Error('Seed amount is outside supported uint256 arithmetic');
  return wei;
}

export function formatSeedAmount(wei: string): string {
  const value = formatUnits(BigInt(wei), 18);
  if (!value.includes('.')) return `${value}.00`;
  const [whole, fraction] = value.split('.');
  return `${whole}.${fraction!.padEnd(2, '0')}`;
}

export const updateConfigSchema = z.object({
  expectedVersion: z.number().int().positive(),
  seedAmountUsdc: z.string().optional(),
  seedingEnabled: z.boolean().optional(),
  claimsEnabled: z.boolean().optional(),
}).strict().refine((value) => value.seedAmountUsdc !== undefined || value.seedingEnabled !== undefined || value.claimsEnabled !== undefined);

export type ConfigPatch = z.infer<typeof updateConfigSchema>;

export function deploymentKey(address: Hex): string {
  return `${ARC_TESTNET.id}:${getAddress(address).toLowerCase()}`;
}

export function safeConfig(config: {
  version: number; seedAmountWei: string; seedingEnabled: boolean; claimsEnabled: boolean;
  walletAddress: string | null; firstEligibleMarketId: number | null; activationBlockNumber: bigint | null;
  activatedAt: Date | null;
}, options: { canEdit: boolean; workerReady: boolean }): object {
  return {
    version: config.version,
    seedAmountUsdc: formatSeedAmount(config.seedAmountWei),
    maxActiveMarkets: MAX_ACTIVE_LIQUIDITY_MARKETS,
    seedingEnabled: config.seedingEnabled,
    claimsEnabled: config.claimsEnabled,
    walletAddress: config.walletAddress,
    chainId: ARC_TESTNET.id,
    firstEligibleMarketId: config.firstEligibleMarketId,
    activationBlockNumber: config.activationBlockNumber?.toString() ?? null,
    activatedAt: config.activatedAt?.toISOString() ?? null,
    canEdit: options.canEdit,
    workerReady: options.workerReady,
  };
}
