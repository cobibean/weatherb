import { createPublicClient, http, keccak256, parseAbiItem, toBytes, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { CITIES } from '@weatherb/shared/constants';
import { formatFlr } from '@weatherb/shared/utils/payout';
import { readProviderHealth, type ProviderHealth } from './provider-health';
import prisma from './prisma';

export interface AdminStats {
  providerStatus: 'healthy' | 'degraded' | 'down';
  marketsToday: number;
  pendingSettlements: number;
  fees24h: string;
  totalVolume: string;
  totalUsers: number;
  isPaused: boolean;
  isSettlerPaused: boolean;
}

export type AdminMarketStatus = 'Open' | 'Closed' | 'Resolved' | 'Cancelled';

export type AdminMarket = {
  id: number;
  cityId: string;
  cityName: string;
  resolveTime: number;
  thresholdTenths: number;
  status: AdminMarketStatus;
  yesPool: string;
  noPool: string;
  outcome?: boolean;
  resolvedTemp?: number;
};

export interface SystemConfigData {
  cadence: number;
  testMode: boolean;
  dailyCount: number;
  bettingBuffer: number;
  isPaused: boolean;
  settlerPaused: boolean;
}

/**
 * Get or create the default system config.
 */
export async function getSystemConfig(): Promise<SystemConfigData> {
  let config = await prisma.systemConfig.findUnique({
    where: { id: 'default' },
  });

  if (!config) {
    config = await prisma.systemConfig.create({
      data: { id: 'default' },
    });
  }

  return {
    cadence: config.cadence,
    testMode: config.testMode,
    dailyCount: config.dailyCount,
    bettingBuffer: config.bettingBuffer,
    isPaused: config.isPaused,
    settlerPaused: config.settlerPaused,
  };
}

/**
 * Update system config.
 */
export async function updateSystemConfig(
  data: Partial<Omit<SystemConfigData, 'isPaused' | 'settlerPaused'>>
): Promise<SystemConfigData> {
  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      ...data,
    },
    update: data,
  });

  return {
    cadence: config.cadence,
    testMode: config.testMode,
    dailyCount: config.dailyCount,
    bettingBuffer: config.bettingBuffer,
    isPaused: config.isPaused,
    settlerPaused: config.settlerPaused,
  };
}

type AdminMarketRaw = {
  id: number;
  cityId: string;
  cityName: string;
  resolveTime: number;
  bettingDeadline: number;
  thresholdTenths: number;
  status: AdminMarketStatus;
  yesPool: bigint;
  noPool: bigint;
  totalFees: bigint;
  resolvedTempTenths?: number;
  observedTimestamp?: number;
  outcome?: boolean;
};

const STATUS_MAP: readonly AdminMarketStatus[] = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

function getContractAddress(): Hex {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  if (!address) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is required');
  }
  return address;
}

function getRpcUrl(): string {
  const url = process.env.RPC_URL;
  if (!url) {
    throw new Error('RPC_URL environment variable is required');
  }
  return url;
}

function getClient() {
  return createPublicClient({
    transport: http(getRpcUrl()),
  });
}

function findCityByBytes32(cityIdHex: Hex): { id: string; name: string } | null {
  for (const city of CITIES) {
    const hash = keccak256(toBytes(city.id));
    if (hash.toLowerCase() === cityIdHex.toLowerCase()) {
      return {
        id: city.id,
        name: city.name,
      };
    }
  }
  return null;
}

export function mapMarketStatus(statusNum: number, bettingDeadlineSec: number, nowSec: number): AdminMarketStatus {
  if (statusNum === 0 && nowSec >= bettingDeadlineSec) {
    return 'Closed';
  }
  return STATUS_MAP[statusNum] ?? 'Open';
}

function toResolvedTemp(resolvedTempTenths?: number): number | undefined {
  if (resolvedTempTenths === undefined) return undefined;
  return Math.round(resolvedTempTenths / 10);
}

async function fetchAdminMarketsRaw(): Promise<AdminMarketRaw[]> {
  const client = getClient();
  const contractAddress = getContractAddress();
  const count = await client.readContract({
    address: contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });

  const markets: AdminMarketRaw[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (let i = 0n; i < count; i += 1n) {
    const marketData = await client.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [i],
    });

    const city = findCityByBytes32(marketData.cityId);
    if (!city) {
      continue;
    }

    const status = mapMarketStatus(
      Number(marketData.status),
      Number(marketData.bettingDeadline),
      nowSec
    );

    const market: AdminMarketRaw = {
      id: Number(i),
      cityId: city.id,
      cityName: city.name,
      resolveTime: Number(marketData.resolveTime) * 1000,
      bettingDeadline: Number(marketData.bettingDeadline) * 1000,
      thresholdTenths: Number(marketData.thresholdTenths),
      status,
      yesPool: marketData.yesPool,
      noPool: marketData.noPool,
      totalFees: marketData.totalFees,
    };

    if (status === 'Resolved') {
      market.resolvedTempTenths = Number(marketData.resolvedTempTenths);
      market.observedTimestamp = Number(marketData.observedTimestamp) * 1000;
      market.outcome = marketData.outcome;
    }

    markets.push(market);
  }

  return markets;
}

export async function getAdminMarkets(): Promise<AdminMarket[]> {
  const markets = await fetchAdminMarketsRaw();
  return markets.map((market) => {
    const resolvedTemp = toResolvedTemp(market.resolvedTempTenths);
    return {
      id: market.id,
      cityId: market.cityId,
      cityName: market.cityName,
      resolveTime: market.resolveTime,
      thresholdTenths: market.thresholdTenths,
      status: market.status,
      yesPool: formatFlr(market.yesPool),
      noPool: formatFlr(market.noPool),
      ...(market.outcome !== undefined ? { outcome: market.outcome } : {}),
      ...(resolvedTemp !== undefined ? { resolvedTemp } : {}),
    };
  });
}

async function fetchUniqueBettorCount(): Promise<number> {
  const fromBlockEnv = process.env.CONTRACT_DEPLOY_BLOCK;
  if (!fromBlockEnv) return 0;

  let fromBlock: bigint;
  try {
    fromBlock = BigInt(fromBlockEnv);
  } catch {
    return 0;
  }

  const client = getClient();
  const contractAddress = getContractAddress();
  const betPlacedEvent = parseAbiItem(
    'event BetPlaced(uint256 indexed marketId, address indexed bettor, bool isYes, uint256 amount)'
  );

  const latestBlock = await client.getBlockNumber();
  const logs = await fetchLogsInBatches({
    client,
    address: contractAddress,
    event: betPlacedEvent,
    fromBlock,
    toBlock: latestBlock,
    maxRange: 30n,
  });

  const wallets = new Set<string>();
  for (const log of logs) {
    const bettor = log.args?.bettor;
    if (bettor) {
      wallets.add(bettor.toLowerCase());
    }
  }

  return wallets.size;
}

async function fetchLogsInBatches(params: {
  client: ReturnType<typeof getClient>;
  address: Hex;
  event: ReturnType<typeof parseAbiItem>;
  fromBlock: bigint;
  toBlock: bigint;
  maxRange: bigint;
}) {
  const logs: Awaited<ReturnType<typeof params.client.getLogs>> = [];
  let start = params.fromBlock;

  while (start <= params.toBlock) {
    const end = start + params.maxRange - 1n <= params.toBlock
      ? start + params.maxRange - 1n
      : params.toBlock;

    const batch = await params.client.getLogs({
      address: params.address,
      event: params.event,
      fromBlock: start,
      toBlock: end,
    });

    logs.push(...batch);
    start = end + 1n;
  }

  return logs;
}

export function deriveProviderStatus(health: ProviderHealth | null, nowMs: number = Date.now()): AdminStats['providerStatus'] {
  if (!health) return 'degraded';

  const lastSuccessMs = health.lastSuccessAt ? Date.parse(health.lastSuccessAt) : Number.NEGATIVE_INFINITY;
  const lastErrorMs = health.lastErrorAt ? Date.parse(health.lastErrorAt) : Number.NEGATIVE_INFINITY;
  const successAgeMs = nowMs - lastSuccessMs;
  const errorAgeMs = nowMs - lastErrorMs;

  if (!Number.isFinite(lastSuccessMs) || successAgeMs > 60 * 60 * 1000) {
    return 'down';
  }

  if (errorAgeMs < 30 * 60 * 1000 || health.recentErrors >= 3) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Toggle the global pause state.
 */
export async function togglePause(isPaused: boolean): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', isPaused },
    update: { isPaused },
  });
}

/**
 * Toggle the settler pause state.
 */
export async function toggleSettlerPause(settlerPaused: boolean): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', settlerPaused },
    update: { settlerPaused },
  });
}

/**
 * Get admin stats for dashboard.
 * Aggregates on-chain markets and provider health data.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const config = await getSystemConfig();

  const [markets, providerHealth, totalUsers] = await Promise.all([
    fetchAdminMarketsRaw(),
    readProviderHealth(),
    fetchUniqueBettorCount(),
  ]);

  const nowMs = Date.now();
  const dayStart = new Date(nowMs);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  const marketsToday = markets.filter(
    (market) => market.resolveTime >= dayStartMs && market.resolveTime < dayEndMs
  ).length;

  const pendingSettlements = markets.filter(
    (market) =>
      (market.status === 'Open' || market.status === 'Closed') &&
      market.resolveTime <= nowMs
  ).length;

  const totalVolumeWei = markets.reduce(
    (total, market) => total + market.yesPool + market.noPool,
    0n
  );

  const recentCutoffMs = nowMs - 24 * 60 * 60 * 1000;
  const fees24hWei = markets.reduce((total, market) => {
    if (market.status !== 'Resolved') return total;
    const resolvedAt = market.observedTimestamp ?? market.resolveTime;
    if (resolvedAt < recentCutoffMs) return total;
    return total + market.totalFees;
  }, 0n);

  const providerStatus = deriveProviderStatus(providerHealth, nowMs);

  return {
    providerStatus,
    marketsToday,
    pendingSettlements,
    fees24h: formatFlr(fees24hWei),
    totalVolume: formatFlr(totalVolumeWei),
    totalUsers,
    isPaused: config.isPaused,
    isSettlerPaused: config.settlerPaused,
  };
}

/**
 * Get all cities.
 */
export async function getCities() {
  return prisma.city.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

/**
 * Get active cities only.
 */
export async function getActiveCities() {
  return prisma.city.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Create a new city.
 */
export async function createCity(data: {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}) {
  return prisma.city.create({ data });
}

/**
 * Toggle city active status.
 */
export async function toggleCityActive(id: string, isActive: boolean) {
  return prisma.city.update({
    where: { id },
    data: { isActive },
  });
}

/**
 * Get recent admin logs.
 */
export async function getRecentLogs(limit = 50) {
  return prisma.adminLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get logs with pagination.
 */
export async function getLogs(options: {
  page?: number;
  limit?: number;
  action?: string;
  wallet?: string;
}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (options.action) where.action = options.action;
  if (options.wallet) where.wallet = options.wallet.toLowerCase();

  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.adminLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
