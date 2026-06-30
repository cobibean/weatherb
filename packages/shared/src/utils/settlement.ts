export type SettlementResult = {
  status: 'RESOLVED' | 'NO_WINNERS';
  outcome: 'YES' | 'NO';
  yesPool: string;
  noPool: string;
};

export type SettlementInput = {
  tempTenths: number;
  thresholdTenths: number;
  yesPool: bigint;
  noPool: bigint;
};

/**
 * Calculate settlement outcome for a weather market.
 *
 * Rules:
 * - YES wins on ties (>= threshold)
 * - NO_WINNERS when the winning side has no bets
 */
export function calculateSettlement(params: SettlementInput): SettlementResult {
  const { tempTenths, thresholdTenths, yesPool, noPool } = params;
  const outcome: 'YES' | 'NO' = tempTenths >= thresholdTenths ? 'YES' : 'NO';
  const winningPool = outcome === 'YES' ? yesPool : noPool;
  const status: SettlementResult['status'] = winningPool === 0n ? 'NO_WINNERS' : 'RESOLVED';

  return {
    status,
    outcome,
    yesPool: yesPool.toString(),
    noPool: noPool.toString(),
  };
}
