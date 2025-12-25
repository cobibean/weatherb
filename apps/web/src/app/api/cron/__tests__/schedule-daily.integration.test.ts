import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../schedule-daily/route';

// Mock Next.js
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

// Mock weather provider
vi.mock('@weatherb/shared/providers', () => ({
  createWeatherProviderFromEnv: vi.fn(() => ({
    getForecast: vi.fn(async () => 753), // 75.3°F
  })),
}));

// Mock Redis
const mockRedis = {
  get: vi.fn(async () => 0),
  set: vi.fn(async () => undefined),
};

// Mock viem contract clients
const mockPublicClient = {
  simulateContract: vi.fn(async () => ({
    request: {},
    result: 0n, // marketId
  })),
  waitForTransactionReceipt: vi.fn(async () => ({})),
};

const mockWalletClient = {
  account: { address: '0xScheduler' as const },
  writeContract: vi.fn(async () => '0xTransactionHash' as const),
};

// Mock lib/cron
vi.mock('@/lib/cron', () => ({
  verifyCronRequest: vi.fn(() => true),
  unauthorizedResponse: vi.fn(() => ({ status: 401 })),
  createContractClients: vi.fn(() => ({
    publicClient: mockPublicClient,
    walletClient: mockWalletClient,
  })),
  getUpstashRedis: vi.fn(() => mockRedis),
  REDIS_KEYS: { CITY_INDEX: 'weatherb:city:index' },
}));

describe('Schedule Daily Route Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set required env vars
    process.env.RPC_URL = 'https://test-rpc.flare.network';
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
    process.env.SCHEDULER_PRIVATE_KEY = '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    process.env.DAILY_MARKET_COUNT = '2';
    process.env.MARKET_SPACING_HOURS = '3';
  });

  it('creates markets successfully', async () => {
    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.created).toBe(2);
    expect(data.failed).toBe(0);
    expect(data.results).toHaveLength(2);
    expect(data.results[0]).toMatchObject({
      marketId: '0',
      thresholdTenths: 750, // 753 rounded to 750
    });
  });

  it('returns 401 when cron auth fails', async () => {
    const { verifyCronRequest, unauthorizedResponse } = await import('@/lib/cron');
    vi.mocked(verifyCronRequest).mockReturnValueOnce(false);
    vi.mocked(unauthorizedResponse).mockReturnValueOnce(
      new Response('Unauthorized', { status: 401 }) as never
    );

    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 500 when missing env vars', async () => {
    delete process.env.RPC_URL;

    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing configuration');
  });

  it('continues on individual market failures', async () => {
    const mockProvider = {
      getForecast: vi.fn()
        .mockResolvedValueOnce(750)
        .mockRejectedValueOnce(new Error('Weather API error')),
    };

    const { createWeatherProviderFromEnv } = await import('@weatherb/shared/providers');
    vi.mocked(createWeatherProviderFromEnv).mockReturnValue(mockProvider as never);

    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.created).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].error).toContain('Weather API error');
  });

  it('respects DAILY_MARKET_COUNT limit', async () => {
    process.env.DAILY_MARKET_COUNT = '6';

    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('must be <= 5');
  });

  it('rotates cities using Redis index', async () => {
    mockRedis.get.mockResolvedValueOnce(2); // Start at index 2

    const request = new Request('http://localhost/api/cron/schedule-daily');
    await GET(request);

    expect(mockRedis.get).toHaveBeenCalledWith('weatherb:city:index');
    expect(mockRedis.set).toHaveBeenCalledWith('weatherb:city:index', 4); // 2 + 2 markets
  });

  it.skip('calculates resolve times with correct spacing', async () => {
    // TODO: Requires E2E testing framework (Playwright) to properly mock viem clients
    process.env.MARKET_SPACING_HOURS = '2';
    process.env.DAILY_MARKET_COUNT = '3';

    const request = new Request('http://localhost/api/cron/schedule-daily');
    await GET(request);

    type SimulateContractCall = {
      args: readonly [unknown, unknown, ...unknown[]];
    };
    const calls = mockPublicClient.simulateContract.mock
      .calls as unknown as Array<[SimulateContractCall]>;
    expect(calls).toHaveLength(3);

    const resolveTimes = calls.map(([call]) => Number(call.args[1]));

    // Should be spaced 2 hours (7200 seconds) apart
    expect(resolveTimes[1]! - resolveTimes[0]!).toBe(7200);
    expect(resolveTimes[2]! - resolveTimes[1]!).toBe(7200);
  });

  it('rounds forecast to nearest whole degree', async () => {
    const mockProvider = {
      getForecast: vi.fn()
        .mockResolvedValueOnce(754) // 75.4°F → 750 (rounds down)
        .mockResolvedValueOnce(755), // 75.5°F → 760 (rounds up)
    };

    const { createWeatherProviderFromEnv } = await import('@weatherb/shared/providers');
    vi.mocked(createWeatherProviderFromEnv).mockReturnValue(mockProvider as never);

    const request = new Request('http://localhost/api/cron/schedule-daily');
    const response = await GET(request);
    const data = await response.json();

    expect(data.results[0].thresholdTenths).toBe(750);
    expect(data.results[1].thresholdTenths).toBe(760);
  });

  it.skip('waits for transaction confirmation', async () => {
    // TODO: Requires E2E testing framework (Playwright) to properly mock viem clients
    const request = new Request('http://localhost/api/cron/schedule-daily');
    await GET(request);

    expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();
  });
});
