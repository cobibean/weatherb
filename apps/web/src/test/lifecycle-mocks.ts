import { vi } from 'vitest';
import { keccak256, toBytes } from 'viem';
import { CITIES } from '@weatherb/shared/constants';
import type { ChainMarket } from '@/lib/cron/market-state';
import { TEST_PRIVATE_KEY_A } from './public-safe-fixtures';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  config: vi.fn(),
  cities: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
  txReceipt: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  read: vi.fn(),
  simulate: vi.fn(),
  write: vi.fn(),
  receipt: vi.fn(),
  forecast: vi.fn(),
  reading: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    systemConfig: { findUnique: mocks.config },
    city: { findMany: mocks.cities },
    market: {
      count: mocks.count,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      aggregate: mocks.aggregate,
      update: mocks.update,
    },
    workerRun: { create: mocks.runCreate, update: mocks.runUpdate },
    $transaction: mocks.transaction,
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  },
}));
vi.mock('@/lib/cron', () => ({
  verifyCronRequest: mocks.auth,
  verifyWorkerRequest: mocks.auth,
  unauthorizedResponse: () => new Response('Unauthorized', { status: 401 }),
  createContractClients: () => ({
    publicClient: {
      getChainId: async () => 5042002,
      readContract: mocks.read,
      simulateContract: mocks.simulate,
      waitForTransactionReceipt: mocks.receipt,
      getTransactionReceipt: mocks.txReceipt,
    },
    walletClient: {
      account: { address: '0x0000000000000000000000000000000000000123' },
      writeContract: mocks.write,
    },
  }),
}));
vi.mock('@/lib/provider-health', () => ({
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}));
vi.mock('@weatherb/shared/providers', () => ({
  createWeatherProviderFromEnv: () => ({
    getForecast: mocks.forecast,
    getFirstReadingAtOrAfter: mocks.reading,
  }),
}));
vi.mock('@upstash/qstash', () => ({
  Client: class {
    publishJSON = mocks.publish;
  },
}));

export const chain: ChainMarket[] = [];
export const slots = new Map<bigint, bigint>();
export const rows = new Map<number, Record<string, unknown> & { isSettled: boolean }>();
export function market(overrides: Partial<ChainMarket> = {}): ChainMarket {
  return {
    cityId: keccak256(toBytes('nyc')),
    resolveTime: BigInt(Date.now() / 1000 - 100),
    bettingDeadline: BigInt(Date.now() / 1000 - 700),
    thresholdTenths: 850n,
    currency: '0x0000000000000000000000000000000000000000',
    status: 0,
    yesPool: 2n,
    noPool: 1n,
    totalFees: 0n,
    resolvedTempTenths: 0n,
    observedTimestamp: 0n,
    outcome: false,
    ...overrides,
  };
}
export function setupLifecycle(): void {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
  vi.stubEnv('SCHEDULER_PRIVATE_KEY', TEST_PRIVATE_KEY_A);
  vi.stubEnv('SETTLER_PRIVATE_KEY', TEST_PRIVATE_KEY_A);
  chain.length = 0;
  slots.clear();
  rows.clear();
  mocks.auth.mockReturnValue(true);
  mocks.config.mockResolvedValue({ isPaused: false, settlerPaused: false });
  mocks.cities.mockResolvedValue(CITIES.map((c) => ({ ...c, id: c.slug })));
  mocks.count.mockResolvedValue(0);
  mocks.forecast.mockResolvedValue(753);
  mocks.reading.mockImplementation(async () => ({
    tempF_tenths: 850,
    observedTimestamp: Date.now() / 1000,
    source: 'fixture',
  }));
  mocks.findUnique.mockImplementation(
    async ({ where }) => rows.get(where.contractMarketId) ?? null,
  );
  mocks.upsert.mockImplementation(async ({ where, create, update }) => {
    const existing = rows.get(where.contractMarketId);
    const next = existing ? { ...existing, ...update } : create;
    rows.set(where.contractMarketId, next);
    return next;
  });
  let deploymentKey: string | null = null;
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      $executeRaw: mocks.lock,
      systemConfig: {
        findUniqueOrThrow: async () => ({ deploymentKey }),
        update: async ({ data }: { data: { deploymentKey: string } }) => {
          deploymentKey = data.deploymentKey;
        },
      },
      market: { count: async () => rows.size, findUnique: mocks.findUnique, upsert: mocks.upsert },
    }),
  );
  mocks.read.mockImplementation(async ({ functionName, args }) => {
    if (functionName === 'version') return '2.4.0';
    if (functionName === 'getMarketCount') return BigInt(chain.length);
    if (functionName === 'getScheduledMarket') return slots.get(args[0]) ?? 0n;
    if (functionName === 'getMarket') return { ...chain[Number(args[0])] };
    throw new Error(`Unexpected read ${functionName}`);
  });
  mocks.simulate.mockImplementation(async (request) => ({ request, result: 9999n })); // Never trust simulated IDs.
  mocks.write.mockImplementation(async ({ functionName, args }) => {
    if (functionName === 'createScheduledMarket') {
      if (!slots.has(args[2])) {
        slots.set(args[2], BigInt(chain.length + 1));
        chain.push(
          market({
            cityId: args[0],
            thresholdTenths: args[1],
            resolveTime: BigInt(Date.now() / 1000) + BigInt(args[3] ?? 86400),
          }),
        );
      }
    } else {
      const entry = chain[Number(args[0])]!;
      if (functionName === 'cancelMarketBySettler') entry.status = 3;
      else if (functionName === 'resolveMarket') {
        entry.outcome = args[1] >= entry.thresholdTenths;
        entry.status = (entry.outcome ? entry.yesPool : entry.noPool) === 0n ? 4 : 2;
        entry.resolvedTempTenths = args[1];
        entry.observedTimestamp = args[2];
      } else throw new Error(`Unexpected write ${functionName}`);
    }
    return '0xreceipt';
  });
  mocks.receipt.mockResolvedValue({ status: 'success', logs: [] });
  mocks.update.mockImplementation(async ({ where, data }) => {
    const row = rows.get(where.contractMarketId) ?? { isSettled: false };
    const next = { ...row } as Record<string, unknown>;
    for (const [key, value] of Object.entries(data))
      next[key] =
        value && typeof value === 'object' && 'increment' in (value as object)
          ? Number(next[key] ?? 0) + (value as { increment: number }).increment
          : value;
    rows.set(where.contractMarketId, next as typeof row);
    return next;
  });
  mocks.findMany.mockImplementation(async ({ where } = {}) =>
    [...rows.entries()]
      .filter(([, row]) => (where?.isSettled === undefined ? true : row.isSettled === where.isSettled))
      .map(([contractMarketId, row]) => ({ contractMarketId, ...row })),
  );
  mocks.aggregate.mockImplementation(async () => ({
    _max: { contractMarketId: rows.size ? Math.max(...rows.keys()) : null },
  }));
  mocks.txReceipt.mockResolvedValue({ status: 'success' });
  mocks.runCreate.mockResolvedValue({ id: 'run-1' });
  mocks.runUpdate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([{ holder: 'run-1' }]);
  mocks.executeRaw.mockResolvedValue(1);
}

export { mocks };
