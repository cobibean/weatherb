import { assertArcChain, SUPPORTED_CONTRACT_VERSIONS, isSupportedContractVersion } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import {
  keccak256,
  toBytes,
  type Hex,
  type PublicClient,
  type ContractFunctionReturnType,
} from 'viem';
import prisma from '@/lib/prisma';
import type { LiquidityClassification } from '@prisma/client';

export async function requireRestartContract(client: PublicClient, address: Hex): Promise<void> {
  assertArcChain(await client.getChainId());
  const version = await client.readContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'version',
  });
  if (!isSupportedContractVersion(version))
    throw new Error(`Automation requires the Arc restart contract (${SUPPORTED_CONTRACT_VERSIONS.join(' or ')})`);
  await bindDeployment(await client.getChainId(), address);
}

/** Refuse accidental reuse of records belonging to a different chain or deployment. */
export async function bindDeployment(chainId: number, address: Hex): Promise<void> {
  const deploymentKey = `${chainId}:${address.toLowerCase()}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(-20260919::bigint)`;
    const config = await tx.systemConfig.findUniqueOrThrow({ where: { id: 'default' } });
    if (config.deploymentKey === deploymentKey) return;
    if (config.deploymentKey || (await tx.market.count()) > 0) {
      throw new Error(
        'Database belongs to another deployment or contains unbound market history; use a fresh database',
      );
    }
    await tx.systemConfig.update({ where: { id: 'default' }, data: { deploymentKey } });
  });
}

export type ChainMarket = ContractFunctionReturnType<
  typeof WEATHER_MARKET_ABI,
  'view',
  'getMarket'
>;

export async function readMarket(
  client: PublicClient,
  address: Hex,
  id: bigint,
): Promise<ChainMarket> {
  return client.readContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarket',
    args: [id],
  });
}
const STATUSES = ['OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED', 'NO_WINNERS'] as const;
export const isTerminal = (market: ChainMarket): boolean =>
  market.status >= 2 && market.status <= 4;

/** Chain state is authoritative. Upsert is atomic and never resets a settled row to OPEN. */
export async function persistMarket(id: bigint, market: ChainMarket, classification?: LiquidityClassification): Promise<void> {
  const contractMarketId = Number(id);
  if (!Number.isSafeInteger(contractMarketId) || contractMarketId < 0)
    throw new Error('Invalid market ID');
  const cities = await prisma.city.findMany(); // Includes deactivated cities with outstanding markets.
  const city = cities.find(
    (candidate) => keccak256(toBytes(candidate.slug)).toLowerCase() === market.cityId.toLowerCase(),
  );
  if (!city) throw new Error(`Cannot reconcile market ${id}: unknown city hash`);
  const status = STATUSES[market.status];
  if (!status) throw new Error(`Invalid chain market status: ${market.status}`);
  const settled = isTerminal(market);
  const resolved = market.status === 2 || market.status === 4;
  const data = {
    cityId: city.id,
    cityName: city.name,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    thresholdTemp: Number(market.thresholdTenths),
    resolveTime: new Date(Number(market.resolveTime) * 1000),
    status,
    totalFees: market.totalFees.toString(),
    yesPool: market.yesPool.toString(),
    noPool: market.noPool.toString(),
    isSettled: settled,
    actualTemp: resolved ? Number(market.resolvedTempTenths) : null,
    outcome: resolved ? (market.outcome ? 'YES' : 'NO') : null,
  };
  // Serializes concurrent snapshots for this ID. A delayed OPEN read must not undo settlement.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${contractMarketId}::bigint)`;
    const existing = await tx.market.findUnique({ where: { contractMarketId } });
    if (existing?.isSettled) {
      if (classification && existing.liquidityClassification === 'UNKNOWN')
        await tx.market.update({ where: { contractMarketId }, data: { liquidityClassification: classification, isTest: classification === 'TEST' } });
      return;
    }
    if (existing && classification && existing.liquidityClassification !== 'UNKNOWN' && existing.liquidityClassification !== classification)
      throw new Error('Conflicting market liquidity classification');
    await tx.market.upsert({
      where: { contractMarketId },
      create: { contractMarketId, ...data, isTest: classification === 'TEST', liquidityClassification: classification ?? 'UNKNOWN', settledAt: settled ? new Date() : null },
      update: { ...data, ...(classification ? { isTest: classification === 'TEST', liquidityClassification: classification } : {}), settledAt: settled ? new Date() : null },
    });
  });
}

/** A full scan is deliberately bounded to the small fresh-deployment lifecycle. */
export async function reconcileMarkets(client: PublicClient, address: Hex): Promise<bigint[]> {
  const count = await client.readContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });
  const ids: bigint[] = [];
  for (let id = 0n; id < count; id++) {
    const market = await readMarket(client, address, id);
    await persistMarket(id, market);
    if (!isTerminal(market)) ids.push(id);
  }
  return ids;
}

/** Terminal chain state is immutable, so settled rows are skipped; IDs above the DB high-water mark are new. */
export async function reconcileOutstandingMarkets(
  client: PublicClient,
  address: Hex,
): Promise<bigint[]> {
  const count = await client.readContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });
  const [open, known] = await Promise.all([
    prisma.market.findMany({ where: { isSettled: false }, select: { contractMarketId: true } }),
    prisma.market.aggregate({ _max: { contractMarketId: true } }),
  ]);
  const ids = new Set<bigint>(open.map((row) => BigInt(row.contractMarketId)));
  for (let id = BigInt((known._max.contractMarketId ?? -1) + 1); id < count; id++) ids.add(id);
  const pending: bigint[] = [];
  for (const id of [...ids].sort((a, b) => (a < b ? -1 : 1))) {
    const market = await readMarket(client, address, id);
    await persistMarket(id, market);
    if (!isTerminal(market)) pending.push(id);
  }
  return pending;
}
