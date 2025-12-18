import type { Hex } from 'viem';

import { fetchPendingMarkets } from './fetch-markets';
import { createContractClients, WEATHER_MARKET_ABI } from './contract';

export type CancelEligibleParams = {
  rpcUrl: string;
  contractAddress: Hex;
  privateKey: Hex;
};

export async function cancelEligibleMarkets(
  params: CancelEligibleParams,
): Promise<{ cancelled: number }> {
  const pending = await fetchPendingMarkets({
    rpcUrl: params.rpcUrl,
    contractAddress: params.contractAddress,
  });
  const nowSec = Math.floor(Date.now() / 1000);
  const eligible = pending.filter((m) => nowSec >= m.resolveTimeSec);

  if (eligible.length === 0) return { cancelled: 0 };

  const { publicClient, walletClient } = createContractClients({
    rpcUrl: params.rpcUrl,
    privateKey: params.privateKey,
  });

  let cancelled = 0;
  for (const market of eligible) {
    const { request } = await publicClient.simulateContract({
      address: params.contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'cancelMarketBySettler',
      args: [market.marketId],
      account: walletClient.account,
    });
    const tx = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    cancelled += 1;
  }

  return { cancelled };
}
