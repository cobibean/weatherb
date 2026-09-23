import type { Hex } from 'viem';

export const MAX_ACTIVE_LIQUIDITY_MARKETS = 5;
export const LIQUIDITY_TX_LIMIT = 5;
export const LIQUIDITY_CANDIDATE_LIMIT = 25;
export const LIQUIDITY_DEADLINE_MARGIN_SECONDS = 60n;
export const LIQUIDITY_LEASE_SECONDS = 360;
export const LIQUIDITY_WORK_SECONDS = 240_000;

export type LiquidityIdentity = {
  deploymentKey: string;
  contractAddress: Hex;
  walletAddress: Hex;
};

export type LiquidityTickResult = {
  status: 'disabled' | 'busy' | 'ready' | 'blocked' | 'in_flight' | 'failed';
  reconciled: number;
  seeded: number;
  claimed: number;
  blocked: number;
  errors: number;
};
