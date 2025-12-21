import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { CITIES } from '@weatherb/shared/constants';
import { prepareMetNoAttestationRequest, submitAndWaitForProof } from './fdc';
import { createContractClients, WEATHER_MARKET_ABI } from './contract';
import { encodeAbiParameters, keccak256, toBytes, type Hex } from 'viem';
import { z } from 'zod';

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

export async function resolveMarketWithFdc(
  params: ResolveMarketParams,
): Promise<ResolveMarketResult> {
  const city = findCityByBytes32(params.market.cityId);
  if (!city) throw new Error(`Unknown cityId bytes32: ${params.market.cityId}`);

  // Get reading from our configured weather provider (for fallback/comparison)
  const provider = createWeatherProviderFromEnv();
  const reading = await provider.getFirstReadingAtOrAfter(
    city.latitude,
    city.longitude,
    params.market.resolveTimeSec,
  );

  // Prepare FDC attestation request using MET Norway API
  const request = prepareMetNoAttestationRequest({
    latitude: city.latitude,
    longitude: city.longitude,
    targetTimestamp: params.market.resolveTimeSec,
    cityIdBytes32: params.market.cityId,
  });

  // Submit to FDC and wait for proof
  // NOTE: This will throw until on-chain FdcHub submission is implemented
  const { proof, attestationData } = await submitAndWaitForProof(request);

  const hexBytesSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);
  const proofHex = hexBytesSchema.parse(proof) as Hex;

  // Parse attestation data from FDC response
  // The FDC returns the data matching our abiSignature
  let attestationHex: Hex;
  try {
    // Try to use FDC attestation data directly if it's already ABI-encoded
    attestationHex = hexBytesSchema.parse(attestationData) as Hex;
  } catch {
    // Fallback: encode from provider reading (for development/testing)
    attestationHex = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint64' }, { type: 'uint256' }],
      [params.market.cityId, BigInt(reading.observedTimestamp), BigInt(reading.tempF_tenths)],
    );
  }

  const { publicClient, walletClient } = createContractClients({
    rpcUrl: params.rpcUrl,
    privateKey: params.privateKey,
  });

  const { request: txRequest } = await publicClient.simulateContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'resolveMarket',
    args: [params.market.marketId, proofHex, attestationHex],
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
