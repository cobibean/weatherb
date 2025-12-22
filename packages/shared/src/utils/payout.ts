/**
 * Payout calculation utilities for WeatherB prediction markets.
 * 
 * Mirrors the on-chain PayoutMath.sol logic for frontend use.
 * Uses bigint for precision with large FLR amounts.
 */

/** Fee in basis points (1% = 100 bps) */
const FEE_BPS = 100n;
const BPS_DENOMINATOR = 10_000n;

/**
 * Calculate the 1% fee taken from the losing pool.
 */
export function feeFromLosingPool(losingPool: bigint): bigint {
  return (losingPool * FEE_BPS) / BPS_DENOMINATOR;
}

/**
 * Calculate the potential payout for a bettor if their side wins.
 * 
 * @param winningPool - Total in the winning pool (includes bettor's stake)
 * @param losingPool - Total in the losing pool
 * @param stake - Bettor's stake amount
 * @returns payout - Total amount the bettor would receive
 */
export function calculatePayoutForWinner(
  winningPool: bigint,
  losingPool: bigint,
  stake: bigint
): bigint {
  if (winningPool === 0n || stake === 0n) return 0n;
  
  const fee = feeFromLosingPool(losingPool);
  const netLosingPool = losingPool - fee;
  const winningsFromLosers = (netLosingPool * stake) / winningPool;
  
  return stake + winningsFromLosers;
}

/**
 * Calculate the potential payout for a new bet on a given side.
 * Includes the new bet in pool calculations.
 * 
 * @param yesPool - Current YES pool
 * @param noPool - Current NO pool
 * @param betAmount - Amount to bet
 * @param side - 'yes' or 'no'
 * @returns Object with payout, multiplier, and new odds
 */
export function calculatePotentialPayout(
  yesPool: bigint,
  noPool: bigint,
  betAmount: bigint,
  side: 'yes' | 'no'
): {
  payout: bigint;
  multiplier: number;
  profit: bigint;
  newYesPercent: number;
  newNoPercent: number;
} {
  if (betAmount === 0n) {
    const total = yesPool + noPool;
    const yesPercent = total === 0n ? 50 : Number((yesPool * 100n) / total);
    return {
      payout: 0n,
      multiplier: 0,
      profit: 0n,
      newYesPercent: yesPercent,
      newNoPercent: 100 - yesPercent,
    };
  }

  // Calculate new pools after bet
  const newYesPool = side === 'yes' ? yesPool + betAmount : yesPool;
  const newNoPool = side === 'no' ? noPool + betAmount : noPool;
  const totalPool = newYesPool + newNoPool;

  // Calculate payout if this side wins
  const winningPool = side === 'yes' ? newYesPool : newNoPool;
  const losingPool = side === 'yes' ? newNoPool : newYesPool;
  const payout = calculatePayoutForWinner(winningPool, losingPool, betAmount);

  // Calculate multiplier (payout / stake)
  // Use Number for display purposes (safe for UI ranges)
  const multiplier = betAmount > 0n 
    ? Number(payout * 1000n / betAmount) / 1000 
    : 0;

  // Calculate new odds percentages
  const newYesPercent = totalPool > 0n 
    ? Number((newYesPool * 100n) / totalPool) 
    : 50;
  const newNoPercent = 100 - newYesPercent;

  return {
    payout,
    multiplier,
    profit: payout - betAmount,
    newYesPercent,
    newNoPercent,
  };
}

/**
 * Calculate implied odds (what multiplier you'd get if you bet now).
 * Does NOT include the new bet in calculations - shows current market state.
 * 
 * @param yesPool - Current YES pool
 * @param noPool - Current NO pool
 * @returns Multipliers for each side
 */
export function getImpliedMultipliers(
  yesPool: bigint,
  noPool: bigint
): {
  yesMultiplier: number;
  noMultiplier: number;
  yesPercent: number;
  noPercent: number;
} {
  const totalPool = yesPool + noPool;
  
  if (totalPool === 0n) {
    return {
      yesMultiplier: 2.0,
      noMultiplier: 2.0,
      yesPercent: 50,
      noPercent: 50,
    };
  }

  // For a tiny bet, what would the multiplier be?
  // multiplier ≈ 1 + (losingPool * 0.99) / winningPool
  // When winningPool is the side you're betting on
  
  const yesNum = Number(yesPool);
  const noNum = Number(noPool);
  
  // YES multiplier: if YES wins, you get your stake + share of NO pool
  const yesMultiplier = yesNum > 0 
    ? 1 + (noNum * 0.99) / yesNum 
    : 99.0; // Massive payout if you're first
  
  // NO multiplier: if NO wins, you get your stake + share of YES pool
  const noMultiplier = noNum > 0 
    ? 1 + (yesNum * 0.99) / noNum 
    : 99.0;

  const yesPercent = Number((yesPool * 100n) / totalPool);
  const noPercent = 100 - yesPercent;

  return {
    yesMultiplier: Math.min(yesMultiplier, 99.0), // Cap for display
    noMultiplier: Math.min(noMultiplier, 99.0),
    yesPercent,
    noPercent,
  };
}

/**
 * Format a multiplier for display (e.g., "2.34x")
 */
export function formatMultiplier(multiplier: number): string {
  if (multiplier >= 99) return "99x+";
  if (multiplier >= 10) return `${Math.round(multiplier)}x`;
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Format a bigint FLR amount for display.
 * @param amount - Amount in wei (18 decimals)
 * @param decimals - Number of decimal places to show
 */
export function formatFlr(amount: bigint, decimals: number = 2): string {
  const wei = 10n ** 18n;
  const whole = amount / wei;
  const fraction = amount % wei;
  
  if (decimals === 0) {
    return whole.toString();
  }
  
  const divisor = 10n ** BigInt(18 - decimals);
  const fractionPart = (fraction / divisor).toString().padStart(decimals, '0');
  
  return `${whole}.${fractionPart}`;
}

