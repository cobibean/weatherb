import { createContractClients } from './cron/contract';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type AdminContractClients = {
  publicClient: ReturnType<typeof createContractClients>['publicClient'];
  walletClient: ReturnType<typeof createContractClients>['walletClient'];
  contractAddress: Hex;
  abi: typeof WEATHER_MARKET_ABI;
};

async function resolveOwnerPrivateKey(params: {
  rpcUrl: string;
  contractAddress: Hex;
}): Promise<Hex> {
  const adminKey = process.env.ADMIN_PRIVATE_KEY as Hex | undefined;
  const schedulerKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;

  if (!adminKey && !schedulerKey) {
    throw new Error('Missing ADMIN_PRIVATE_KEY or SCHEDULER_PRIVATE_KEY environment variable');
  }

  const publicClient = createPublicClient({ transport: http(params.rpcUrl) });
  const owner = await publicClient.readContract({
    address: params.contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'owner',
  });

  const ownerLower = (owner as string).toLowerCase();
  if (adminKey) {
    const adminAccount = privateKeyToAccount(adminKey);
    if (adminAccount.address.toLowerCase() === ownerLower) {
      return adminKey;
    }
  }

  if (schedulerKey) {
    const schedulerAccount = privateKeyToAccount(schedulerKey);
    if (schedulerAccount.address.toLowerCase() === ownerLower) {
      return schedulerKey;
    }
  }

  throw new Error(`Admin key does not match contract owner ${ownerLower}`);
}

/**
 * Get contract clients configured for admin operations.
 * Uses ADMIN_PRIVATE_KEY env var - wallet must be contract owner.
 */
export async function getAdminContractClients(): Promise<AdminContractClients> {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;

  if (!rpcUrl) {
    throw new Error('Missing RPC_URL environment variable');
  }
  if (!contractAddress) {
    throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS environment variable');
  }

  const privateKey = await resolveOwnerPrivateKey({ rpcUrl, contractAddress });
  const clients = createContractClients({ rpcUrl, privateKey });

  return {
    ...clients,
    contractAddress,
    abi: WEATHER_MARKET_ABI,
  };
}

/**
 * Cancel a market on-chain.
 * @returns Transaction hash
 */
export async function cancelMarketOnChain(marketId: number): Promise<Hex> {
  const { publicClient, walletClient, contractAddress, abi } = await getAdminContractClients();

  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi,
    functionName: 'cancelMarket',
    args: [BigInt(marketId)],
    account: walletClient.account!,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

/**
 * Pause or unpause the contract on-chain.
 * @returns Transaction hash
 */
export async function setPausedOnChain(isPaused: boolean): Promise<Hex> {
  const { publicClient, walletClient, contractAddress, abi } = await getAdminContractClients();

  const functionName = isPaused ? 'pause' : 'unpause';

  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi,
    functionName,
    args: [],
    account: walletClient.account!,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

/**
 * Get the current paused state from the contract.
 */
export async function getContractPausedState(): Promise<boolean> {
  const { publicClient, contractAddress, abi } = await getAdminContractClients();

  const paused = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: 'paused',
  });

  return paused as boolean;
}
