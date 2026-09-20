import { describe, expect, it } from 'vitest';
import prisma from '@/lib/prisma';
import { acquireSignerLease, releaseSignerLease, withSignerLease } from '@/lib/cron/lease';

const id = 'settler:0x00000000000000000000000000000000000000aa';

describe('Signer lease', () => {
  it('grants exactly one of many concurrent acquisitions', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => acquireSignerLease(id, `run-${i}`, 60)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const row = await prisma.workerLease.findUniqueOrThrow({ where: { id } });
    await releaseSignerLease(id, row.holder);
  });
  it('can be re-acquired after release and after expiry', async () => {
    expect(await acquireSignerLease(id, 'a', 60)).toBe(true);
    expect(await acquireSignerLease(id, 'b', 60)).toBe(false);
    await releaseSignerLease(id, 'a');
    expect(await acquireSignerLease(id, 'b', 60)).toBe(true);
    await prisma.workerLease.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await acquireSignerLease(id, 'c', 60)).toBe(true);
    await releaseSignerLease(id, 'c');
  });
  it('ignores release by a different holder', async () => {
    expect(await acquireSignerLease(id, 'a', 60)).toBe(true);
    await releaseSignerLease(id, 'not-a');
    expect(await acquireSignerLease(id, 'b', 60)).toBe(false);
    await releaseSignerLease(id, 'a');
  });
  it('withSignerLease releases even when the body throws', async () => {
    await expect(
      withSignerLease(id, 'a', 60, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await acquireSignerLease(id, 'b', 60)).toBe(true);
    await releaseSignerLease(id, 'b');
    const busy = await withSignerLease(id, 'x', 60, async () => 1);
    expect(busy).toEqual({ acquired: true, value: 1 });
  });
});
