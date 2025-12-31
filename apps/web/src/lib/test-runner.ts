/**
 * Test Runner Orchestration
 *
 * CRITICAL ORCHESTRATION MODULE - Manages the complete test window lifecycle.
 *
 * This module orchestrates the entire test window flow:
 * 1. Generate and fund test wallets
 * 2. Create 5 test markets with staggered times
 * 3. Place opposing bets
 * 4. Monitor market settlement
 * 5. Verify payouts
 * 6. Sweep funds back
 * 7. Send results email
 *
 * Safety Features:
 * - NEVER disposes keys before confirmed fund recovery
 * - Comprehensive error handling with status tracking
 * - Full audit trail in database
 * - Recursive setTimeout for monitoring (not setInterval)
 * - 3-block confirmation requirement before key disposal
 *
 * @module test-runner
 */

import prisma from './prisma';
import { db } from './db';
import type { TestRun } from '@prisma/client';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';

// Import helper modules
import {
  generateTestWallets,
  encryptWalletKeys,
  decryptWalletKeys,
  fundWallets,
  sweepWallets,
  type TestWallet,
  type FundingResult,
  type SweepResult,
} from './test-wallets';

import {
  createTestMarkets,
  placeBets,
  verifyPayouts,
  type CreatedMarket,
  type BetResult,
  type VerifyPayoutsResult,
} from './test-markets';

import { sendTestResultsEmail, type TestResultsData } from './email';
import { createMagicLinkUrls } from './magic-links';

// ============================================================
// TYPES
// ============================================================

export type TestResults = {
  success: boolean;
  testRunId: string;
  fundingAmount: string;
  recoveredAmount: string;
  netCost: string;
  marketsCreated: number;
  marketsSettled: number;
  payoutVerified: boolean;
  error?: string;
};

type MonitoringState = {
  lastSettledCount: number;
  checkCount: number;
};

// ============================================================
// CONSTANTS
// ============================================================

const WALLET_COUNT = 2; // 2 wallets for opposing bets
const FUNDING_AMOUNT_PER_WALLET = '18'; // 18 FLR each (36 FLR total for 5 markets + gas buffer)
const MARKET_COUNT = 5; // 5 test markets per run
const MONITORING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BASE_RESOLVE_TIME_OFFSET = 30 * 60; // 30 minutes from now

// ============================================================
// HELPERS
// ============================================================

/**
 * Validate required environment variables
 */
function validateEnv(): {
  rpcUrl: string;
  contractAddress: Hex;
  adminPrivateKey: Hex;
} {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY as Hex | undefined;

  if (!rpcUrl) {
    throw new Error('Missing RPC_URL environment variable');
  }
  if (!contractAddress) {
    throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable');
  }
  if (!adminPrivateKey) {
    throw new Error('Missing ADMIN_PRIVATE_KEY environment variable');
  }

  return { rpcUrl, contractAddress, adminPrivateKey };
}

/**
 * Calculate net cost (funding - recovered)
 */
function calculateNetCost(fundingAmount: string, recoveredAmount: string): string {
  const funding = parseFloat(fundingAmount);
  const recovered = parseFloat(recoveredAmount);
  return (funding - recovered).toFixed(2);
}

// ============================================================
// START TEST WINDOW
// ============================================================

/**
 * Start a test window for a suggestion.
 *
 * FULL IMPLEMENTATION - This orchestrates the entire test setup:
 * 1. Generate 2 ephemeral test wallets
 * 2. Encrypt private keys with AES-256
 * 3. Fund wallets from admin wallet (12.5 FLR each)
 * 4. Create 5 test markets with staggered resolve times
 * 5. Place opposing bets on all markets
 * 6. Create TestRun record in database
 * 7. Start background monitoring
 *
 * SAFETY:
 * - All transaction hashes stored for audit trail
 * - Encrypted keys stored in database (NEVER plaintext)
 * - If any step fails, TestRun marked as FAILED
 * - Keys preserved on failure for manual recovery
 *
 * @param suggestionId - The suggestion to test
 * @returns The created TestRun record
 * @throws Error if any step fails (after marking TestRun as FAILED)
 *
 * @example
 * ```ts
 * const testRun = await startTestWindow('suggestion-123');
 * console.log(`Test started: ${testRun.id}`);
 * ```
 */
export async function startTestWindow(suggestionId: string): Promise<TestRun> {
  const { rpcUrl, contractAddress, adminPrivateKey } = validateEnv();

  let testRunId: string | undefined;
  let wallets: TestWallet[] = [];
  let fundingResult: FundingResult | undefined;
  let markets: CreatedMarket[] = [];
  let bets: BetResult[] = [];

  try {
    // STEP 0: Fetch suggestion to get city data
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: { city: true },
    });

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    // Determine city data from suggestion
    const cityData = suggestion.city
      ? {
          name: suggestion.city.name,
          latitude: suggestion.city.latitude,
          longitude: suggestion.city.longitude,
          timezone: suggestion.city.timezone,
        }
      : {
          name: suggestion.customCityName || 'Unknown City',
          latitude: suggestion.latitude || 0,
          longitude: suggestion.longitude || 0,
          timezone: 'UTC', // Default for custom cities
        };

    console.log(`[Test Runner] Starting test for city: ${cityData.name}`);

    // STEP 1: Generate test wallets
    console.log(`[Test Runner] Generating ${WALLET_COUNT} test wallets...`);
    wallets = generateTestWallets(WALLET_COUNT);
    console.log(`[Test Runner] Wallets generated: ${wallets.map(w => w.address).join(', ')}`);

    // STEP 2: Encrypt wallet keys
    console.log('[Test Runner] Encrypting wallet keys...');
    const encryptedKeys = encryptWalletKeys(wallets);
    console.log('[Test Runner] Keys encrypted successfully');

    // STEP 3: Create viem clients
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const adminAccount = privateKeyToAccount(adminPrivateKey);
    const adminWalletClient = createWalletClient({
      account: adminAccount,
      transport: http(rpcUrl),
    });

    // STEP 4: Fund wallets
    console.log(`[Test Runner] Funding wallets with ${FUNDING_AMOUNT_PER_WALLET} FLR each...`);
    fundingResult = await fundWallets(
      wallets,
      FUNDING_AMOUNT_PER_WALLET,
      publicClient,
      adminWalletClient
    );

    if (!fundingResult.success) {
      throw new Error(`Wallet funding failed: ${fundingResult.error}`);
    }

    console.log(
      `[Test Runner] Wallets funded: ${fundingResult.totalAmount} FLR (${fundingResult.transactions.length} txs)`
    );

    // STEP 5: Create test markets
    console.log(`[Test Runner] Creating ${MARKET_COUNT} test markets...`);

    // Calculate base resolve time (30 minutes from now)
    const baseResolveTime = Math.floor(Date.now() / 1000) + BASE_RESOLVE_TIME_OFFSET;

    // Create preliminary TestRun record to get testRunId for markets
    const preliminaryTestRun = await prisma.testRun.create({
      data: {
        suggestionId,
        walletKeys: encryptedKeys,
        walletCount: WALLET_COUNT,
        keysDisposed: false,
        marketsCreated: 0,
        marketsSettled: 0,
        fundingAmount: fundingResult.totalAmount,
        fundingTxHash: fundingResult.transactions[0].hash,
        recoveredAmount: '0',
        netCost: '0',
        status: 'RUNNING',
        payoutVerified: false,
      },
    });

    testRunId = preliminaryTestRun.id;
    console.log(`[Test Runner] TestRun created: ${testRunId}`);

    // Create markets using the suggestion's city
    const marketsResult = await createTestMarkets({
      testRunId,
      wallets,
      customCity: cityData,
      baseResolveTime,
    });

    if (!marketsResult.success || marketsResult.markets.length !== MARKET_COUNT) {
      throw new Error(
        `Market creation failed: ${marketsResult.error || `Expected ${MARKET_COUNT} markets, got ${marketsResult.markets.length}`}`
      );
    }

    markets = marketsResult.markets;
    console.log(
      `[Test Runner] Markets created: ${markets.map(m => m.contractMarketId).join(', ')}`
    );

    // STEP 6: Place opposing bets
    console.log('[Test Runner] Placing opposing bets...');
    const betsResult = await placeBets(markets, wallets);

    if (!betsResult.success) {
      throw new Error(`Bet placement failed: ${betsResult.error}`);
    }

    bets = betsResult.bets;
    console.log(`[Test Runner] Bets placed: ${bets.length} total bets`);

    // STEP 7: Update TestRun with complete information
    const updatedTestRun = await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        marketsCreated: markets.length,
        results: {
          fundingTransactions: fundingResult.transactions,
          markets: markets.map(m => ({
            contractMarketId: m.contractMarketId,
            cityName: m.cityName,
            thresholdTemp: m.thresholdTemp,
            resolveTime: m.resolveTime,
            transactionHash: m.transactionHash,
          })),
          bets: bets.map(b => ({
            contractMarketId: b.contractMarketId,
            wallet: b.wallet,
            isYes: b.isYes,
            amount: b.amount,
            transactionHash: b.transactionHash,
          })),
        },
      },
    });

    // STEP 8: Update suggestion status to APPROVED
    await prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'APPROVED' },
    });

    console.log('[Test Runner] Suggestion status updated to APPROVED');

    // STEP 9: Start background monitoring
    console.log('[Test Runner] Starting background monitoring...');
    setTimeout(() => {
      monitorTestRun(testRunId!).catch(error => {
        console.error(`[Test Runner] Monitoring error: ${error.message}`);
      });
    }, MONITORING_INTERVAL_MS);

    console.log(`[Test Runner] Test window started successfully: ${testRunId}`);
    return updatedTestRun;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Test Runner] Error starting test window: ${errorMessage}`);

    // If we created a TestRun, mark it as FAILED
    if (testRunId) {
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: 'FAILED',
          errorMessage,
          // Preserve partial results for debugging
          results: {
            error: errorMessage,
            fundingTransactions: fundingResult?.transactions || [],
            markets: markets.map(m => ({
              contractMarketId: m.contractMarketId,
              cityName: m.cityName,
              thresholdTemp: m.thresholdTemp,
              resolveTime: m.resolveTime,
              transactionHash: m.transactionHash,
            })),
            bets: bets.map(b => ({
              contractMarketId: b.contractMarketId,
              wallet: b.wallet,
              isYes: b.isYes,
              amount: b.amount,
              transactionHash: b.transactionHash,
            })),
          },
        },
      });
    }

    throw error;
  }
}

// ============================================================
// MONITOR TEST RUN
// ============================================================

/**
 * Monitor a test run for market settlement.
 *
 * This function:
 * 1. Queries all markets for the test run
 * 2. Checks settlement status on-chain
 * 3. Updates marketsSettled count in database
 * 4. When all settled, triggers finalization
 * 5. Otherwise, reschedules monitoring
 *
 * SAFETY:
 * - Uses recursive setTimeout (not setInterval)
 * - Updates database on each check
 * - Handles errors gracefully
 * - Only finalizes when ALL markets settled
 *
 * @param testRunId - The TestRun ID to monitor
 * @throws Error if monitoring fails
 */
export async function monitorTestRun(testRunId: string): Promise<void> {
  try {
    console.log(`[Monitor] Checking test run: ${testRunId}`);

    // Get TestRun
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new Error(`TestRun not found: ${testRunId}`);
    }

    // Skip if already completed or failed
    if (testRun.status === 'COMPLETED' || testRun.status === 'FAILED') {
      console.log(`[Monitor] Test run already ${testRun.status}, skipping`);
      return;
    }

    // Get all markets for this test run
    const markets = await prisma.market.findMany({
      where: {
        testRunId,
        isTest: true,
      },
    });

    console.log(`[Monitor] Found ${markets.length} markets for test run`);

    // Check settlement status on-chain
    const { rpcUrl, contractAddress } = validateEnv();
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const weatherProvider = createWeatherProviderFromEnv();

    for (const market of markets) {
      try {
        const marketState = await publicClient.readContract({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'getMarket',
          args: [BigInt(market.contractMarketId)],
        });

        // MarketStatus: 0 = ACTIVE, 1 = CLOSED, 2 = RESOLVED
        if (marketState.status === 2 && !market.isSettled) {
          // Market has settled on-chain but not yet updated in database
          console.log(`[Monitor] Market ${market.contractMarketId} newly settled, fetching actual temperature...`);

          // Fetch actual temperature from weather provider
          const actualTempF = await weatherProvider.getActualTemperature(
            market.latitude,
            market.longitude,
            market.resolveTime
          );

          // Convert to tenths
          const actualTempTenths = Math.round(actualTempF * 10);

          // Determine outcome (YES if actual >= threshold, NO otherwise)
          const outcome = actualTempTenths >= market.thresholdTemp ? 'YES' : 'NO';

          // Update market in database
          await db.market.update({
            where: { id: market.id },
            data: {
              isSettled: true,
              settledAt: new Date(),
              actualTemp: actualTempTenths,
              outcome,
            },
          });

          console.log(
            `[Monitor] Market ${market.id} settled: ${outcome} (actual: ${actualTempF}°F, threshold: ${market.thresholdTemp / 10}°F)`
          );
        }
      } catch (error) {
        console.error(
          `[Monitor] Error checking market ${market.contractMarketId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Count settled markets from database
    const settledMarkets = await db.market.count({
      where: {
        testRunId,
        isSettled: true,
      },
    });

    console.log(`[Monitor] Settled markets: ${settledMarkets}/${testRun.marketsCreated}`);

    // Update TestRun with settled count
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        marketsSettled: settledMarkets,
      },
    });

    // Check if all markets settled
    if (settledMarkets === testRun.marketsCreated) {
      console.log('[Monitor] All markets settled! Triggering finalization...');
      await finalizeTestRun(testRunId);
    } else {
      // Reschedule monitoring
      console.log(`[Monitor] Rescheduling check in ${MONITORING_INTERVAL_MS / 1000}s...`);
      setTimeout(() => {
        monitorTestRun(testRunId).catch(error => {
          console.error(`[Monitor] Monitoring error: ${error.message}`);
        });
      }, MONITORING_INTERVAL_MS);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Monitor] Error monitoring test run: ${errorMessage}`);

    // Update TestRun with error
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'FAILED',
        errorMessage: `Monitoring failed: ${errorMessage}`,
      },
    });

    throw error;
  }
}

// ============================================================
// FINALIZE TEST RUN
// ============================================================

/**
 * Finalize a test run after all markets settle.
 *
 * CRITICAL FUNCTION - This handles fund recovery and cleanup:
 * 1. Decrypt wallet keys
 * 2. Verify payouts for winning bets
 * 3. Sweep funds back to admin wallet
 * 4. Wait for 3 confirmations
 * 5. Mark keysDisposed=true ONLY after confirmed sweep
 * 6. Send results email (stub for Task 8)
 * 7. Update TestRun status to COMPLETED
 *
 * SAFETY RULES:
 * - NEVER mark keysDisposed=true before sweep confirmation
 * - If sweep fails, preserve keys for manual recovery
 * - Store all transaction data in results field
 * - Update status to FAILED on any error
 *
 * @param testRunId - The TestRun ID to finalize
 * @returns Test results summary
 * @throws Error if finalization fails (after updating database)
 */
export async function finalizeTestRun(testRunId: string): Promise<TestResults> {
  try {
    console.log(`[Finalize] Starting finalization for test run: ${testRunId}`);

    // Get TestRun
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      throw new Error(`TestRun not found: ${testRunId}`);
    }

    // Get all markets with bet results
    const markets = await prisma.market.findMany({
      where: {
        testRunId,
        isTest: true,
      },
    });

    // STEP 1: Decrypt wallet keys
    console.log('[Finalize] Decrypting wallet keys...');
    const wallets = decryptWalletKeys(testRun.walletKeys);
    console.log(`[Finalize] Decrypted ${wallets.length} wallets`);

    // STEP 2: Reconstruct bet results from database
    const storedResults = testRun.results as any;
    const betResults: BetResult[] = storedResults?.bets || [];
    const marketResults: CreatedMarket[] = storedResults?.markets?.map((m: any) => ({
      dbId: markets.find(market => market.contractMarketId === m.contractMarketId)?.id || '',
      contractMarketId: m.contractMarketId,
      cityName: m.cityName,
      thresholdTemp: m.thresholdTemp,
      resolveTime: m.resolveTime,
      transactionHash: m.transactionHash,
      gasUsed: '0',
      gasCost: '0',
      isTest: true as const,
    })) || [];

    // STEP 3: Verify payouts
    console.log('[Finalize] Verifying payouts...');
    const payoutResult = await verifyPayouts(marketResults, wallets, betResults);

    if (!payoutResult.success) {
      throw new Error(`Payout verification failed: ${payoutResult.error}`);
    }

    const allVerified = payoutResult.verifications.every(v => v.verified);
    console.log(`[Finalize] Payout verification: ${allVerified ? 'PASSED' : 'FAILED'}`);

    // STEP 4: Sweep funds back to admin wallet
    console.log('[Finalize] Sweeping funds back to admin wallet...');
    const { rpcUrl, adminPrivateKey } = validateEnv();
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const adminAccount = privateKeyToAccount(adminPrivateKey);

    const sweepResult = await sweepWallets(wallets, adminAccount.address, publicClient, rpcUrl);

    if (!sweepResult.success) {
      throw new Error(`Fund sweep failed: ${sweepResult.error}`);
    }

    console.log(`[Finalize] Funds swept: ${sweepResult.recoveredAmount} FLR recovered`);

    // CRITICAL: Verify all transactions have 3+ confirmations
    const allConfirmed = sweepResult.transactions.every(tx => tx.confirmations >= 3);
    if (!allConfirmed) {
      throw new Error('Sweep transactions do not have sufficient confirmations');
    }

    console.log('[Finalize] All sweep transactions confirmed (3+ blocks)');

    // STEP 5: Calculate net cost
    const netCost = calculateNetCost(testRun.fundingAmount.toString(), sweepResult.recoveredAmount);
    console.log(`[Finalize] Net cost: ${netCost} FLR`);

    // STEP 6: Update TestRun - ONLY NOW mark keysDisposed=true
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        recoveredAmount: sweepResult.recoveredAmount,
        netCost,
        payoutVerified: allVerified,
        keysDisposed: true, // SAFE: Funds confirmed recovered
        results: {
          ...storedResults,
          payoutVerifications: payoutResult.verifications,
          sweepTransactions: sweepResult.transactions,
          totalGasCost: payoutResult.totalGasCost,
        },
      },
    });

    console.log(`[Finalize] Test run completed successfully: ${testRunId}`);

    // STEP 7: Send results email
    try {
      // Fetch the suggestion for city details
      const suggestion = await prisma.suggestion.findUnique({
        where: { id: testRun.suggestionId },
        include: { city: true },
      });

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      // Prepare temperature data from markets
      const temperatureData: TestResultsData['temperatureData'] = [];
      for (const market of markets) {
        if (market.actualTemp !== null) {
          temperatureData.push({
            time: market.resolveTime.toISOString(),
            threshold: market.thresholdTemp,
            actual: market.actualTemp,
            outcome: market.actualTemp >= market.thresholdTemp ? 'YES' : 'NO',
          });
        }
      }

      // Generate magic link URLs for approve/deny actions
      const magicLinks = await createMagicLinkUrls(
        suggestion.id,
        process.env.NEXT_PUBLIC_APP_URL
      );

      // Prepare email data
      const emailData: TestResultsData = {
        cityName: suggestion.city?.name || suggestion.customCityName || 'Unknown',
        latitude: suggestion.city?.latitude || suggestion.latitude || 0,
        longitude: suggestion.city?.longitude || suggestion.longitude || 0,
        testRunId,
        startedAt: testRun.startedAt.toISOString(),
        completedAt: testRun.completedAt?.toISOString() || new Date().toISOString(),
        status: 'COMPLETED',
        marketsCreated: testRun.marketsCreated,
        marketsSettled: testRun.marketsSettled,
        temperatureData,
        totalVolume: testRun.totalVolume?.toString() || '0',
        totalPayouts: payoutResult.totalPaidOut,
        netGasCost: netCost,
        payoutVerified: allVerified,
        verificationDetails: allVerified
          ? 'All market payouts verified successfully'
          : `${payoutResult.verifications.filter(v => v.verified).length}/${payoutResult.verifications.length} payouts verified`,
        approveUrl: magicLinks.approveUrl,
        denyUrl: magicLinks.denyUrl,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin`,
      };

      const emailResult = await sendTestResultsEmail(emailData);
      if (!emailResult.success) {
        console.error('[Finalize] Failed to send email:', emailResult.error);
        // Don't fail the entire process if email fails
      } else {
        console.log('[Finalize] Test results email sent successfully');
      }
    } catch (emailError) {
      console.error('[Finalize] Error sending email:', emailError);
      // Don't fail the entire process if email fails
    }

    return {
      success: true,
      testRunId,
      fundingAmount: testRun.fundingAmount.toString(),
      recoveredAmount: sweepResult.recoveredAmount,
      netCost,
      marketsCreated: testRun.marketsCreated,
      marketsSettled: testRun.marketsSettled,
      payoutVerified: allVerified,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Finalize] Error finalizing test run: ${errorMessage}`);

    // Mark TestRun as FAILED - DO NOT mark keysDisposed=true
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'FAILED',
        errorMessage: `Finalization failed: ${errorMessage}`,
        completedAt: new Date(),
        // keysDisposed remains false - keys preserved for manual recovery
      },
    });

    throw error;
  }
}
