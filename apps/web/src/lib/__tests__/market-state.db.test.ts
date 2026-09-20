import { beforeAll, describe, expect, it } from 'vitest';
import prisma from '@/lib/prisma';
import { seedDevelopmentDatabase } from '@/lib/development-seed';
import { persistMarket, bindDeployment, type ChainMarket } from '@/lib/cron/market-state';
import { keccak256, toBytes } from 'viem';
const snapshot: ChainMarket = {
  cityId: keccak256(toBytes('nyc')),
  resolveTime: 1800000000n,
  bettingDeadline: 1799999400n,
  thresholdTenths: 850n,
  currency: '0x0000000000000000000000000000000000000000',
  status: 0,
  yesPool: 10000000000000000001n,
  noPool: 10000000000000000002n,
  totalFees: 0n,
  resolvedTempTenths: 0n,
  observedTimestamp: 0n,
  outcome: false,
};
beforeAll(async () => {
  await seedDevelopmentDatabase(prisma);
});
describe('Chain state persistence', () => {
  it('serializes concurrent upserts to one row with exact amounts', async () => {
    await Promise.all([persistMarket(3000n, snapshot), persistMarket(3000n, snapshot)]);
    const rows = await prisma.market.findMany({ where: { contractMarketId: 3000 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.yesPool).toBe('10000000000000000001');
    await prisma.market.deleteMany({ where: { contractMarketId: 3000 } });
  });
  it('rebuilds a missing terminal record and never overwrites it with a delayed OPEN snapshot', async () => {
    await persistMarket(3001n, {
      ...snapshot,
      status: 2,
      totalFees: 123456789012345n,
      resolvedTempTenths: 850n,
      observedTimestamp: 1800000000n,
      outcome: true,
    });
    await persistMarket(3001n, snapshot);
    expect(await prisma.market.findUnique({ where: { contractMarketId: 3001 } })).toMatchObject({
      status: 'RESOLVED',
      outcome: 'YES',
      isSettled: true,
      actualTemp: 850,
      totalFees: '123456789012345',
    });
    await prisma.market.deleteMany({ where: { contractMarketId: 3001 } });
  });
  it('does not require an outstanding market city to remain active', async () => {
    await prisma.city.update({ where: { slug: 'nyc' }, data: { isActive: false } });
    try {
      await persistMarket(3002n, { ...snapshot, status: 3 });
      expect(await prisma.market.findUnique({ where: { contractMarketId: 3002 } })).toMatchObject({
        status: 'CANCELLED',
        actualTemp: null,
        outcome: null,
      });
    } finally {
      await prisma.market.deleteMany({ where: { contractMarketId: 3002 } });
      await prisma.city.update({ where: { slug: 'nyc' }, data: { isActive: true } });
    }
  });
});

describe('Database deployment binding', () => {
  it('allows the same deployment and refuses a different chain or address', async () => {
    const a = '0x0000000000000000000000000000000000000001';
    await prisma.systemConfig.update({
      where: { id: 'default' },
      data: { deploymentKey: `31337:${a}` },
    });
    try {
      await expect(bindDeployment(31337, a)).resolves.toBeUndefined();
      await expect(bindDeployment(5042002, a)).rejects.toThrow('another deployment');
      await expect(
        bindDeployment(31337, '0x0000000000000000000000000000000000000002'),
      ).rejects.toThrow('another deployment');
    } finally {
      await prisma.systemConfig.update({ where: { id: 'default' }, data: { deploymentKey: null } });
    }
  });
  it('refuses to silently adopt existing unbound market history', async () => {
    await persistMarket(3003n, snapshot);
    try {
      await expect(
        bindDeployment(31337, '0x0000000000000000000000000000000000000001'),
      ).rejects.toThrow('unbound market history');
    } finally {
      await prisma.market.deleteMany({ where: { contractMarketId: 3003 } });
    }
  });
});
