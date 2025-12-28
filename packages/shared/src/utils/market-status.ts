import type { MarketStatus } from '../types/market';

/**
 * Convert contract status enum (uint8) to MarketStatus type.
 *
 * Contract status enum:
 * - 0: Open
 * - 1: Closed (betting ended, awaiting settlement)
 * - 2: Resolved (settled with winner)
 * - 3: Cancelled (manually cancelled by admin)
 * - 4: NoWinners (settled but no bets on winning side)
 *
 * @param statusNum - Contract status enum value
 * @returns MarketStatus type string
 */
export function toMarketStatus(statusNum: number): MarketStatus {
  switch (statusNum) {
    case 0:
      return 'open';
    case 1:
      return 'closed';
    case 2:
      return 'resolved';
    case 3:
      return 'cancelled';
    case 4:
      return 'noWinners';
    default: {
      console.warn(`Unknown market status: ${statusNum}, defaulting to 'open'`);
      return 'open';
    }
  }
}
