import { requireDatabaseUrl } from '@weatherb/shared/utils/database-url';
import { PrismaPg } from '@prisma/adapter-pg';
#!/usr/bin/env npx tsx
/**
 * Check TestRun wallet info and trace funding transactions
 */
import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenvConfig({ path: '.env' });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabaseUrl(), connectionTimeoutMillis: 5000 }) });

async function main() {
  const testRuns = await prisma.testRun.findMany({
    where: { keysDisposed: false },
    select: {
      id: true,
      walletCount: true,
      walletKeys: true,
      fundingTxHash: true,
      status: true,
      marketsCreated: true,
      suggestion: { select: { customCityName: true } },
    },
  });

  console.log('TestRuns with keysDisposed=false:\n');
  
  for (const tr of testRuns) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`ID: ${tr.id}`);
    console.log(`City: ${tr.suggestion?.customCityName || 'Unknown'}`);
    console.log(`Status: ${tr.status}`);
    console.log(`Wallet Count: ${tr.walletCount}`);
    console.log(`Markets Created: ${tr.marketsCreated}`);
    console.log(`Funding TX: ${tr.fundingTxHash || 'N/A'}`);
    console.log(`Keys length: ${tr.walletKeys?.length || 0} chars`);
    console.log(`Keys preview: ${tr.walletKeys?.substring(0, 50)}...`);
    console.log('');
  }

  // Check MAGIC_LINK_SECRET
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Environment Check:');
  console.log(`MAGIC_LINK_SECRET set: ${process.env.MAGIC_LINK_SECRET ? 'YES' : 'NO'}`);
  console.log(`MAGIC_LINK_SECRET length: ${process.env.MAGIC_LINK_SECRET?.length || 0}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
