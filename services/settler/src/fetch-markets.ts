import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createPublicClient, http, type Hex } from 'viem';

export type MarketStatus = 'Open' | 'Closed' | 'Resolved' | 'Cancelled';

export type MarketOnChain = {
  marketId: bigint;
  cityId: Hex;
  resolveTimeSec: number;
  bettingDeadlineSec: number;
  thresholdTenths: bigint;
  currency: Hex;
  status: MarketStatus;
};

const STATUS: readonly MarketStatus[] = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

export async function fetchPendingMarkets(params: {
  rpcUrl: string;
  contractAddress: Hex;
}): Promise<MarketOnChain[]> {
  const client = createPublicClient({ transport: http(params.rpcUrl) });
  const count = await client.readContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  const pending: MarketOnChain[] = [];
  for (let i = 0n; i < count; i += 1n) {
    const market = await client.readContract({
      address: params.contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const statusIdx = Number(market.status);
    const status = STATUS[statusIdx] ?? 'Open';
    if (status === 'Resolved' || status === 'Cancelled') continue;

    pending.push({
      marketId: i,
      cityId: market.cityId,
      resolveTimeSec: Number(market.resolveTime),
      bettingDeadlineSec: Number(market.bettingDeadline),
      thresholdTenths: market.thresholdTenths,
      currency: market.currency,
      status,
    });
  }

  return pending;
}
