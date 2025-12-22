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
 * Note: Some of these are placeholders that will be populated from contract/services later.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const config = await getSystemConfig();
  
  // TODO: Fetch real data from contract and services
  // For now, return mock data
  return {
    providerStatus: 'healthy',
    marketsToday: 5,
    pendingSettlements: 0,
    fees24h: '0',
    totalVolume: '0',
    totalUsers: 0,
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

