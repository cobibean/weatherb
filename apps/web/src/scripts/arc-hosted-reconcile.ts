/** Read chain state into the hosted DB. No wallet files or signing capabilities. */
import { createPublicClient, http, isAddress } from 'viem';
import { ARC_TESTNET } from '@weatherb/shared/constants';
import prisma from '../lib/prisma';
import { requireRestartContract, reconcileMarkets } from '../lib/cron/market-state';

try {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (
    process.env.NEXT_PUBLIC_CHAIN_ID !== String(ARC_TESTNET.id) ||
    !address ||
    !isAddress(address)
  )
    throw new Error('Expected an Arc Testnet deployment');
  const client = createPublicClient({ chain: ARC_TESTNET, transport: http() });
  await requireRestartContract(client, address);
  const active = await reconcileMarkets(client, address);
  const config = await prisma.systemConfig.findUniqueOrThrow({ where: { id: 'default' } });
  if (!config.isPaused || !config.settlerPaused)
    throw new Error('Hosted workers must remain paused');
  console.log(
    JSON.stringify({ reconciled: true, activeMarketIds: active.map(String), workersPaused: true }),
  );
} catch {
  console.error(
    'Hosted reconciliation failed. Check the explicit profile, chain binding, and database.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
