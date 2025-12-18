import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createPublicClient, createWalletClient, http, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import type { MarketConfig } from './market-selector';
import { forecastTenthsToThresholdTenths } from './market-selector';

export type CreateMarketParams = {
  rpcUrl: string;
  contractAddress: Hex;
  privateKey: Hex;
};

export type CreateMarketResult = {
  marketId: bigint;
  transactionHash: Hex;
  thresholdTenths: number;
  forecastTempTenths: number;
};

function getClients(params: CreateMarketParams): {
  publicClient: PublicClient;
  walletClient: ReturnType<typeof createWalletClient>;
} {
  const publicClient = createPublicClient({ transport: http(params.rpcUrl) });
  const account = privateKeyToAccount(params.privateKey);
  const walletClient = createWalletClient({ transport: http(params.rpcUrl), account });
  return { publicClient, walletClient };
}

export async function createMarketOnChain(
  params: CreateMarketParams,
  config: MarketConfig,
): Promise<CreateMarketResult> {
  const provider = createWeatherProviderFromEnv();
  const forecastTempTenths = await provider.getForecast(
    config.city.latitude,
    config.city.longitude,
    config.resolveTimeSec,
  );
  const thresholdTenths = forecastTenthsToThresholdTenths(forecastTempTenths);

  const { publicClient, walletClient } = getClients(params);
  const { request, result } = await publicClient.simulateContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'createMarket',
    args: [
      config.cityIdBytes32,
      BigInt(config.resolveTimeSec),
      BigInt(thresholdTenths),
      '0x0000000000000000000000000000000000000000',
    ],
    account: walletClient.account,
  });

  const transactionHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  const marketId = result;

  return { marketId, transactionHash, thresholdTenths, forecastTempTenths };
}
