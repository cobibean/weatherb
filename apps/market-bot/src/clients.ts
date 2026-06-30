import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareTestnet } from 'viem/chains';
import { config } from './config.js';

// Singleton public client for reading contract state
export const publicClient: PublicClient = createPublicClient({
  chain: flareTestnet,
  transport: http(config.rpcUrl),
});

// Factory for creating wallet clients (one per bot wallet)
export function createBotWalletClient(privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: flareTestnet,
    transport: http(config.rpcUrl),
  });
}

// Treasury wallet client (singleton)
let _treasuryClient: WalletClient | null = null;

export function getTreasuryClient(): WalletClient {
  if (!_treasuryClient) {
    const account = privateKeyToAccount(config.treasuryPrivateKey as Hex);
    _treasuryClient = createWalletClient({
      account,
      chain: flareTestnet,
      transport: http(config.rpcUrl),
    });
  }
  return _treasuryClient;
}

/**
 * Get treasury wallet balance
 */
export async function getTreasuryBalance(): Promise<bigint> {
  const treasury = getTreasuryClient();
  return await publicClient.getBalance({ address: treasury.account!.address });
}
