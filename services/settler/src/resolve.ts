import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { CITIES } from '@weatherb/shared/constants';
import { createContractClients, WEATHER_MARKET_ABI } from './contract';
import { keccak256, toBytes, type Hex } from 'viem';

import type { MarketOnChain } from './fetch-markets';

export type ResolveMarketParams = {
  rpcUrl: string;
  contractAddress: Hex;
  privateKey: Hex;
  market: MarketOnChain;
};

export type ResolveMarketResult = {
  transactionHash: Hex;
  observedTimestamp: number;
  tempTenths: number;
};

function findCityByBytes32(cityId: Hex) {
  return CITIES.find((c) => keccak256(toBytes(c.id)) === cityId) ?? null;
}

/**
 * Resolve a market by fetching weather data from the configured provider
 * and submitting the result directly to the smart contract.
 *
 * Flow:
 * 1. Look up city coordinates from cityId
 * 2. Fetch first weather reading at or after resolve time from provider
 * 3. Submit temperature + timestamp to contract via resolveMarket()
 *
 * The settler address is trusted by the contract (onlySettler modifier).
 */
export async function resolveMarket(
  params: ResolveMarketParams,
): Promise<ResolveMarketResult> {
  const city = findCityByBytes32(params.market.cityId);
  if (!city) throw new Error(`Unknown cityId bytes32: ${params.market.cityId}`);

  // Get reading from configured weather provider (MET Norway, NWS, or Open-Meteo)
  const provider = createWeatherProviderFromEnv();
  const reading = await provider.getFirstReadingAtOrAfter(
    city.latitude,
    city.longitude,
    params.market.resolveTimeSec,
  );

  const { publicClient, walletClient } = createContractClients({
    rpcUrl: params.rpcUrl,
    privateKey: params.privateKey,
  });

  // Call resolveMarket(marketId, tempTenths, observedTimestamp)
  const { request: txRequest } = await publicClient.simulateContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'resolveMarket',
    args: [
      params.market.marketId,
      BigInt(reading.tempF_tenths),
      BigInt(reading.observedTimestamp),
    ],
    account: walletClient.account,
  });

  const transactionHash = await walletClient.writeContract(txRequest);
  await publicClient.waitForTransactionReceipt({ hash: transactionHash });

  return {
    transactionHash,
    observedTimestamp: reading.observedTimestamp,
    tempTenths: reading.tempF_tenths,
  };
}
