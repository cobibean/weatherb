import express from 'express';
import { formatEther } from 'viem';
import { config } from './config.js';
import { prisma } from './db.js';
import { publicClient, getTreasuryBalance } from './clients.js';
import { initializeMarketMonitor, getMonitorStats } from './market-monitor.js';
import { initializeWalletManager, getWalletStats, refreshAllBalances } from './wallet-manager.js';
import { getTransactionStats } from './transaction.js';
import { getRebalancerStats } from './rebalancer.js';
import { startRebalancerLoop, stopRebalancerLoop, isRebalancerRunning } from './rebalancer-loop.js';

// ============================================================
// STARTUP
// ============================================================

console.log('');
console.log('========================================================');
console.log('             weatherB Market-Making Bot                  ');
console.log('========================================================');
console.log('');

const startTime = Date.now();

async function startup(): Promise<void> {
  console.log('[Startup] Validating configuration...');

  // Validate required config
  const requiredEnvVars = [
    'RPC_URL',
    'NEXT_PUBLIC_CONTRACT_ADDRESS',
    'DATABASE_URL',
    'MAGIC_LINK_SECRET',
    'TREASURY_PRIVATE_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  console.log(`  RPC URL: ${config.rpcUrl}`);
  console.log(`  Contract: ${config.contractAddress}`);
  console.log(`  Wallet Count: ${config.walletCount}`);

  // Test database connection
  console.log('\n[Startup] Testing database connection...');
  const walletCount = await prisma.botWallet.count();
  console.log(`  Bot wallets in database: ${walletCount}`);

  if (walletCount === 0) {
    throw new Error('No bot wallets found! Run init-wallets.ts first.');
  }

  // Test RPC connection
  console.log('\n[Startup] Testing RPC connection...');
  const blockNumber = await publicClient.getBlockNumber();
  console.log(`  Current block: ${blockNumber}`);

  // Check treasury balance
  console.log('\n[Startup] Checking treasury...');
  const treasuryBalance = await getTreasuryBalance();
  console.log(`  Treasury balance: ${formatEther(treasuryBalance)} FLR`);

  const lowTreasuryThreshold = BigInt(config.lowTreasuryAlertFlr) * 10n ** 18n;
  if (treasuryBalance < lowTreasuryThreshold) {
    console.error(`  WARNING: Treasury balance is low!`);
  }

  // Initialize market monitor
  console.log('\n[Startup] Initializing market monitor...');
  await initializeMarketMonitor();
  const monitorStats = getMonitorStats();
  console.log(`  Cached markets: ${monitorStats.totalCached}`);
  console.log(`  Open markets: ${monitorStats.openMarkets}`);

  // Initialize wallet manager
  console.log('\n[Startup] Initializing wallet manager...');
  await initializeWalletManager();
  const walletStats = await getWalletStats();
  console.log(`  Active wallets: ${walletStats.active}`);
  console.log(`  Low balance: ${walletStats.lowBalance}`);

  if (walletStats.active === 0) {
    console.warn('[Startup] WARNING: No active wallets available! Wallets need funding.');
  }

  // Start health endpoint
  console.log('\n[Startup] Starting health endpoint...');
  startHealthEndpoint();

  // Start rebalancer loop
  console.log('\n[Startup] Starting rebalancer loop...');
  startRebalancerLoop();

  // Schedule periodic balance refresh
  setInterval(async () => {
    try {
      await refreshAllBalances();
    } catch (error) {
      console.error('[Main] Error refreshing balances:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  const startupDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Startup] Complete in ${startupDuration}s`);
  console.log('');
  console.log('Bot is now running. Press Ctrl+C to stop.');
  console.log('');
}

// ============================================================
// HEALTH ENDPOINT
// ============================================================

function startHealthEndpoint(): void {
  const app = express();

  app.get('/health', async (req, res) => {
    try {
      const [walletStats, monitorStats, txStats, rebalancerStats] = await Promise.all([
        getWalletStats(),
        Promise.resolve(getMonitorStats()),
        getTransactionStats(),
        getRebalancerStats(),
      ]);

      // Determine overall status
      let status: 'healthy' | 'degraded' | 'down' = 'healthy';

      if (walletStats.active === 0) {
        status = 'down';
      } else if (walletStats.lowBalance > 5) {
        status = 'degraded';
      } else if (rebalancerStats.budgetUsedPercent > 90) {
        status = 'degraded';
      }

      // Check for activity (no bets in 2 hours = degraded)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (txStats.lastBet && txStats.lastBet < twoHoursAgo && monitorStats.openMarkets > 0) {
        status = 'degraded';
      }

      res.json({
        status,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        rebalancerRunning: isRebalancerRunning(),
        wallets: {
          total: walletStats.total,
          active: walletStats.active,
          lowBalance: walletStats.lowBalance,
          treasuryFlr: walletStats.treasuryBalance,
        },
        markets: {
          cached: monitorStats.totalCached,
          open: monitorStats.openMarkets,
        },
        transactions: {
          last24h: txStats.last24h,
          lastBet: txStats.lastBet?.toISOString() ?? null,
        },
        budget: {
          dailySpendFlr: rebalancerStats.dailySpendFlr,
          dailyBudgetFlr: rebalancerStats.dailyBudgetFlr,
          usedPercent: rebalancerStats.budgetUsedPercent,
          betsToday: rebalancerStats.betsToday,
        },
      });
    } catch (error) {
      console.error('[Health] Error generating health response:', error);
      res.status(500).json({
        status: 'down',
        error: String(error),
      });
    }
  });

  // Simple liveness probe
  app.get('/live', (req, res) => {
    res.send('OK');
  });

  // Readiness probe
  app.get('/ready', async (req, res) => {
    if (isRebalancerRunning()) {
      res.send('OK');
    } else {
      res.status(503).send('NOT READY');
    }
  });

  app.listen(config.healthPort, () => {
    console.log(`  Health endpoint: http://localhost:${config.healthPort}/health`);
  });
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

  // Stop rebalancer loop first
  console.log('[Shutdown] Stopping rebalancer...');
  stopRebalancerLoop();

  // Allow in-flight transactions to complete (5 second grace period)
  console.log('[Shutdown] Waiting for in-flight transactions...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Close database connection
  console.log('[Shutdown] Closing database connection...');
  await prisma.$disconnect();

  console.log('[Shutdown] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('[FATAL] Uncaught exception:', error);

  // Log to database if possible
  try {
    await prisma.botError.create({
      data: {
        errorType: 'uncaught_exception',
        errorMessage: String(error),
        stackTrace: error.stack,
      },
    });
  } catch {
    // Database might be unavailable
  }

  // Attempt graceful shutdown
  await shutdown('uncaughtException');
});

process.on('unhandledRejection', async (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);

  // Log to database if possible
  try {
    await prisma.botError.create({
      data: {
        errorType: 'unhandled_rejection',
        errorMessage: String(reason),
        stackTrace: reason instanceof Error ? reason.stack : undefined,
      },
    });
  } catch {
    // Database might be unavailable
  }

  // Don't exit on unhandled rejection, just log it
});

// ============================================================
// RUN
// ============================================================

startup().catch(async (error) => {
  console.error('[Startup] FATAL ERROR:', error);

  try {
    await prisma.botError.create({
      data: {
        errorType: 'startup_failure',
        errorMessage: String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
      },
    });
  } catch {
    // Database might be unavailable
  }

  process.exit(1);
});
