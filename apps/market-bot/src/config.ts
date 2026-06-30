import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load from monorepo root .env
dotenvConfig({ path: resolve(process.cwd(), '../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  // Network
  rpcUrl: requireEnv('RPC_URL'),
  contractAddress: requireEnv('NEXT_PUBLIC_CONTRACT_ADDRESS'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Security
  magicLinkSecret: requireEnv('MAGIC_LINK_SECRET'),
  treasuryPrivateKey: requireEnv('TREASURY_PRIVATE_KEY'),

  // Timing
  marketPollIntervalMs: parseInt(optionalEnv('MARKET_POLL_INTERVAL_MS', '120000')),
  rebalanceBaseIntervalMs: parseInt(optionalEnv('REBALANCE_BASE_INTERVAL_MS', '600000')),
  rebalanceJitterMs: parseInt(optionalEnv('REBALANCE_JITTER_MS', '480000')),
  bettingBufferSeconds: parseInt(optionalEnv('BETTING_BUFFER_SECONDS', '900')),

  // Strategy
  imbalanceThreshold: parseFloat(optionalEnv('IMBALANCE_THRESHOLD', '1.3')),
  minBetFlr: parseFloat(optionalEnv('MIN_BET_FLR', '0.5')),
  maxBetFlr: parseFloat(optionalEnv('MAX_BET_FLR', '2.0')),
  seedBetFlr: parseFloat(optionalEnv('SEED_BET_FLR', '1.0')),
  initialMarketBets: parseInt(optionalEnv('INITIAL_MARKET_BETS', '3')),

  // Wallets
  walletCount: parseInt(optionalEnv('WALLET_COUNT', '25')),
  minWalletBalanceFlr: parseFloat(optionalEnv('MIN_WALLET_BALANCE_FLR', '5.0')),
  fundingAmountFlr: parseFloat(optionalEnv('FUNDING_AMOUNT_FLR', '50.0')),

  // Alerts
  dailyBudgetAlertFlr: parseFloat(optionalEnv('DAILY_BUDGET_ALERT_FLR', '2000')),
  lowTreasuryAlertFlr: parseFloat(optionalEnv('LOW_TREASURY_ALERT_FLR', '500')),

  // Health endpoint
  healthPort: parseInt(optionalEnv('HEALTH_PORT', '3002')),
} as const;

export type Config = typeof config;
