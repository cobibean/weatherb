import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createPublicClient, http, keccak256, toBytes, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const testRunId = process.argv[2];
  if (!testRunId) {
    console.error('Usage: npx tsx scripts/debug/report-test-audition-flow.ts <test-run-id>');
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl(), connectionTimeoutMillis: 5000 }) });

  const testRun = await prisma.testRun.findUnique({
    where: { id: testRunId },
    include: {
      suggestion: true,
      markets: true,
    },
  });

  if (!testRun) {
    console.error(`TestRun not found: ${testRunId}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const citySlug = (testRun.suggestion.customCityName || '')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const city = citySlug
    ? await prisma.city.findUnique({ where: { slug: citySlug } })
    : null;

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const rpcUrl = process.env.RPC_URL;
  if (!contractAddress || !rpcUrl) {
    throw new Error('Missing NEXT_PUBLIC_CONTRACT_ADDRESS or RPC_URL');
  }

  const client = createPublicClient({ transport: http(rpcUrl) });
  const expectedCityId = citySlug ? keccak256(toBytes(citySlug)) : null;

  const chainCityIds = [] as Array<{ contractMarketId: number; cityId: Hex }>;
  for (const market of testRun.markets) {
    const onChain = await client.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(market.contractMarketId)],
    });
    chainCityIds.push({
      contractMarketId: market.contractMarketId,
      cityId: onChain.cityId,
    });
  }

  const betsCount = (() => {
    const results = testRun.results as { bets?: unknown[] } | null;
    return results?.bets?.length ?? 0;
  })();

  console.log(
    JSON.stringify(
      {
        testRunId: testRun.id,
        status: testRun.status,
        suggestionId: testRun.suggestionId,
        city: city
          ? {
              id: city.id,
              slug: city.slug,
              isActive: city.isActive,
            }
          : null,
        expectedCityId,
        chainCityIds,
        marketsCreated: testRun.marketsCreated,
        marketsInDb: testRun.markets.length,
        betsCount,
        fundingTxHash: testRun.fundingTxHash,
        createdAt: testRun.startedAt,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
