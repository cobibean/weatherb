import prisma from '@/lib/prisma';

export type LeaseResult<T> = { acquired: true; value: T } | { acquired: false };

/** One row per signer. INSERT ... ON CONFLICT serializes competitors; an expired lease is reclaimable. */
export async function acquireSignerLease(
  id: string,
  holder: string,
  ttlSeconds: number,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ holder: string }[]>`
    INSERT INTO "WorkerLease" ("id", "holder", "expiresAt")
    VALUES (${id}, ${holder}, now() + make_interval(secs => ${ttlSeconds}::double precision))
    ON CONFLICT ("id") DO UPDATE
      SET "holder" = EXCLUDED."holder", "expiresAt" = EXCLUDED."expiresAt"
      WHERE "WorkerLease"."expiresAt" < now()
    RETURNING "holder"`;
  return rows.length === 1 && rows[0]!.holder === holder;
}

export async function releaseSignerLease(id: string, holder: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "WorkerLease" SET "expiresAt" = now() WHERE "id" = ${id} AND "holder" = ${holder}`;
}

export async function withSignerLease<T>(
  id: string,
  holder: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<LeaseResult<T>> {
  if (!(await acquireSignerLease(id, holder, ttlSeconds))) return { acquired: false };
  try {
    return { acquired: true, value: await fn() };
  } finally {
    await releaseSignerLease(id, holder);
  }
}
