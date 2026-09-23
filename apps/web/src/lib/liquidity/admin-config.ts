import { createPublicClient, http, type Hex } from 'viem';
import { ARC_TESTNET } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import prisma from '@/lib/prisma';
import { deploymentKey, parseSeedAmount, safeConfig, type ConfigPatch } from './config';

export class LiquidityConfigError extends Error {
  constructor(public readonly status: 400 | 403 | 409 | 503, message: string) { super(message); }
}

export function liquidityAdminWritesEnabled(): boolean {
  return process.env.LIQUIDITY_ADMIN_WRITES_ENABLED === 'true';
}

export async function getLiquidityConfig(): Promise<object> {
  const config = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  const worker = config.walletAddress && config.deploymentKey
    ? await prisma.liquidityWorkerState.findUnique({ where: { id: `${config.deploymentKey}:${config.walletAddress}` } })
    : null;
  const ready = !!worker?.ready && !!worker.lastHeartbeatAt && Date.now() - worker.lastHeartbeatAt.getTime() < 360_000;
  return safeConfig(config, { canEdit: liquidityAdminWritesEnabled(), workerReady: ready });
}

export async function saveLiquidityConfig(adminWallet: string, patch: ConfigPatch): Promise<object> {
  if (!liquidityAdminWritesEnabled()) throw new LiquidityConfigError(403, 'Liquidity editing is disabled');
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const rpcUrl = process.env.RPC_URL;
  const needsChain = patch.seedAmountUsdc !== undefined || patch.seedingEnabled === true;
  if (needsChain && (!address || !rpcUrl)) throw new LiquidityConfigError(503, 'Chain configuration unavailable');
  const key = address ? deploymentKey(address) : null;
  let wei: bigint | undefined;
  try {
    if (patch.seedAmountUsdc !== undefined) wei = parseSeedAmount(patch.seedAmountUsdc);
  } catch (error) {
    throw new LiquidityConfigError(400, error instanceof Error ? error.message : 'Invalid amount');
  }
  let minimum = 0n;
  let activation: { block: bigint; count: bigint } | null = null;
  if (needsChain && address && rpcUrl) try {
    const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http(rpcUrl, { timeout: 12_000 }) });
    if (await publicClient.getChainId() !== ARC_TESTNET.id) throw new Error('Unexpected chain');
    const version = await publicClient.readContract({ address, abi: WEATHER_MARKET_ABI, functionName: 'version' });
    if (version !== '2.4.0') throw new Error('Unexpected contract version');
    minimum = await publicClient.readContract({ address, abi: WEATHER_MARKET_ABI, functionName: 'minBetWei' });
    if (wei !== undefined && wei < minimum) throw new LiquidityConfigError(400, 'Amount is below the contract minimum');
    if (patch.seedingEnabled === true) {
      const block = await publicClient.getBlockNumber();
      const count = await publicClient.readContract({ address, abi: WEATHER_MARKET_ABI, functionName: 'getMarketCount', blockNumber: block });
      activation = { block, count };
    }
  } catch (error) {
    if (error instanceof LiquidityConfigError) throw error;
    throw new LiquidityConfigError(503, 'Chain readiness is unavailable');
  }
  const configured = await prisma.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (patch.seedingEnabled === true && BigInt(wei?.toString() ?? configured.seedAmountWei) < minimum)
    throw new LiquidityConfigError(400, 'Amount is below the contract minimum');
  if (configured.version !== patch.expectedVersion) throw new LiquidityConfigError(409, 'Settings changed; reload and reapply your edits');
  if (key && configured.deploymentKey && configured.deploymentKey !== key) throw new LiquidityConfigError(409, 'Liquidity deployment binding differs');
  if (patch.seedingEnabled === true && !configured.seedingEnabled) {
    if (!configured.walletAddress || !configured.deploymentKey || !key) throw new LiquidityConfigError(409, 'Market maker is not configured');
    const worker = await prisma.liquidityWorkerState.findUnique({ where: { id: `${key}:${configured.walletAddress}` } });
    if (!worker?.ready || !worker.lastHeartbeatAt || Date.now() - worker.lastHeartbeatAt.getTime() > 360_000)
      throw new LiquidityConfigError(409, 'Market maker readiness is stale');
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT "id" FROM "LiquidityConfig" WHERE "id" = 'default' FOR UPDATE`;
    const previous = await tx.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
    if (previous.version !== patch.expectedVersion) throw new LiquidityConfigError(409, 'Settings changed; reload and reapply your edits');
    if (key && previous.deploymentKey && previous.deploymentKey !== key) throw new LiquidityConfigError(409, 'Liquidity deployment binding differs');
    const firstEnable = patch.seedingEnabled === true && !previous.seedingEnabled && previous.firstEligibleMarketId === null;
    if (firstEnable && (!activation || activation.count > BigInt(Number.MAX_SAFE_INTEGER)))
      throw new LiquidityConfigError(503, 'Activation boundary unavailable');
    const update = await tx.liquidityConfig.update({ where: { id: 'default' }, data: {
      ...(wei !== undefined ? { seedAmountWei: wei.toString() } : {}),
      ...(patch.seedingEnabled !== undefined ? { seedingEnabled: patch.seedingEnabled } : {}),
      ...(patch.claimsEnabled !== undefined ? { claimsEnabled: patch.claimsEnabled } : {}),
      ...(firstEnable ? {
        firstEligibleMarketId: Number(activation!.count), activationBlockNumber: activation!.block,
        activatedAt: new Date(),
      } : {}),
      version: { increment: 1 }, updatedBy: adminWallet.toLowerCase(),
    } });
    await tx.adminLog.create({ data: {
      wallet: adminWallet.toLowerCase(), action: 'liquidity.config.update',
      details: {
        previous: { seedAmountWei: previous.seedAmountWei, seedingEnabled: previous.seedingEnabled, claimsEnabled: previous.claimsEnabled },
        next: { seedAmountWei: update.seedAmountWei, seedingEnabled: update.seedingEnabled, claimsEnabled: update.claimsEnabled },
        firstEligibleMarketId: update.firstEligibleMarketId,
        activationBlockNumber: update.activationBlockNumber?.toString() ?? null,
        version: update.version,
      },
    } });
  });
  return getLiquidityConfig();
}
