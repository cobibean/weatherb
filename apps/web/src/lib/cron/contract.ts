import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createPublicClient, createWalletClient, http, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type ContractClients = {
  publicClient: PublicClient;
  walletClient: WalletClient;
};

/**
 * Create viem public and wallet clients for interacting with the WeatherMarket contract.
 * Ported from services/settler/src/contract.ts
 */
export function createContractClients(params: {
  rpcUrl: string;
  privateKey: Hex;
}): ContractClients {
  const publicClient = createPublicClient({ transport: http(params.rpcUrl) });
  const account = privateKeyToAccount(params.privateKey);
  const walletClient = createWalletClient({ transport: http(params.rpcUrl), account });
  return { publicClient, walletClient };
}

export { WEATHER_MARKET_ABI };

