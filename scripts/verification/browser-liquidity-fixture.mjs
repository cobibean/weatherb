import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertDisposableDatabase } from './test-database.mjs';

// This fixture only accepts the disposable database created by database.mjs --serve.
assertDisposableDatabase(process.env);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }) });
const wallet = '0x00000000000000000000000000000000000000a1';
const admin = '0x00000000000000000000000000000000000000a2';
const deploymentKey = '5042002:0x0000000000000000000000000000000000000001';
const stateId = `${deploymentKey}:${wallet}`;
const sessionId = 'weatherb-browser-fixture-session';
const command = process.argv[2];

try {
  if (command === 'initialize') {
    await db.adminSession.create({ data: { id: sessionId, wallet: admin, nonce: 'verified-browser-fixture',
      authenticatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } });
    await db.liquidityConfig.update({ where: { id: 'default' }, data: {
      deploymentKey, walletAddress: wallet, seedAmountWei: '1000000000000000000',
      seedingEnabled: false, claimsEnabled: true,
    } });
    await db.liquidityWorkerState.create({ data: { id: stateId, deploymentKey, walletAddress: wallet,
      ready: true, lastHeartbeatAt: new Date(), lastReconciledAt: new Date(), balanceWei: '0',
      balanceObservedAt: new Date(), balanceBlockNumber: 1000n } });
    await db.liquidityEvent.create({ data: { deploymentKey, walletAddress: wallet,
      code: 'liquidity-funding-required', severity: 'WARNING',
      message: 'Maker wallet balance is zero; fund the displayed address manually.',
      incidentKey: 'liquidity-funding-required:global',
    } });
    console.log(`BROWSER_FIXTURE_SESSION=${sessionId}`);
  } else if (command === 'populate') {
    let config = await db.liquidityConfig.findUniqueOrThrow({ where: { id: 'default' } });
    if (config.firstEligibleMarketId === null)
      config = await db.liquidityConfig.update({ where: { id: 'default' }, data: {
        firstEligibleMarketId: 205, activationBlockNumber: 1000n, activatedAt: new Date(),
      } });
    const city = await db.city.findFirstOrThrow();
    const base = config.firstEligibleMarketId;
    for (let i = 0; i < 30; i++) {
      const id = base + i;
      await db.market.create({ data: { contractMarketId: id, cityId: city.id, cityName: city.name,
        latitude: city.latitude, longitude: city.longitude, timezone: city.timezone,
        thresholdTemp: 500, resolveTime: new Date(Date.now() + 86_400_000), liquidityClassification: 'PUBLIC' } });
      const active = i < 3;
      const partial = i === 0;
      const noPayout = i === 4;
      await db.liquidityPosition.create({ data: { deploymentKey, walletAddress: wallet, contractMarketId: id,
        seedStatus: partial ? 'PARTIAL' : 'SEEDED',
        claimStatus: i === 0 ? 'NONE' : i === 1 ? 'IN_FLIGHT' : i === 2 ? 'CLAIMABLE' : noPayout ? 'NO_PAYOUT' : 'CLAIMED',
        waitReason: partial ? 'INSUFFICIENT_FUNDS' : null, slotHeld: active,
        targetPerSideWei: '2500000000000000000',
        confirmedYesWei: '2500000000000000000', confirmedNoWei: partial ? '0' : '2500000000000000000',
        claimedAmountWei: active || noPayout ? '0' : '4900000000000000000',
        claimableWei: active ? i === 2 ? '4800000000000000000' : null : '0',
        gasSpentWei: '1000000000000000', completedAt: active ? null : new Date(),
        lastTransactionStatus: i === 1 ? 'UNKNOWN' : 'CONFIRMED',
        lastTransactionOperation: active ? i === 0 ? 'YES_SEED' : 'CLAIM' : 'CLAIM',
        lastTransactionHash: `0x${(id + 1000).toString(16).padStart(64, '0')}`,
      } });
      await db.liquidityEvent.create({ data: { deploymentKey, walletAddress: wallet, contractMarketId: id,
        code: i === 5 ? 'liquidity-refund-confirmed' : 'liquidity-position-updated', severity: 'INFO',
        message: i === 5 ? `Refund confirmed for market ${id}.` : `Market ${id}: ${partial ? 'YES confirmed, NO awaits funding' : noPayout ? 'no payout' : active ? 'claim or transaction pending' : 'claim confirmed'}.`,
        createdAt: new Date(Date.now() - i * 60_000),
      } });
    }
    await db.liquidityEvent.create({ data: { deploymentKey, walletAddress: wallet, contractMarketId: base,
      code: 'liquidity-partial-seed', severity: 'WARNING', incidentKey: `liquidity-partial-seed:${base}`,
      message: `Only YES is confirmed for market ${base}; NO awaits funding.` } });
    await db.liquidityEvent.create({ data: { deploymentKey, walletAddress: wallet, contractMarketId: base + 1,
      code: 'liquidity-transaction-unknown', severity: 'CRITICAL', incidentKey: `liquidity-transaction-unknown:${base + 1}:CLAIM`,
      message: `Claim nonce for market ${base + 1} needs investigation.` } });
    await db.liquidityWorkerState.update({ where: { id: stateId }, data: { ready: false, currentFailure: 'RPC check timed out' } });
    console.log(`BROWSER_FIXTURE_POSITIONS=${base}-${base + 29}`);
  } else if (command === 'funded') {
    await db.liquidityWorkerState.update({ where: { id: stateId }, data: { balanceWei: '14000000000000000000',
      balanceObservedAt: new Date(), balanceBlockNumber: 1001n, ready: true, currentFailure: null, lastHeartbeatAt: new Date() } });
    await db.liquidityEvent.updateMany({ where: { deploymentKey, code: 'liquidity-funding-required', resolvedAt: null }, data: { resolvedAt: new Date() } });
    await db.liquidityEvent.create({ data: { deploymentKey, walletAddress: wallet, code: 'liquidity-funding-required-recovered',
      severity: 'INFO', message: 'Funding recheck confirmed balance; the prior notice was resolved.' } });
    console.log('BROWSER_FIXTURE_FUNDED=true');
  } else throw new Error('Use initialize, populate, or funded');
} finally {
  await db.$disconnect();
}
