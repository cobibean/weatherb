/**
 * Test Markets - Create, Bet, and Verify Test Markets
 *
 * CRITICAL SECURITY MODULE - Handles test market creation and betting.
 *
 * Security Features:
 * - NEVER logs private keys in transaction logs
 * - Validates contract responses before proceeding
 * - Comprehensive audit trail for all transactions
 * - Handles contract reverts gracefully
 *
 * @module test-markets
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  keccak256,
  toBytes,
  decodeEventLog,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES, type City } from '@weatherb/shared/constants';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { prisma as db } from '@/lib/prisma';
import { type TestWallet } from './test-wallets';

// ============================================================
// TYPES
// ============================================================

export type TestMarketParams = {
  testRunId: string;
  wallets: TestWallet[];
  baseResolveTime: number; // Unix timestamp (seconds) for first market
} & (
  | { cityId: string } // Use city from CITIES constant
  | { customCity: { name: string; latitude: number; longitude: number; timezone?: string } } // Use custom city data
);

export type CreatedMarket = {
  dbId: string; // Database ID
  contractMarketId: number; // On-chain market ID
  cityName: string;
  thresholdTemp: number; // In tenths (e.g., 750 = 75.0°F)
  resolveTime: number; // Unix timestamp (seconds)
  transactionHash: Hex;
  gasUsed: string; // Gas units consumed
  gasCost: string; // Cost in FLR
  isTest: true;
};

export type CreateMarketsResult = {
  success: boolean;
  markets: CreatedMarket[];
  totalGasCost: string; // Total gas cost in FLR
  error?: string;
};

export type Bet = {
  contractMarketId: number;
  wallet: Hex;
  isYes: boolean;
  amount: string; // FLR amount as string
  transactionHash: Hex;
};

export type BetResult = {
  contractMarketId: number;
  wallet: Hex;
  isYes: boolean;
  amount: string;
  transactionHash: Hex;
  gasUsed: string; // Gas units consumed
  gasCost: string; // Cost in FLR
};

export type PlaceBetsResult = {
  success: boolean;
  bets: BetResult[];
  totalGasCost: string; // Total gas cost in FLR
  error?: string;
};

export type PayoutVerification = {
  contractMarketId: number;
  wallet: Hex;
  isYes: boolean;
  betAmount: string;
  expectedPayout: string;
  actualPayout: string;
  verified: boolean;
  gasUsed: string; // Gas units consumed for claim
  gasCost: string; // Cost in FLR
  error?: string;
};

export type VerifyPayoutsResult = {
  success: boolean;
  verifications: PayoutVerification[];
  totalGasCost: string; // Total gas cost in FLR
  error?: string;
};

// ============================================================
// CONSTANTS
// ============================================================

// Bet amount patterns (unequal amounts for payout verification)
const BET_AMOUNTS = [
  { yes: '0.9', no: '1.8' },
  { yes: '2.5', no: '3.1' },
  { yes: '4.2', no: '5.99' },
  { yes: '1.5', no: '2.7' },
  { yes: '3.8', no: '4.5' },
] as const;

const MARKET_SPACING_MINUTES = [30, 60, 120, 180, 240]; // Staggered resolve times
const PAYOUT_TOLERANCE = 0.001; // 0.001 FLR tolerance for payout verification

// ============================================================
// HELPERS
// ============================================================

/**
 * Convert forecast temperature (tenths) to threshold (rounded to nearest whole degree).
 */
function forecastTenthsToThresholdTenths(forecastTempF_tenths: number): number {
  return Math.round(forecastTempF_tenths / 10) * 10;
}

/**
 * Convert city ID string to keccak256 bytes32.
 */
function cityIdToBytes32(cityId: string): Hex {
  return keccak256(toBytes(cityId));
}

/**
 * Get city by slug from CITIES constant.
 */
function getCityBySlug(slug: string): City {
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) {
    throw new Error(`City not found: ${slug}`);
  }
  return city;
}

/**
 * Validate environment variables.
 */
function validateEnv(): {
  rpcUrl: string;
  contractAddress: Hex;
  schedulerPrivateKey: Hex;
} {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const schedulerPrivateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;

  if (!rpcUrl) {
    throw new Error('Missing RPC_URL environment variable');
  }
  if (!contractAddress) {
    throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable');
  }
  if (!schedulerPrivateKey) {
    throw new Error('Missing SCHEDULER_PRIVATE_KEY environment variable');
  }

  return { rpcUrl, contractAddress, schedulerPrivateKey };
}

// ============================================================
// CREATE TEST MARKETS
// ============================================================

/**
 * Create test markets with staggered resolve times.
 *
 * SECURITY:
 * - Uses scheduler wallet (not test wallets) to create markets
 * - Stores all transaction hashes for audit trail
 * - Marks markets as test in database
 * - Fetches realistic thresholds from weather API
 *
 * @param params - Test market parameters
 * @returns Array of created markets with transaction details
 * @throws Error if any market creation fails
 */
export async function createTestMarkets(
  params: TestMarketParams
): Promise<CreateMarketsResult> {
  try {
    const { rpcUrl, contractAddress, schedulerPrivateKey } = validateEnv();

    // Get city - either from CITIES constant or use custom city data
    let city: { slug: string; name: string; latitude: number; longitude: number; timezone?: string };
    
    if ('cityId' in params) {
      city = getCityBySlug(params.cityId);
    } else {
      // Custom city from suggestion
      city = {
        slug: params.customCity.name.toLowerCase().replace(/\s+/g, '-'),
        name: params.customCity.name,
        latitude: params.customCity.latitude,
        longitude: params.customCity.longitude,
        timezone: params.customCity.timezone || 'UTC',
      };
    }

    // Create contract clients
    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const account = privateKeyToAccount(schedulerPrivateKey);
    const walletClient = createWalletClient({ transport: http(rpcUrl), account });

    // Get weather provider
    const weatherProvider = createWeatherProviderFromEnv();

    // Create 5 markets with staggered resolve times
    const markets: CreatedMarket[] = [];
    let totalGasCostWei = 0n;

    for (let i = 0; i < 5; i++) {
      const spacingMinutes = MARKET_SPACING_MINUTES[i] ?? 0;
      const resolveTime = params.baseResolveTime + spacingMinutes * 60;

      // Get forecast for this resolve time
      const forecastTenths = await weatherProvider.getForecast(
        city.latitude,
        city.longitude,
        resolveTime
      );

      const thresholdTenths = forecastTenthsToThresholdTenths(forecastTenths);

      // Create market on-chain
      const cityIdBytes32 = cityIdToBytes32(city.slug);

      const { request, result } = await publicClient.simulateContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'createMarket',
        args: [
          cityIdBytes32,
          BigInt(resolveTime),
          BigInt(thresholdTenths),
          '0x0000000000000000000000000000000000000000' as Hex, // FLR currency
        ],
        account: walletClient.account!,
      });

      const txHash = await walletClient.writeContract(request);

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== 'success') {
        throw new Error(`Market creation transaction failed: ${txHash}`);
      }

      // Calculate gas cost
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice || 0n;
      const gasCostWei = gasUsed * gasPrice;
      totalGasCostWei += gasCostWei;

      const contractMarketId = Number(result);

      // Get city from database for foreign key
      // IMPORTANT: Search by SLUG (not name) to ensure the DB slug matches
      // the slug used for the on-chain cityId hash. This prevents mismatch
      // where on-chain uses "new-york-city" but DB has "nyc".
      let dbCity = await db.city.findFirst({
        where: { slug: city.slug },
      });

      if (!dbCity) {
        // Create the city if it doesn't exist (for test/audition markets)
        // Use the same slug that was used for the on-chain cityId hash
        dbCity = await db.city.create({
          data: {
            slug: city.slug,
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            timezone: city.timezone || 'America/New_York',
            isActive: true, // Must be true for settler to find it
          },
        });
        console.log(`[Test Markets] Created city: ${city.name} (slug: ${city.slug})`);
      } else if (!dbCity.isActive) {
        // Ensure the city is active so the settler can find it
        dbCity = await db.city.update({
          where: { id: dbCity.id },
          data: { isActive: true },
        });
        console.log(`[Test Markets] Activated city: ${city.name} (slug: ${city.slug})`);
      }

      // Store market in database
      const dbMarket = await db.market.create({
        data: {
          contractMarketId,
          cityId: dbCity.id,
          cityName: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          timezone: 'America/New_York', // TODO: Get from city
          thresholdTemp: thresholdTenths,
          resolveTime: new Date(resolveTime * 1000),
          isTest: true,
          testRunId: params.testRunId,
        },
      });

      markets.push({
        dbId: dbMarket.id,
        contractMarketId,
        cityName: city.name,
        thresholdTemp: thresholdTenths,
        resolveTime,
        transactionHash: txHash,
        gasUsed: gasUsed.toString(),
        gasCost: formatEther(gasCostWei),
        isTest: true,
      });
    }

    return {
      success: true,
      markets,
      totalGasCost: formatEther(totalGasCostWei),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      markets: [],
      totalGasCost: '0',
      error: errorMessage,
    };
  }
}

// ============================================================
// PLACE BETS
// ============================================================

/**
 * Place opposing bets with unequal amounts.
 *
 * SECURITY:
 * - NEVER logs private keys
 * - Alternates which wallet bets first (avoid patterns)
 * - Tracks all transaction hashes
 * - Waits for transaction receipts
 *
 * Pattern:
 * - Market 1: Wallet 0 YES, Wallet 1 NO
 * - Market 2: Wallet 1 YES, Wallet 0 NO
 * - Market 3: Wallet 0 YES, Wallet 1 NO
 * - etc.
 *
 * @param markets - Created test markets
 * @param wallets - Test wallets (at least 2)
 * @returns Array of bet results with transaction hashes
 * @throws Error if any bet fails
 */
export async function placeBets(
  markets: CreatedMarket[],
  wallets: TestWallet[]
): Promise<PlaceBetsResult> {
  try {
    const { rpcUrl, contractAddress } = validateEnv();

    if (wallets.length < 2) {
      throw new Error('At least 2 wallets required for opposing bets');
    }

    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const bets: BetResult[] = [];
    let totalGasCostWei = 0n;

    // Place bets for each market
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      if (!market) {
        throw new Error('Market not found for bet placement');
      }
      const betPattern = BET_AMOUNTS[i % BET_AMOUNTS.length];

      if (!betPattern) {
        throw new Error('Bet pattern not available for market index');
      }

      // Alternate which wallet bets first
      const yesWalletIdx = i % 2; // 0, 1, 0, 1, 0
      const noWalletIdx = (i + 1) % 2; // 1, 0, 1, 0, 1

      const yesWallet = wallets[yesWalletIdx];
      const noWallet = wallets[noWalletIdx];

      if (!yesWallet || !noWallet) {
        throw new Error('Insufficient wallets available for opposing bets');
      }

      // Place YES bet
      {
        const account = privateKeyToAccount(yesWallet.privateKey);
        const walletClient = createWalletClient({ transport: http(rpcUrl), account });

        const amountWei = parseEther(betPattern.yes);

        const { request } = await publicClient.simulateContract({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'placeBet',
          args: [BigInt(market.contractMarketId), true], // YES
          account: walletClient.account!,
          value: amountWei,
        });

        const txHash = await walletClient.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Calculate gas cost
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.effectiveGasPrice || 0n;
        const gasCostWei = gasUsed * gasPrice;
        totalGasCostWei += gasCostWei;

        bets.push({
          contractMarketId: market.contractMarketId,
          wallet: yesWallet.address,
          isYes: true,
          amount: betPattern.yes,
          transactionHash: txHash,
          gasUsed: gasUsed.toString(),
          gasCost: formatEther(gasCostWei),
        });
      }

      // Place NO bet
      {
        const account = privateKeyToAccount(noWallet.privateKey);
        const walletClient = createWalletClient({ transport: http(rpcUrl), account });

        const amountWei = parseEther(betPattern.no);

        const { request } = await publicClient.simulateContract({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'placeBet',
          args: [BigInt(market.contractMarketId), false], // NO
          account: walletClient.account!,
          value: amountWei,
        });

        const txHash = await walletClient.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Calculate gas cost
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.effectiveGasPrice || 0n;
        const gasCostWei = gasUsed * gasPrice;
        totalGasCostWei += gasCostWei;

        bets.push({
          contractMarketId: market.contractMarketId,
          wallet: noWallet.address,
          isYes: false,
          amount: betPattern.no,
          transactionHash: txHash,
          gasUsed: gasUsed.toString(),
          gasCost: formatEther(gasCostWei),
        });
      }
    }

    return {
      success: true,
      bets,
      totalGasCost: formatEther(totalGasCostWei),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      bets: [],
      totalGasCost: '0',
      error: errorMessage,
    };
  }
}

// ============================================================
// VERIFY PAYOUTS
// ============================================================

/**
 * Verify payouts after market settlement.
 *
 * FORMULA: expectedPayout = (myBet / winningPool) * losingPool * (1 - fee) + myBet
 *
 * TOLERANCE: 0.001 FLR difference allowed (for rounding)
 *
 * @param markets - Created test markets (must be resolved)
 * @param wallets - Test wallets
 * @param betResults - Bet results from placeBets()
 * @returns Payout verification results
 * @throws Error if markets not resolved or claim fails
 */
export async function verifyPayouts(
  markets: CreatedMarket[],
  wallets: TestWallet[],
  betResults: BetResult[]
): Promise<VerifyPayoutsResult> {
  try {
    const { rpcUrl, contractAddress } = validateEnv();

    const publicClient = createPublicClient({ transport: http(rpcUrl) });
    const verifications: PayoutVerification[] = [];
    let totalGasCostWei = 0n;

    for (const market of markets) {
      // Get market state
      const marketState = await publicClient.readContract({
        address: contractAddress,
        abi: WEATHER_MARKET_ABI,
        functionName: 'getMarket',
        args: [BigInt(market.contractMarketId)],
      });

      // Check if resolved
      if (marketState.status !== 2) {
        // MarketStatus.RESOLVED = 2
        throw new Error(`Market ${market.contractMarketId} not resolved yet`);
      }

      const outcome = marketState.outcome; // true = YES wins, false = NO wins
      const yesPool = marketState.yesPool;
      const noPool = marketState.noPool;
      const totalFees = marketState.totalFees;

      // Get winning pool and losing pool
      const winningPool = outcome ? yesPool : noPool;
      const losingPool = outcome ? noPool : yesPool;

      // Calculate fee percentage
      const feePercentage = Number(totalFees) / Number(losingPool);

      // Verify payout for each winning bet
      const marketBets = betResults.filter((b) => b.contractMarketId === market.contractMarketId);

      for (const bet of marketBets) {
        // Skip if this bet lost
        if (bet.isYes !== outcome) {
          continue;
        }

        // Find wallet
        const wallet = wallets.find((w) => w.address === bet.wallet);
        if (!wallet) {
          throw new Error(`Wallet not found: ${bet.wallet}`);
        }

        // Calculate expected payout
        const myBetWei = parseEther(bet.amount);
        const winnings = (myBetWei * losingPool * BigInt(Math.floor((1 - feePercentage) * 10000))) / winningPool / 10000n;
        const expectedPayoutWei = myBetWei + winnings;
        const expectedPayout = formatEther(expectedPayoutWei);

        // Claim winnings
        const account = privateKeyToAccount(wallet.privateKey);
        const walletClient = createWalletClient({ transport: http(rpcUrl), account });

        const { request } = await publicClient.simulateContract({
          address: contractAddress,
          abi: WEATHER_MARKET_ABI,
          functionName: 'claim',
          args: [BigInt(market.contractMarketId)],
          account: walletClient.account!,
        });

        const txHash = await walletClient.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Calculate gas cost
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.effectiveGasPrice || 0n;
        const gasCostWei = gasUsed * gasPrice;
        totalGasCostWei += gasCostWei;

        // Get actual payout from WinningsClaimed event
        let actualPayoutWei = 0n;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: WEATHER_MARKET_ABI,
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'WinningsClaimed') {
              actualPayoutWei = (decoded.args as { amount: bigint }).amount;
              break;
            }
          } catch {
            // Skip non-matching logs
          }
        }

        if (actualPayoutWei === 0n) {
          // Fallback: use calculatePayout
          actualPayoutWei = await publicClient.readContract({
            address: contractAddress,
            abi: WEATHER_MARKET_ABI,
            functionName: 'calculatePayout',
            args: [BigInt(market.contractMarketId), wallet.address],
          }) as bigint;
        }

        const actualPayout = formatEther(actualPayoutWei);

        // Verify payout within tolerance
        const difference = Math.abs(parseFloat(expectedPayout) - parseFloat(actualPayout));
        const verified = difference <= PAYOUT_TOLERANCE;

        const errorMessage = verified
          ? undefined
          : `Payout mismatch: expected ${expectedPayout} FLR, got ${actualPayout} FLR`;

        verifications.push({
          contractMarketId: market.contractMarketId,
          wallet: bet.wallet,
          isYes: bet.isYes,
          betAmount: bet.amount,
          expectedPayout,
          actualPayout,
          verified,
          gasUsed: gasUsed.toString(),
          gasCost: formatEther(gasCostWei),
          ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        });
      }
    }

    return {
      success: true,
      verifications,
      totalGasCost: formatEther(totalGasCostWei),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      verifications: [],
      totalGasCost: '0',
      error: errorMessage,
    };
  }
}
