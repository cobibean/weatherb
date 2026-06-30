import { parseEther, formatEther } from 'viem';
import { config } from './config.js';
import {
  getOpenMarkets,
  refreshMarket,
  pollForNewMarkets,
} from './market-monitor.js';
import { placeBet, placeBets } from './transaction.js';
import { prisma } from './db.js';
import type { CachedMarket, BetRequest } from './types.js';

// Convert config values to wei
const MIN_BET_WEI = parseEther(config.minBetFlr.toString());
const MAX_BET_WEI = parseEther(config.maxBetFlr.toString());
const SEED_BET_WEI = parseEther(config.seedBetFlr.toString());

// Track daily spend for budget alerts
let dailySpend = 0n;
let dailySpendResetTime = getNextMidnight();

function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight.getTime();
}

function resetDailySpendIfNeeded(): void {
  if (Date.now() > dailySpendResetTime) {
    console.log(`[Rebalancer] Resetting daily spend counter`);
    dailySpend = 0n;
    dailySpendResetTime = getNextMidnight();
  }
}

/**
 * Clamp a value between min and max
 */
function clamp(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Calculate the bet size to help rebalance pools
 */
function calculateRebalanceBetSize(largerPool: bigint, smallerPool: bigint): bigint {
  const imbalance = largerPool - smallerPool;
  // Bet 1/4 of the imbalance to gradually rebalance
  const targetBet = imbalance / 4n;
  return clamp(targetBet, MIN_BET_WEI, MAX_BET_WEI);
}

/**
 * Check if a market needs rebalancing
 */
function needsRebalancing(market: CachedMarket): boolean {
  const yesPool = market.yesPool;
  const noPool = market.noPool;

  // Zero-pool case: needs seeding, not rebalancing
  if (yesPool === 0n || noPool === 0n) {
    return false;
  }

  const maxPool = yesPool > noPool ? yesPool : noPool;
  const minPool = yesPool < noPool ? yesPool : noPool;

  const ratio = Number(maxPool) / Number(minPool);
  return ratio > config.imbalanceThreshold;
}

/**
 * Create a rebalance bet request for a market
 */
function createRebalanceBet(market: CachedMarket): BetRequest | null {
  const yesPool = market.yesPool;
  const noPool = market.noPool;

  // Zero-pool guard
  if (yesPool === 0n || noPool === 0n) {
    return null;
  }

  const maxPool = yesPool > noPool ? yesPool : noPool;
  const minPool = yesPool < noPool ? yesPool : noPool;
  const ratio = Number(maxPool) / Number(minPool);

  if (ratio <= config.imbalanceThreshold) {
    return null;
  }

  // Bet on the smaller pool
  const isYes = yesPool < noPool;
  const amount = calculateRebalanceBetSize(maxPool, minPool);

  return {
    marketId: market.id,
    isYes,
    amount,
    strategy: 'rebalance',
    poolRatioBefore: ratio,
  };
}

/**
 * Seed a new market with initial liquidity
 */
export async function seedNewMarket(market: CachedMarket): Promise<void> {
  console.log(`[Rebalancer] Seeding new market #${market.id}`);

  const numBets = config.initialMarketBets; // Default 3
  const bets: BetRequest[] = [];

  // Alternate YES/NO bets with slight variation in amounts
  for (let i = 0; i < numBets; i++) {
    const isYes = i % 2 === 0;
    // Add some randomness: 80-120% of seed bet
    const variance = 0.8 + Math.random() * 0.4;
    const amount = BigInt(Math.floor(Number(SEED_BET_WEI) * variance));

    bets.push({
      marketId: market.id,
      isYes,
      amount,
      strategy: 'new_market',
      poolRatioBefore: 1, // New market starts at 1:1
    });
  }

  console.log(`[Rebalancer] Placing ${bets.length} seed bets on market #${market.id}`);

  const results = await placeBets(bets);

  const successful = results.filter((r) => r.success).length;
  const totalSpent = bets.reduce((sum, b) => sum + b.amount, 0n);

  console.log(`[Rebalancer] Seeded market #${market.id}: ${successful}/${bets.length} bets placed`);

  // Track spend
  dailySpend += totalSpent;
  checkBudgetAlert();
}

/**
 * Rebalance all open markets that need it
 */
export async function rebalanceOpenMarkets(): Promise<{
  marketsChecked: number;
  betsPlaced: number;
  totalSpent: bigint;
}> {
  resetDailySpendIfNeeded();

  const openMarkets = getOpenMarkets();
  console.log(`[Rebalancer] Checking ${openMarkets.length} open markets for rebalancing`);

  let betsPlaced = 0;
  let totalSpent = 0n;

  for (const market of openMarkets) {
    // Refresh market data before checking
    const freshMarket = await refreshMarket(market.id);

    // Zero-pool case: seed the market
    if (freshMarket.yesPool === 0n && freshMarket.noPool === 0n) {
      console.log(`[Rebalancer] Market #${market.id} has empty pools, seeding...`);
      await seedNewMarket(freshMarket);
      continue;
    }

    // One-sided pool case: seed the empty side
    if (freshMarket.yesPool === 0n || freshMarket.noPool === 0n) {
      console.log(`[Rebalancer] Market #${market.id} has one-sided pool, seeding...`);
      const isYes = freshMarket.yesPool === 0n;
      const result = await placeBet({
        marketId: market.id,
        isYes,
        amount: SEED_BET_WEI,
        strategy: 'new_market',
        poolRatioBefore: 999, // Infinite imbalance
      });

      if (result.success) {
        betsPlaced++;
        totalSpent += SEED_BET_WEI;
      }
      continue;
    }

    // Normal rebalancing
    const betRequest = createRebalanceBet(freshMarket);
    if (betRequest) {
      const yesFlr = Number(freshMarket.yesPool) / 1e18;
      const noFlr = Number(freshMarket.noPool) / 1e18;
      console.log(
        `[Rebalancer] Market #${market.id} imbalanced (YES: ${yesFlr.toFixed(2)}, NO: ${noFlr.toFixed(2)}), ` +
          `betting ${formatEther(betRequest.amount)} FLR on ${betRequest.isYes ? 'YES' : 'NO'}`
      );

      const result = await placeBet(betRequest);

      if (result.success) {
        betsPlaced++;
        totalSpent += betRequest.amount;
      }
    }
  }

  // Track daily spend
  dailySpend += totalSpent;
  checkBudgetAlert();

  console.log(
    `[Rebalancer] Rebalancing complete: ${betsPlaced} bets, ${formatEther(totalSpent)} FLR spent`
  );

  return {
    marketsChecked: openMarkets.length,
    betsPlaced,
    totalSpent,
  };
}

/**
 * Check for new markets and seed them
 */
export async function checkAndSeedNewMarkets(): Promise<number> {
  const newMarkets = await pollForNewMarkets();

  if (newMarkets.length === 0) {
    return 0;
  }

  console.log(`[Rebalancer] Found ${newMarkets.length} new market(s)`);

  for (const { market } of newMarkets) {
    await seedNewMarket(market);
  }

  return newMarkets.length;
}

/**
 * Check budget and log alert if exceeding threshold
 */
function checkBudgetAlert(): void {
  const dailyBudgetWei = parseEther(config.dailyBudgetAlertFlr.toString());

  if (dailySpend > dailyBudgetWei) {
    console.error(
      `[Rebalancer] ALERT: Daily spend (${formatEther(dailySpend)} FLR) exceeds budget (${config.dailyBudgetAlertFlr} FLR)!`
    );
  }
}

/**
 * Calculate next rebalance interval with jitter
 */
export function getNextRebalanceInterval(): number {
  const base = config.rebalanceBaseIntervalMs;
  const jitter = Math.random() * config.rebalanceJitterMs;
  return base + jitter;
}

/**
 * Get rebalancer stats for health check
 */
export async function getRebalancerStats(): Promise<{
  dailySpendFlr: string;
  dailyBudgetFlr: number;
  budgetUsedPercent: number;
  betsToday: number;
}> {
  resetDailySpendIfNeeded();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const betsToday = await prisma.botBet.count({
    where: { createdAt: { gte: todayStart } },
  });

  const dailyBudgetWei = parseEther(config.dailyBudgetAlertFlr.toString());
  const budgetUsedPercent =
    dailyBudgetWei > 0n ? (Number(dailySpend) / Number(dailyBudgetWei)) * 100 : 0;

  return {
    dailySpendFlr: formatEther(dailySpend),
    dailyBudgetFlr: config.dailyBudgetAlertFlr,
    budgetUsedPercent: Math.round(budgetUsedPercent),
    betsToday,
  };
}
