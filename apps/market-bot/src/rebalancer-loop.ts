import {
  rebalanceOpenMarkets,
  checkAndSeedNewMarkets,
  getNextRebalanceInterval,
} from './rebalancer.js';
import { config } from './config.js';

let isRunning = false;
let rebalanceTimeout: NodeJS.Timeout | null = null;
let marketPollInterval: NodeJS.Timeout | null = null;

/**
 * Start the rebalancer loop
 */
export function startRebalancerLoop(): void {
  if (isRunning) {
    console.log('[RebalancerLoop] Already running');
    return;
  }

  isRunning = true;
  console.log('[RebalancerLoop] Starting...');

  // Start market polling (fixed interval)
  marketPollInterval = setInterval(async () => {
    try {
      await checkAndSeedNewMarkets();
    } catch (error) {
      console.error('[RebalancerLoop] Error polling for new markets:', error);
    }
  }, config.marketPollIntervalMs);

  // Start rebalancing (jittered interval)
  scheduleNextRebalance();

  console.log('[RebalancerLoop] Started');
  console.log(`  Market poll interval: ${config.marketPollIntervalMs}ms`);
  console.log(`  Rebalance base interval: ${config.rebalanceBaseIntervalMs}ms`);
  console.log(`  Rebalance jitter: up to ${config.rebalanceJitterMs}ms`);
}

/**
 * Schedule the next rebalance with jitter
 */
function scheduleNextRebalance(): void {
  if (!isRunning) return;

  const interval = getNextRebalanceInterval();
  console.log(`[RebalancerLoop] Next rebalance in ${Math.round(interval / 1000)}s`);

  rebalanceTimeout = setTimeout(async () => {
    try {
      await rebalanceOpenMarkets();
    } catch (error) {
      console.error('[RebalancerLoop] Error during rebalancing:', error);
    }

    // Schedule next
    scheduleNextRebalance();
  }, interval);
}

/**
 * Stop the rebalancer loop
 */
export function stopRebalancerLoop(): void {
  if (!isRunning) return;

  console.log('[RebalancerLoop] Stopping...');
  isRunning = false;

  if (marketPollInterval) {
    clearInterval(marketPollInterval);
    marketPollInterval = null;
  }

  if (rebalanceTimeout) {
    clearTimeout(rebalanceTimeout);
    rebalanceTimeout = null;
  }

  console.log('[RebalancerLoop] Stopped');
}

/**
 * Check if loop is running
 */
export function isRebalancerRunning(): boolean {
  return isRunning;
}

/**
 * Trigger an immediate rebalance (useful for testing)
 */
export async function triggerImmediateRebalance(): Promise<void> {
  console.log('[RebalancerLoop] Triggering immediate rebalance...');
  await rebalanceOpenMarkets();
}
