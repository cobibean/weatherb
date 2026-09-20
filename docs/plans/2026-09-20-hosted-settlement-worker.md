# Hosted Settlement Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** weatherB settles Arc Testnet markets from a hosted worker with no Codex heartbeat, no local process, and no Mac awake, with a read-only admin Operations page showing what the worker did and what is overdue.

**Architecture:** A second Vercel project (`weatherb-arc-worker`) is deployed from the same repository and is the only deployment holding a settler key, a weather key, and a cron secret. A fresh settler key is generated for it and the contract's single `settler` role is rotated to that address, so the local acceptance scripts physically cannot settle. QStash schedules trigger the existing `/api/cron/settle-markets` sweep every two minutes and deliver per-market messages at `resolveTime`; the sweep is hardened with a DB lease per signer, in-flight transaction tracking, bounded reconciliation, and a persisted `WorkerRun` log. The public site (`weatherb-arc-testnet`) stays secret-free and gains `ADMIN_WALLETS` so the existing wallet-signed admin panel can show a new read-only `/admin/operations` page; all admin write endpoints are gated off by default.

**Tech Stack:** Next.js 16 App Router routes, Prisma 7 + PostgreSQL (Neon), viem 2.56, `@upstash/qstash` 2.11 (already a dependency), Vercel CLI 58 (Pro team `cobi-beans-projects`), Vitest + disposable PostgreSQL tests, Node 24.21.0 / npm 12.0.2.

## Global Constraints

- Arc Testnet chain ID `5042002`; proxy `0xd86e2774e4a9bf2e86199791068b9350b718b891`; contract version `2.2.0`; native USDC values use 18 decimals.
- Product rules are unchanged: YES/NO temperature markets, ≤5 scheduled markets per UTC day, exactly 24-hour scheduled duration, betting closes 600 s before `resolveTime`, ties resolve YES, 0.01 USDC minimum, 1% fee from the losing pool.
- Settlement observation window is `[resolveTime, resolveTime + 600]` (`SETTLEMENT_WINDOW_SECONDS`); after it the worker cancels for refunds. Never fabricate observations.
- Do not deploy a new contract, upgrade the proxy, reset any database or the local journal, place bets on Market 3 (1000°F NoWinners fixture), or abandon acceptance evidence.
- Automatic market **creation** is out of scope for this plan (it needs owner authority; a scheduler-role contract change is a separate plan). Deferred systems (voting, auditions, bots, trending, reports, Sheets) stay deferred.
- Secrets: never print private keys, cron secrets, API keys, or database URLs. Private material lives only in ignored, mode-0600 files under the repo root (`.env.arc-*`, `.tools/**`). Scripts that read them must check the mode first, as existing scripts do.
- The public Vercel project `weatherb-arc-testnet` (`prj_Xf7r8PYDcxuvtLKApRK4YvfunSfi`, team `team_2l4gGocPPIEpAB4OWmKXM5LJ`) must never receive `SETTLER_PRIVATE_KEY`, `CRON_SECRET`, `TOMORROW_IO_API_KEY`, `QSTASH_TOKEN`, `DIRECT_URL`, or `ADMIN_WRITES_ENABLED`. Root `vercel.json` keeps `"crons": []`.
- Two independent writers are never allowed. Order of operations for handover is fixed: hosted worker validated (paused) → contract settler rotated to the hosted key → hosted settler unpaused → first hosted-settled market verified → Codex heartbeat cancelled. If hosted validation is not complete before **2026-09-21 12:08 UTC**, leave the heartbeat alone; the worker takes over from Market 4 onward.
- Verification command for every code task: `npm run verify` (lint, typecheck, safety tests, shared + web unit tests, disposable DB tests, builds, ABI check). Run the narrower commands shown per task while iterating.
- Code conventions: TypeScript strict, explicit return types, `kebab-case.ts`, zod for external input, compact code, no new comments beyond what the task shows.

## Platform facts checked 2026-09-20

- Vercel team `cobi-beans-projects` is on **Pro** (verified via API). Pro cron supports per-minute schedules but Vercel cron has no retries and `vercel.json` is shared by every project deployed from the repo root, so this plan uses **QStash schedules** as the trigger and leaves `crons: []` untouched.
- Vercel Functions with Fluid compute: default `maxDuration` 300 s, Pro max 800 s. Routes in this plan set `maxDuration = 300`.
- QStash free tier: 1,000 messages/day, 10 active schedules, 3-day log retention, each retry counts as a message. Sweep every 2 min = 720/day with `retries: 0`; per-market messages add ~10/day. Pay-as-you-go is $1 per 100k messages if the free quota becomes tight.
- Neon free project `silent-dream-20560813` hosts the shared hosted DB. Runtime role `weatherb_app`, migrator `weatherb_migrator`; RLS enabled on all tables; pooled endpoint for runtime.

## File structure

Create:
- `apps/web/prisma/migrations/20260920210000_worker_operations/migration.sql` — `WorkerRun`, `WorkerLease`, Market settlement-tracking columns.
- `apps/web/src/lib/cron/lease.ts` — signer lease (`acquireSignerLease`, `releaseSignerLease`, `withSignerLease`).
- `apps/web/src/lib/cron/worker-run.ts` — `recordWorkerRun`.
- `apps/web/src/lib/cron/settlement-schedule.ts` — `ensureSettlementScheduled` (QStash per-market message).
- `apps/web/src/lib/worker-status.ts` — `readWorkerStatus` for health + operations.
- `apps/web/src/lib/admin-writes.ts` — `adminWritesEnabled`, `adminReadOnlyResponse`.
- `apps/web/src/lib/admin-operations.ts` — `getOperationsSnapshot`, `deriveOperationsAlerts`.
- `apps/web/src/app/admin/(dashboard)/operations/page.tsx`, `operations-client.tsx`.
- `scripts/development/setup-hosted-settler.mjs`, `scripts/development/worker-profile.mjs`, `scripts/development/worker.mjs`, `scripts/development/worker-role.sql`.
- `scripts/verification/worker-profile.test.mjs`.
- `.env.arc-worker.example`.
- Tests listed per task.

Modify:
- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/cron/auth.ts`, `index.ts`, `settlement.ts`, `market-state.ts`
- `apps/web/src/app/api/cron/settle-markets/route.ts`, `apps/web/src/app/api/markets/[marketId]/settle/route.ts`
- `apps/web/src/app/api/health/route.ts`, `apps/web/src/lib/database-readiness.ts` (no change) 
- `apps/web/src/test/lifecycle-mocks.ts`
- Admin write routes under `apps/web/src/app/admin/api/**` and `apps/web/src/components/admin/{sidebar,header,emergency-controls}.tsx`, `apps/web/src/app/admin/(dashboard)/page.tsx`, `dashboard-client.tsx`
- `apps/web/src/scripts/arc-lifecycle.ts`, `apps/web/src/scripts/development-database.ts`
- `scripts/development/hosted.mjs`, `scripts/development/access.sql`
- `package.json` (scripts), `.env.arc-dev.example`
- `docs/testing/arc-hosted-testnet.md`, `docs/testing/arc-testnet-lifecycle-acceptance.md`, `AGENTS.md`

---

### Task 1: Schema for worker runs, signer lease, and settlement tracking

**Files:**
- Modify: `apps/web/prisma/schema.prisma:69-111` (Market), append two models
- Create: `apps/web/prisma/migrations/20260920210000_worker_operations/migration.sql`
- Modify: `scripts/development/access.sql:7-21`
- Test: `apps/web/src/lib/__tests__/schema-types.test.ts` (existing file; add a case)

**Interfaces:**
- Produces Prisma models `WorkerRun`, `WorkerLease`, and Market columns `settlementAttempts Int`, `lastSettlementAttemptAt DateTime?`, `lastSettlementError String?`, `settlementTxHash String?`, `settlementSubmittedAt DateTime?`, `settlementMessageId String?`. Later tasks use exactly these names.

- [ ] **Step 1: Add the models and columns to `schema.prisma`**

Inside `model Market`, after the `sheetsLoggedAt` line, add:

```prisma
  // Hosted worker settlement tracking; chain state remains authoritative.
  settlementAttempts      Int       @default(0)
  lastSettlementAttemptAt DateTime? @db.Timestamptz(6)
  lastSettlementError     String?
  settlementTxHash        String?
  settlementSubmittedAt   DateTime? @db.Timestamptz(6)
  settlementMessageId     String?
```

After `model SystemConfig`, add:

```prisma
model WorkerLease {
  id        String   @id
  holder    String
  expiresAt DateTime @db.Timestamptz(6)
}

model WorkerRun {
  id         String    @id @default(cuid())
  kind       String
  trigger    String
  status     String    @default("running")
  startedAt  DateTime  @default(now()) @db.Timestamptz(6)
  finishedAt DateTime? @db.Timestamptz(6)
  summary    Json?     @db.JsonB
  error      String?

  @@index([kind, startedAt(sort: Desc)])
  @@index([status])
}
```

- [ ] **Step 2: Write the migration by hand (matches the project's hand-written migration style)**

`apps/web/prisma/migrations/20260920210000_worker_operations/migration.sql`:

```sql
-- Hosted worker: one lease row per signer, a durable run log, and per-market submission tracking.
CREATE TABLE "WorkerLease" (
  "id" TEXT NOT NULL,
  "holder" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "WorkerLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerRun" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(6),
  "summary" JSONB,
  "error" TEXT,
  CONSTRAINT "WorkerRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkerRun_kind_startedAt_idx" ON "WorkerRun"("kind", "startedAt" DESC);
CREATE INDEX "WorkerRun_status_idx" ON "WorkerRun"("status");

ALTER TABLE "Market"
  ADD COLUMN "settlementAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSettlementAttemptAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastSettlementError" TEXT,
  ADD COLUMN "settlementTxHash" TEXT,
  ADD COLUMN "settlementSubmittedAt" TIMESTAMPTZ(6),
  ADD COLUMN "settlementMessageId" TEXT;
```

- [ ] **Step 3: Grant the runtime roles access to the new tables**

In `scripts/development/access.sql`, add `'WorkerRun','WorkerLease'` to **both** table arrays (the RLS/revoke loop on line 7-10 and the grant loop on line 20), and make the grant loop cover a worker role when it exists. Replace lines 20-25 with:

```sql
  FOREACH table_name IN ARRAY ARRAY['SystemConfig','City','Market','AdminLog','AdminSession','WorkerRun','WorkerLease'] LOOP
    FOREACH api_role IN ARRAY ARRAY['weatherb_app','weatherb_worker'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I', table_name, api_role);
        IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname='weatherb_server_' || api_role) THEN
          EXECUTE format('CREATE POLICY %I ON public.%I TO %I USING (true) WITH CHECK (true)', 'weatherb_server_' || api_role, table_name, api_role);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
```

Keep the existing `weatherb_server` policy rows in place (do not drop them); the new policy name is suffixed so re-running is idempotent. After the `DO $$ ... $$;` block, replace `GRANT USAGE ON SCHEMA public TO weatherb_app;` with:

```sql
GRANT USAGE ON SCHEMA public TO weatherb_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'weatherb_worker') THEN
    GRANT USAGE ON SCHEMA public TO weatherb_worker;
  END IF;
END $$;
```

- [ ] **Step 4: Regenerate the client and add a schema type test**

Run: `npm --workspace=@weatherb/web run db:generate 2>/dev/null || (cd apps/web && npx prisma generate)`

Append to `apps/web/src/lib/__tests__/schema-types.test.ts`:

```ts
import type { Market, WorkerRun, WorkerLease } from '@prisma/client';

describe('worker operations schema', () => {
  it('exposes settlement tracking and worker models', () => {
    const market: Pick<
      Market,
      'settlementAttempts' | 'settlementTxHash' | 'settlementSubmittedAt' | 'settlementMessageId'
    > = {
      settlementAttempts: 0,
      settlementTxHash: null,
      settlementSubmittedAt: null,
      settlementMessageId: null,
    };
    const run: Pick<WorkerRun, 'kind' | 'status'> = { kind: 'settle-sweep', status: 'running' };
    const lease: Pick<WorkerLease, 'id' | 'holder'> = { id: 'settler:0xabc', holder: 'run-1' };
    expect([market, run, lease]).toHaveLength(3);
  });
});
```

(If the existing file does not import `describe/it/expect` from vitest, add `import { describe, expect, it } from 'vitest';` at the top.)

- [ ] **Step 5: Run the migration against a disposable database and the type test**

Run: `npm run test:db`
Expected: the runner applies all nine migrations and the existing DB tests pass.

Run: `npm --workspace=@weatherb/web run typecheck && npx vitest run --root apps/web src/lib/__tests__/schema-types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/20260920210000_worker_operations scripts/development/access.sql apps/web/src/lib/__tests__/schema-types.test.ts
git commit -m "feat(worker): add WorkerRun, WorkerLease and settlement tracking columns"
```

---

### Task 2: Worker role gate on automation routes

**Files:**
- Modify: `apps/web/src/lib/cron/auth.ts`
- Modify: `apps/web/src/lib/cron/index.ts:50`
- Test: `apps/web/src/lib/cron/__tests__/auth.test.ts`

**Interfaces:**
- Produces `verifyWorkerRequest(request: Request): boolean` — true only when `process.env.WEATHERB_WORKER_ROLE === 'settler'` **and** `verifyCronRequest(request)` passes. Routes in Task 7 call this instead of `verifyCronRequest`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/cron/__tests__/auth.test.ts`:

```ts
import { verifyWorkerRequest } from '../auth';

describe('verifyWorkerRequest', () => {
  const authorized = (): Request =>
    new Request('http://localhost/api/cron/settle-markets', {
      headers: { authorization: 'Bearer test-secret' },
    });
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('rejects deployments that are not the settlement worker even with a valid secret', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', '');
    expect(verifyWorkerRequest(authorized())).toBe(false);
  });
  it('accepts the worker deployment with a valid secret', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', 'settler');
    expect(verifyWorkerRequest(authorized())).toBe(true);
  });
  it('still requires the bearer secret on the worker', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', 'settler');
    expect(verifyWorkerRequest(new Request('http://localhost/api/cron/settle-markets'))).toBe(false);
  });
});
```

(Ensure `describe, it, expect, beforeEach, afterEach, vi` are imported from `vitest` at the top of the file.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --root apps/web src/lib/cron/__tests__/auth.test.ts`
Expected: FAIL — `verifyWorkerRequest` is not exported.

- [ ] **Step 3: Implement**

Append to `apps/web/src/lib/cron/auth.ts`:

```ts
/**
 * Only the dedicated worker deployment may run signing automation. The public site never
 * sets WEATHERB_WORKER_ROLE, so even a leaked signer key there cannot be exercised.
 */
export function verifyWorkerRequest(request: Request): boolean {
  if (process.env.WEATHERB_WORKER_ROLE !== 'settler') return false;
  return verifyCronRequest(request);
}
```

In `apps/web/src/lib/cron/index.ts` change the re-export line to:

```ts
export { verifyCronRequest, verifyWorkerRequest, unauthorizedResponse } from './auth';
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --root apps/web src/lib/cron/__tests__/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cron/auth.ts apps/web/src/lib/cron/index.ts apps/web/src/lib/cron/__tests__/auth.test.ts
git commit -m "feat(worker): require explicit worker role for signing automation routes"
```

---

### Task 3: Signer lease

**Files:**
- Create: `apps/web/src/lib/cron/lease.ts`
- Test: `apps/web/src/lib/__tests__/worker-lease.db.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LeaseResult<T> = { acquired: true; value: T } | { acquired: false };
  export async function acquireSignerLease(id: string, holder: string, ttlSeconds: number): Promise<boolean>;
  export async function releaseSignerLease(id: string, holder: string): Promise<void>;
  export async function withSignerLease<T>(id: string, holder: string, ttlSeconds: number, fn: () => Promise<T>): Promise<LeaseResult<T>>;
  ```
- Lease id convention used by Task 7: `` `settler:${signerAddress.toLowerCase()}` ``.

- [ ] **Step 1: Write the failing DB test**

`apps/web/src/lib/__tests__/worker-lease.db.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:db`
Expected: FAIL — cannot resolve `@/lib/cron/lease`.

- [ ] **Step 3: Implement**

`apps/web/src/lib/cron/lease.ts`:

```ts
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
```

- [ ] **Step 4: Run the DB tests**

Run: `npm run test:db`
Expected: PASS including the four new cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cron/lease.ts apps/web/src/lib/__tests__/worker-lease.db.test.ts
git commit -m "feat(worker): add per-signer database lease"
```

---

### Task 4: Worker run log

**Files:**
- Create: `apps/web/src/lib/cron/worker-run.ts`
- Test: `apps/web/src/lib/cron/__tests__/worker-run.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WorkerRunKind = 'settle-sweep' | 'settle-market';
  export type WorkerRunStatus = 'succeeded' | 'failed' | 'skipped' | 'busy';
  export type WorkerRunOutcome<T> = { status: WorkerRunStatus; summary: T; error?: string };
  export async function recordWorkerRun<T extends object>(kind: WorkerRunKind, trigger: string, fn: (runId: string) => Promise<WorkerRunOutcome<T>>): Promise<WorkerRunOutcome<T>>;
  export function triggerFromRequest(request: Request): string;
  ```
- `runId` is the `WorkerRun.id`; Task 7 uses it as the lease `holder`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/cron/__tests__/worker-run.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { workerRun: { create: mocks.create, update: mocks.update } },
}));
import { recordWorkerRun, triggerFromRequest } from '../worker-run';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: 'run-1' });
  mocks.update.mockResolvedValue({});
});

describe('recordWorkerRun', () => {
  it('records a running row, then the outcome and summary', async () => {
    const outcome = await recordWorkerRun('settle-sweep', 'qstash:weatherb-arc-settle-sweep', async (runId) => {
      expect(runId).toBe('run-1');
      return { status: 'succeeded', summary: { settled: 1 } };
    });
    expect(outcome).toEqual({ status: 'succeeded', summary: { settled: 1 } });
    expect(mocks.create).toHaveBeenCalledWith({
      data: { kind: 'settle-sweep', trigger: 'qstash:weatherb-arc-settle-sweep' },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'succeeded', summary: { settled: 1 }, error: null }),
    });
  });
  it('marks thrown errors failed with a redacted message and rethrows', async () => {
    vi.stubEnv('CRON_SECRET', 'topsecret');
    await expect(
      recordWorkerRun('settle-market', 'manual', async () => {
        throw new Error('failed with topsecret apikey=abc123 inside');
      }),
    ).rejects.toThrow();
    const error = mocks.update.mock.calls[0]![0].data.error as string;
    expect(error).not.toContain('topsecret');
    expect(error).not.toContain('abc123');
    expect(mocks.update.mock.calls[0]![0].data.status).toBe('failed');
    vi.unstubAllEnvs();
  });
  it('still returns the outcome when the run log itself is unavailable', async () => {
    mocks.create.mockRejectedValue(new Error('db down'));
    const outcome = await recordWorkerRun('settle-sweep', 'manual', async () => ({
      status: 'skipped',
      summary: {},
    }));
    expect(outcome.status).toBe('skipped');
  });
});

describe('triggerFromRequest', () => {
  it('names QStash schedules, QStash messages, and manual calls', () => {
    const h = (headers: Record<string, string>) => new Request('http://x', { headers });
    expect(triggerFromRequest(h({ 'upstash-schedule-id': 'weatherb-arc-settle-sweep' }))).toBe(
      'qstash:weatherb-arc-settle-sweep',
    );
    expect(triggerFromRequest(h({ 'upstash-message-id': 'msg_1' }))).toBe('qstash-message');
    expect(triggerFromRequest(h({}))).toBe('manual');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --root apps/web src/lib/cron/__tests__/worker-run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/cron/worker-run.ts`:

```ts
import prisma from '@/lib/prisma';

export type WorkerRunKind = 'settle-sweep' | 'settle-market';
export type WorkerRunStatus = 'succeeded' | 'failed' | 'skipped' | 'busy';
export type WorkerRunOutcome<T> = { status: WorkerRunStatus; summary: T; error?: string };

/** Strip anything that looks like a secret before persisting an error message. */
export function redactError(error: unknown): string {
  let message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  for (const [key, value] of Object.entries(process.env))
    if (value && value.length >= 8 && /KEY|SECRET|TOKEN|DATABASE|URL/.test(key))
      message = message.replaceAll(value, '[redacted]');
  return message.replace(/(apikey|token|secret)=[^&\s]+/gi, '$1=[redacted]');
}

export function triggerFromRequest(request: Request): string {
  const schedule = request.headers.get('upstash-schedule-id');
  if (schedule) return `qstash:${schedule}`;
  if (request.headers.get('upstash-message-id')) return 'qstash-message';
  return 'manual';
}

/** The run log must never change the outcome of the work; log failures are swallowed. */
export async function recordWorkerRun<T extends object>(
  kind: WorkerRunKind,
  trigger: string,
  fn: (runId: string) => Promise<WorkerRunOutcome<T>>,
): Promise<WorkerRunOutcome<T>> {
  let runId: string | null = null;
  try {
    runId = (await prisma.workerRun.create({ data: { kind, trigger } })).id;
  } catch (error) {
    console.error('[WorkerRun] Could not record run start:', redactError(error));
  }
  const finish = async (data: {
    status: WorkerRunStatus;
    summary?: object;
    error: string | null;
  }): Promise<void> => {
    if (!runId) return;
    try {
      await prisma.workerRun.update({
        where: { id: runId },
        data: { ...data, finishedAt: new Date() },
      });
    } catch (error) {
      console.error('[WorkerRun] Could not record run end:', redactError(error));
    }
  };
  try {
    const outcome = await fn(runId ?? 'unrecorded');
    await finish({ status: outcome.status, summary: outcome.summary, error: outcome.error ?? null });
    return outcome;
  } catch (error) {
    await finish({ status: 'failed', error: redactError(error) });
    throw error;
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --root apps/web src/lib/cron/__tests__/worker-run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cron/worker-run.ts apps/web/src/lib/cron/__tests__/worker-run.test.ts
git commit -m "feat(worker): persist worker run outcomes with redacted errors"
```

---

### Task 5: In-flight transaction tracking in settlement

**Files:**
- Modify: `apps/web/src/lib/cron/settlement.ts`
- Modify: `apps/web/src/test/lifecycle-mocks.ts`
- Test: `apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts`

**Interfaces:**
- `SettlementResult.action` gains `'in_flight'`. `settleMarket(clients, address, id)` signature unchanged.
- Consumes Task 1 Market columns.
- Constant `IN_FLIGHT_GRACE_SECONDS = 180` exported.

- [ ] **Step 1: Extend the shared mocks**

In `apps/web/src/test/lifecycle-mocks.ts`:

Add to the hoisted `mocks` object: `update: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), txReceipt: vi.fn(), runCreate: vi.fn(), runUpdate: vi.fn(), queryRaw: vi.fn(), executeRaw: vi.fn(),`.

Replace the `@/lib/prisma` mock with:

```ts
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
```

In the `@/lib/cron` mock add `verifyWorkerRequest: mocks.auth,` and add `getTransactionReceipt: mocks.txReceipt,` to `publicClient`, and `account: { address: '0x0000000000000000000000000000000000000123' }` for `walletClient`.

Change `rows` to `export const rows = new Map<number, Record<string, unknown> & { isSettled: boolean }>();`.

In `setupLifecycle()` add after `mocks.receipt.mockResolvedValue(...)`:

```ts
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
```

Also make `mocks.upsert` merge instead of replace so tracking fields survive reconciliation:

```ts
  mocks.upsert.mockImplementation(async ({ where, create, update }) => {
    const existing = rows.get(where.contractMarketId);
    const next = existing ? { ...existing, ...update } : create;
    rows.set(where.contractMarketId, next);
    return next;
  });
```

- [ ] **Step 2: Write the failing tests**

Append inside the `describe('Settlement and reconciliation routes')` block of `settle-markets.integration.test.ts`:

```ts
  it('records the submitted hash before waiting for the receipt', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    expect((await single()).status).toBe(503);
    expect(rows.get(0)).toMatchObject({
      settlementTxHash: '0xreceipt',
      settlementAttempts: 1,
      isSettled: false,
    });
  });
  it('does not resubmit while a recent submission is still unmined', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    await single();
    chain[0]!.status = 0; // Simulate the mock write not having landed yet.
    mocks.txReceipt.mockResolvedValueOnce(null);
    const response = await single();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ result: { action: 'in_flight' } });
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it('resubmits when the earlier submission is older than the grace period and unmined', async () => {
    mocks.receipt.mockRejectedValueOnce(new Error('timeout'));
    await single();
    chain[0]!.status = 0;
    mocks.txReceipt.mockResolvedValue(null);
    vi.setSystemTime(new Date(Date.now() + 181_000));
    chain[0]!.resolveTime = BigInt(Math.floor(Date.now() / 1000) - 100);
    expect((await single()).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });
  it('records a redacted weather error and increments attempts on provider failure', async () => {
    mocks.reading.mockRejectedValueOnce(new Error('provider down apikey=zzz'));
    await single();
    expect(rows.get(0)).toMatchObject({ settlementAttempts: 1 });
    expect(String(rows.get(0)?.lastSettlementError)).not.toContain('zzz');
    expect(mocks.write).not.toHaveBeenCalled();
  });
```

Note the third test rewinds `resolveTime` because fake time advanced; the mock market's original `resolveTime` is `now - 100` at setup.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run --root apps/web src/app/api/cron/__tests__/settle-markets.integration.test.ts`
Expected: the four new cases FAIL (no `settlementTxHash`, no 202).

- [ ] **Step 4: Implement in `settlement.ts`**

Replace the file body with:

```ts
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import {
  SETTLEMENT_WINDOW_SECONDS,
  validateSettlementReading,
} from '@weatherb/shared/utils/weather-timing';
import { keccak256, toBytes, type Hex } from 'viem';
import prisma from '@/lib/prisma';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import type { ContractClients } from './contract';
import { isTerminal, persistMarket, readMarket } from './market-state';
import { redactError } from './worker-run';

/** A submission younger than this with no receipt is still considered in flight. */
export const IN_FLIGHT_GRACE_SECONDS = 180;

export type SettlementResult = {
  marketId: string;
  action: 'pending' | 'reconciled' | 'settled' | 'cancelled' | 'in_flight';
  transactionHash?: Hex;
};

export async function settleMarket(
  clients: ContractClients,
  address: Hex,
  id: bigint,
): Promise<SettlementResult> {
  const { publicClient, walletClient } = clients;
  const marketId = id.toString();
  const contractMarketId = Number(id);
  const market = await readMarket(publicClient, address, id);
  if (isTerminal(market)) {
    await persistMarket(id, market);
    return { marketId, action: 'reconciled' as const };
  }
  const target = Number(market.resolveTime);
  const now = Math.floor(Date.now() / 1000);
  if (now < target) return { marketId, action: 'pending' as const };
  await persistMarket(id, market); // Guarantees a row exists for tracking fields below.
  const row = await prisma.market.findUnique({
    where: { contractMarketId },
    select: { settlementTxHash: true, settlementSubmittedAt: true },
  });
  if (row?.settlementTxHash && row.settlementSubmittedAt) {
    const hash = row.settlementTxHash as Hex;
    const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
    if (receipt?.status === 'success') {
      const confirmed = await readMarket(publicClient, address, id);
      if (isTerminal(confirmed)) {
        await persistMarket(id, confirmed);
        return { marketId, action: 'reconciled' as const, transactionHash: hash };
      }
    }
    const age = now - Math.floor(row.settlementSubmittedAt.getTime() / 1000);
    if (!receipt && age < IN_FLIGHT_GRACE_SECONDS)
      return { marketId, action: 'in_flight' as const, transactionHash: hash };
  }
  const attempt = async (error?: unknown): Promise<void> => {
    await prisma.market.update({
      where: { contractMarketId },
      data: {
        settlementAttempts: { increment: 1 },
        lastSettlementAttemptAt: new Date(),
        lastSettlementError: error === undefined ? null : redactError(error),
      },
    });
  };
  let transactionHash: Hex;
  if (now > target + SETTLEMENT_WINDOW_SECONDS) {
    // Current observations are no longer valid. Release every stake, including one-sided pools.
    const { request } = await publicClient.simulateContract({
      address,
      abi: WEATHER_MARKET_ABI,
      functionName: 'cancelMarketBySettler',
      args: [id],
      account: walletClient.account!,
    });
    await attempt();
    transactionHash = await walletClient.writeContract(request);
  } else {
    const cities = await prisma.city.findMany();
    const city = cities.find(
      (candidate) =>
        keccak256(toBytes(candidate.slug)).toLowerCase() === market.cityId.toLowerCase(),
    );
    if (!city) throw new Error(`Unknown city for market ${id}`);
    const provider = createWeatherProviderFromEnv();
    let reading;
    try {
      reading = await provider.getFirstReadingAtOrAfter(city.latitude, city.longitude, target);
      validateSettlementReading(reading, target);
      await recordProviderSuccess();
    } catch (error) {
      await recordProviderError();
      await attempt(error);
      throw error; // Retry on the next invocation while the window remains open.
    }
    const { request } = await publicClient.simulateContract({
      address,
      abi: WEATHER_MARKET_ABI,
      functionName: 'resolveMarket',
      args: [id, BigInt(reading.tempF_tenths), BigInt(reading.observedTimestamp)],
      account: walletClient.account!,
    });
    await attempt();
    transactionHash = await walletClient.writeContract(request);
  }
  // Record the hash first so a crash before the receipt is recognised as in flight, not lost.
  await prisma.market.update({
    where: { contractMarketId },
    data: { settlementTxHash: transactionHash, settlementSubmittedAt: new Date() },
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== 'success')
    throw new Error(`Settlement transaction reverted: ${transactionHash}`);
  const confirmed = await readMarket(publicClient, address, id);
  if (!isTerminal(confirmed)) throw new Error(`Settlement not confirmed: ${transactionHash}`);
  // Propagate DB failures. The next invocation reconciles this terminal state without another write.
  await persistMarket(id, confirmed);
  return {
    marketId,
    action: confirmed.status === 3 ? ('cancelled' as const) : ('settled' as const),
    transactionHash,
  };
}
```

In `apps/web/src/app/api/markets/[marketId]/settle/route.ts` change the response mapping to:

```ts
    const status =
      result.action === 'pending' ? 409 : result.action === 'in_flight' ? 202 : 200;
    return NextResponse.json({ success: status === 200, result }, { status });
```

(Task 7 rewrites this route more fully; make this minimal change now so the tests pass.)

- [ ] **Step 5: Run the integration tests**

Run: `npx vitest run --root apps/web src/app/api/cron/__tests__/`
Expected: all previous cases and the four new ones PASS. If `'recovers after a receipt timeout without a second transaction'` fails because the second call sees `in_flight`, that is expected new behaviour only when the mock receipt is `null`; by default `mocks.txReceipt` resolves `{ status: 'success' }`, so the second call reconciles with one write. Confirm it passes unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/cron/settlement.ts apps/web/src/test/lifecycle-mocks.ts apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts "apps/web/src/app/api/markets/[marketId]/settle/route.ts"
git commit -m "feat(worker): track in-flight settlement submissions and attempts"
```

---

### Task 6: Bounded reconciliation

**Files:**
- Modify: `apps/web/src/lib/cron/market-state.ts:105-119`
- Test: `apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts`

**Interfaces:**
- Produces `reconcileOutstandingMarkets(client: PublicClient, address: Hex): Promise<bigint[]>` — reads only DB rows with `isSettled = false` plus any chain IDs above the highest known DB ID; returns non-terminal IDs. `reconcileMarkets` (full scan) remains for operator scripts.

- [ ] **Step 1: Write the failing test**

Append to the integration test file:

```ts
  it('sweep reconciles only outstanding and newly created markets', async () => {
    chain[0]!.status = 2;
    rows.set(0, { isSettled: true, status: 'RESOLVED' });
    chain.push(market()); // id 1: known? no — above max known id (0), must be read
    expect((await GET(request())).status).toBe(200);
    const readIds = mocks.read.mock.calls
      .filter(([{ functionName }]) => functionName === 'getMarket')
      .map(([{ args }]) => Number(args[0]));
    expect(readIds).not.toContain(0);
    expect(readIds).toContain(1);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --root apps/web src/app/api/cron/__tests__/settle-markets.integration.test.ts -t "outstanding"`
Expected: FAIL — id 0 is read by the full scan.

- [ ] **Step 3: Implement**

Append to `market-state.ts`:

```ts
/** Terminal chain state is immutable, so settled rows are skipped; IDs above the DB high-water mark are new. */
export async function reconcileOutstandingMarkets(
  client: PublicClient,
  address: Hex,
): Promise<bigint[]> {
  const count = await client.readContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'getMarketCount',
  });
  const [open, known] = await Promise.all([
    prisma.market.findMany({ where: { isSettled: false }, select: { contractMarketId: true } }),
    prisma.market.aggregate({ _max: { contractMarketId: true } }),
  ]);
  const ids = new Set<bigint>(open.map((row) => BigInt(row.contractMarketId)));
  for (let id = BigInt((known._max.contractMarketId ?? -1) + 1); id < count; id++) ids.add(id);
  const pending: bigint[] = [];
  for (const id of [...ids].sort((a, b) => (a < b ? -1 : 1))) {
    const market = await readMarket(client, address, id);
    await persistMarket(id, market);
    if (!isTerminal(market)) pending.push(id);
  }
  return pending;
}
```

In `apps/web/src/app/api/cron/settle-markets/route.ts` replace `reconcileMarkets` with `reconcileOutstandingMarkets` in the import and the call. (Task 7 rewrites the route; do the substitution now so this test passes.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --root apps/web src/app/api/cron/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cron/market-state.ts apps/web/src/app/api/cron/settle-markets/route.ts apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts
git commit -m "feat(worker): bound periodic reconciliation to outstanding and new markets"
```

---

### Task 7: Route wiring — lease, run log, per-market scheduling, maxDuration

**Files:**
- Create: `apps/web/src/lib/cron/settlement-schedule.ts`
- Modify: `apps/web/src/app/api/cron/settle-markets/route.ts`
- Modify: `apps/web/src/app/api/markets/[marketId]/settle/route.ts`
- Test: `apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts`

**Interfaces:**
- Consumes `verifyWorkerRequest` (T2), `withSignerLease` (T3), `recordWorkerRun`, `triggerFromRequest` (T4), `settleMarket` (T5), `reconcileOutstandingMarkets` (T6).
- Produces `ensureSettlementScheduled(marketId: bigint, resolveTimeSec: number): Promise<{ scheduled: boolean; messageId?: string; message?: string }>` — publishes one QStash message per market (idempotent via `Market.settlementMessageId`).
- Sweep response JSON: `{ success, settled, cancelled, pending, inFlight, reconciled, failed, results, errors, runId }`; HTTP 200 (no failures), 503 (some failures), 409 (`busy: true`), or `skipped` shapes from readiness.
- Lease id: `` `settler:${walletClient.account.address.toLowerCase()}` ``; TTL 280 s; `maxDuration = 300`.

- [ ] **Step 1: Write the failing tests**

Append to the integration test file:

```ts
  it('returns 409 busy and does not touch the chain when another worker holds the lease', async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ busy: true });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'busy' }) }),
    );
  });
  it('records a succeeded sweep run with a summary and releases the lease', async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.runCreate).toHaveBeenCalledWith({
      data: { kind: 'settle-sweep', trigger: 'manual' },
    });
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded', summary: expect.objectContaining({ settled: 1 }) }),
      }),
    );
    expect(mocks.executeRaw).toHaveBeenCalled();
  });
  it('schedules one QStash delivery for a pending market and never a second', async () => {
    vi.stubEnv('QSTASH_TOKEN', 'qs');
    vi.stubEnv('APP_URL', 'https://worker.example');
    chain[0]!.resolveTime = BigInt(Math.floor(Date.now() / 1000) + 600);
    mocks.publish.mockResolvedValue({ messageId: 'msg_1' });
    await GET(request());
    await GET(request());
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://worker.example/api/markets/0/settle',
        notBefore: Number(chain[0]!.resolveTime),
      }),
    );
    expect(rows.get(0)).toMatchObject({ settlementMessageId: 'msg_1' });
  });
  it('a failed sweep run is recorded as failed', async () => {
    mocks.read.mockResolvedValueOnce('2.0.0');
    expect((await GET(request())).status).toBe(503);
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
```

The existing test `'rejects unauthorized requests'` remains valid because `verifyWorkerRequest` is mapped to `mocks.auth`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --root apps/web src/app/api/cron/__tests__/settle-markets.integration.test.ts`
Expected: the four new cases FAIL.

- [ ] **Step 3: Create `settlement-schedule.ts`**

```ts
import { Client as QStashClient } from '@upstash/qstash';
import prisma from '@/lib/prisma';

export type SettlementScheduleResult = { scheduled: boolean; messageId?: string; message?: string };

/** Publish at most one delayed delivery per market; the periodic sweep remains the safety net. */
export async function ensureSettlementScheduled(
  marketId: bigint,
  resolveTimeSec: number,
): Promise<SettlementScheduleResult> {
  const contractMarketId = Number(marketId);
  const token = process.env.QSTASH_TOKEN;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !baseUrl) return { scheduled: false, message: 'QStash not configured' };
  const row = await prisma.market.findUnique({
    where: { contractMarketId },
    select: { settlementMessageId: true },
  });
  if (row?.settlementMessageId) return { scheduled: true, messageId: row.settlementMessageId };
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  const result = (await new QStashClient({ token }).publishJSON({
    url: new URL(`/api/markets/${contractMarketId}/settle`, baseUrl).toString(),
    method: 'POST',
    notBefore: resolveTimeSec,
    retries: 3, // Free-tier maximum; the two-minute sweep is the safety net beyond this.
    headers,
    body: {},
  })) as { messageId?: string };
  if (result.messageId)
    await prisma.market.update({
      where: { contractMarketId },
      data: { settlementMessageId: result.messageId },
    });
  return { scheduled: true, messageId: result.messageId };
}
```

- [ ] **Step 4: Rewrite `settle-markets/route.ts`**

```ts
import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyWorkerRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import { reconcileOutstandingMarkets, requireRestartContract } from '@/lib/cron/market-state';
import { settleMarket, type SettlementResult } from '@/lib/cron/settlement';
import { ensureSettlementScheduled } from '@/lib/cron/settlement-schedule';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type SweepSummary = {
  settled: number;
  cancelled: number;
  pending: number;
  inFlight: number;
  reconciled: number;
  failed: number;
  results: SettlementResult[];
  errors: { marketId: string; error: string }[];
};

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) return readiness;
  const rpcUrl = process.env.RPC_URL;
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !address || !privateKey)
    return NextResponse.json(
      { success: false, error: 'Missing settlement configuration' },
      { status: 500 },
    );
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const lease = `settler:${clients.walletClient.account!.address.toLowerCase()}`;
    const outcome = await recordWorkerRun<Partial<SweepSummary> & { busy?: boolean }>(
      'settle-sweep',
      triggerFromRequest(request),
      async (runId) => {
        const result = await withSignerLease(lease, runId, LEASE_SECONDS, async () => {
          await requireRestartContract(clients.publicClient, address);
          const pending = await reconcileOutstandingMarkets(clients.publicClient, address);
          const summary: SweepSummary = {
            settled: 0, cancelled: 0, pending: 0, inFlight: 0, reconciled: 0, failed: 0,
            results: [], errors: [],
          };
          for (const id of pending) {
            try {
              const result = await settleMarket(clients, address, id);
              summary.results.push(result);
              if (result.action === 'settled') summary.settled++;
              else if (result.action === 'cancelled') summary.cancelled++;
              else if (result.action === 'in_flight') summary.inFlight++;
              else if (result.action === 'reconciled') summary.reconciled++;
              else {
                summary.pending++;
                const market = await readMarket(clients.publicClient, address, id);
                await ensureSettlementScheduled(id, Number(market.resolveTime)).catch((error) =>
                  console.warn('[Settler] Could not schedule delivery:', redactError(error)),
                );
              }
            } catch (error) {
              console.error(`[Settler] Market ${id} failed:`, redactError(error));
              summary.failed++;
              summary.errors.push({ marketId: id.toString(), error: redactError(error) });
            }
          }
          return summary;
        });
        if (!result.acquired) return { status: 'busy', summary: { busy: true } };
        return {
          status: result.value.failed ? 'failed' : 'succeeded',
          summary: result.value,
          error: result.value.failed ? `${result.value.failed} market(s) failed` : undefined,
        };
      },
    );
    if (outcome.status === 'busy')
      return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const summary = outcome.summary as SweepSummary;
    return NextResponse.json(
      { success: summary.failed === 0, ...summary },
      { status: summary.failed ? 503 : 200 },
    );
  } catch (error) {
    console.error('[Settler] Reconciliation failed:', redactError(error));
    return NextResponse.json(
      { success: false, error: 'Settlement reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
```

The `market-state` import must read `import { readMarket, reconcileOutstandingMarkets, requireRestartContract } from '@/lib/cron/market-state';`.

- [ ] **Step 5: Rewrite `[marketId]/settle/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { createContractClients, unauthorizedResponse, verifyWorkerRequest } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import { requireRestartContract } from '@/lib/cron/market-state';
import { settleMarket, type SettlementResult } from '@/lib/cron/settlement';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type RouteParams = { params: Promise<{ marketId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) return readiness;
  const { marketId } = await params;
  if (!/^\d+$/.test(marketId) || !Number.isSafeInteger(Number(marketId))) {
    return NextResponse.json({ success: false, error: 'Invalid marketId' }, { status: 400 });
  }
  const rpcUrl = process.env.RPC_URL;
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !address || !privateKey)
    return NextResponse.json(
      { success: false, error: 'Missing settlement configuration' },
      { status: 500 },
    );
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const lease = `settler:${clients.walletClient.account!.address.toLowerCase()}`;
    const outcome = await recordWorkerRun<{ marketId: string; result?: SettlementResult; busy?: boolean }>(
      'settle-market',
      triggerFromRequest(request),
      async (runId) => {
        const held = await withSignerLease(lease, runId, LEASE_SECONDS, async () => {
          await requireRestartContract(clients.publicClient, address);
          return settleMarket(clients, address, BigInt(marketId));
        });
        if (!held.acquired) return { status: 'busy', summary: { marketId, busy: true } };
        const result = held.value;
        return {
          status: result.action === 'pending' || result.action === 'in_flight' ? 'skipped' : 'succeeded',
          summary: { marketId, result },
        };
      },
    );
    if (outcome.status === 'busy')
      return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const result = outcome.summary.result!;
    const status = result.action === 'pending' ? 409 : result.action === 'in_flight' ? 202 : 200;
    return NextResponse.json({ success: status === 200, result }, { status });
  } catch (error) {
    console.error(`[SettleMarket] Market ${marketId} failed:`, redactError(error));
    return NextResponse.json(
      { success: false, error: 'Settlement or reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
```

QStash retries on any non-2xx, so `409 pending/busy` and `503` both trigger a retry; `202 in_flight` does not. Tests from earlier tasks expecting 409 for early single invocations still hold.

- [ ] **Step 6: Run all web tests and typecheck**

Run: `npm --workspace=@weatherb/web run typecheck && npx vitest run --root apps/web src/app/api/cron/__tests__/`
Expected: PASS. Then `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/cron/settlement-schedule.ts apps/web/src/app/api/cron/settle-markets/route.ts "apps/web/src/app/api/markets/[marketId]/settle/route.ts" apps/web/src/app/api/cron/__tests__/settle-markets.integration.test.ts
git commit -m "feat(worker): serialize settlement per signer, log runs, schedule per-market delivery"
```

---

### Task 8: Worker status in `/api/health`

**Files:**
- Create: `apps/web/src/lib/worker-status.ts`
- Modify: `apps/web/src/app/api/health/route.ts`
- Test: `apps/web/src/lib/__tests__/worker-status.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WorkerStatus = { lastSweepAt: string | null; lastSuccessfulSweepAt: string | null; lastSweepStatus: string | null; overdueMarkets: number; dueMarkets: number };
  export async function readWorkerStatus(now?: Date): Promise<WorkerStatus>;
  ```
- Health JSON gains `worker: WorkerStatus` when the database is ready.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/worker-status.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { workerRun: { findFirst: mocks.findFirst }, market: { count: mocks.count } },
}));
import { readWorkerStatus } from '@/lib/worker-status';

beforeEach(() => vi.resetAllMocks());

describe('readWorkerStatus', () => {
  it('reports last sweep, last success, and overdue/due counts', async () => {
    const now = new Date('2026-09-21T12:20:00Z');
    mocks.findFirst
      .mockResolvedValueOnce({ startedAt: new Date('2026-09-21T12:18:00Z'), status: 'failed' })
      .mockResolvedValueOnce({ startedAt: new Date('2026-09-21T12:16:00Z') });
    mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await readWorkerStatus(now)).toEqual({
      lastSweepAt: '2026-09-21T12:18:00.000Z',
      lastSuccessfulSweepAt: '2026-09-21T12:16:00.000Z',
      lastSweepStatus: 'failed',
      overdueMarkets: 1,
      dueMarkets: 2,
    });
    expect(mocks.count).toHaveBeenNthCalledWith(1, {
      where: { isSettled: false, resolveTime: { lt: new Date('2026-09-21T12:10:00Z') } },
    });
  });
  it('returns nulls and zeros with no history', async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    expect(await readWorkerStatus()).toMatchObject({ lastSweepAt: null, overdueMarkets: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --root apps/web src/lib/__tests__/worker-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/worker-status.ts`:

```ts
import { SETTLEMENT_WINDOW_SECONDS } from '@weatherb/shared/utils/weather-timing';
import prisma from '@/lib/prisma';

export type WorkerStatus = {
  lastSweepAt: string | null;
  lastSuccessfulSweepAt: string | null;
  lastSweepStatus: string | null;
  overdueMarkets: number;
  dueMarkets: number;
};

/** Overdue: window closed and still not terminal. Due: resolve time reached, still inside the window. */
export async function readWorkerStatus(now: Date = new Date()): Promise<WorkerStatus> {
  const windowClosed = new Date(now.getTime() - SETTLEMENT_WINDOW_SECONDS * 1000);
  const [last, lastSuccess, overdueMarkets, dueMarkets] = await Promise.all([
    prisma.workerRun.findFirst({
      where: { kind: 'settle-sweep' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }),
    prisma.workerRun.findFirst({
      where: { kind: 'settle-sweep', status: 'succeeded' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    prisma.market.count({ where: { isSettled: false, resolveTime: { lt: windowClosed } } }),
    prisma.market.count({
      where: { isSettled: false, resolveTime: { lte: now, gte: windowClosed } },
    }),
  ]);
  return {
    lastSweepAt: last?.startedAt.toISOString() ?? null,
    lastSuccessfulSweepAt: lastSuccess?.startedAt.toISOString() ?? null,
    lastSweepStatus: last?.status ?? null,
    overdueMarkets,
    dueMarkets,
  };
}
```

`apps/web/src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { readDatabaseReadiness } from '@/lib/database-readiness';
import { readWorkerStatus } from '@/lib/worker-status';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const database = await readDatabaseReadiness();
  const worker = database.status === 'ready' ? await readWorkerStatus().catch(() => null) : null;
  return NextResponse.json(
    { scope: 'database', ...database, worker, checkedAt: new Date().toISOString() },
    { status: database.status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run --root apps/web src/lib/__tests__/worker-status.test.ts src/lib/__tests__/database-readiness.test.ts && npm --workspace=@weatherb/web run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/worker-status.ts apps/web/src/app/api/health/route.ts apps/web/src/lib/__tests__/worker-status.test.ts
git commit -m "feat(health): expose worker sweep status and overdue market counts"
```

---

### Task 9: Admin read-only mode

**Files:**
- Create: `apps/web/src/lib/admin-writes.ts`
- Modify (add gate as the first statement after the session check, before parsing the body): `apps/web/src/app/admin/api/system/config/route.ts` (PATCH), `system/pause/route.ts` (POST), `system/settler-pause/route.ts` (POST), `markets/cancel/route.ts` (POST), `cities/route.ts` (POST, PATCH), `provider/test/route.ts` (POST)
- Modify: `apps/web/src/components/admin/header.tsx`, `apps/web/src/components/admin/emergency-controls.tsx`, `apps/web/src/app/admin/(dashboard)/page.tsx`, `dashboard-client.tsx`
- Test: `apps/web/src/lib/__tests__/admin-writes.test.ts`, `apps/web/src/app/admin/api/__tests__/read-only.test.ts`

**Interfaces:**
- Produces `adminWritesEnabled(): boolean` (true only when `process.env.ADMIN_WRITES_ENABLED === 'true'`) and `adminReadOnlyResponse(): NextResponse` (403 `{ error: 'Admin panel is read-only' }`).
- `EmergencyControls` gains prop `writesEnabled: boolean`; `AdminHeader` gains prop `readOnly: boolean`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/__tests__/admin-writes.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminWritesEnabled, adminReadOnlyResponse } from '@/lib/admin-writes';

afterEach(() => vi.unstubAllEnvs());

describe('admin write gate', () => {
  it('is read-only unless explicitly enabled with the literal string true', () => {
    vi.stubEnv('ADMIN_WRITES_ENABLED', '');
    expect(adminWritesEnabled()).toBe(false);
    vi.stubEnv('ADMIN_WRITES_ENABLED', '1');
    expect(adminWritesEnabled()).toBe(false);
    vi.stubEnv('ADMIN_WRITES_ENABLED', 'true');
    expect(adminWritesEnabled()).toBe(true);
  });
  it('returns a 403 response', async () => {
    const response = adminReadOnlyResponse();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Admin panel is read-only' });
  });
});
```

`apps/web/src/app/admin/api/__tests__/read-only.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin-session', () => ({
  getAdminSession: async () => ({ wallet: '0xadmin', sessionId: 's' }),
  logAdminAction: vi.fn(),
}));
const data = vi.hoisted(() => ({
  toggleSettlerPause: vi.fn(),
  togglePause: vi.fn(),
  getSystemConfig: vi.fn(async () => ({ settlerPaused: true, isPaused: true })),
}));
vi.mock('@/lib/admin-data', () => data);

import { POST as settlerPause } from '../system/settler-pause/route';
import { POST as pause } from '../system/pause/route';

const json = (url: string, body: object) =>
  new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => vi.stubEnv('ADMIN_WRITES_ENABLED', ''));
afterEach(() => vi.unstubAllEnvs());

describe('admin write routes in read-only mode', () => {
  it('refuse settlement pause toggles with 403 and do not write', async () => {
    const response = await settlerPause(json('/admin/api/system/settler-pause', { settlerPaused: false }));
    expect(response.status).toBe(403);
    expect(data.toggleSettlerPause).not.toHaveBeenCalled();
  });
  it('refuse betting pause toggles with 403', async () => {
    expect((await pause(json('/admin/api/system/pause', { isPaused: false }))).status).toBe(403);
    expect(data.togglePause).not.toHaveBeenCalled();
  });
  it('allow writes when explicitly enabled', async () => {
    vi.stubEnv('ADMIN_WRITES_ENABLED', 'true');
    expect((await settlerPause(json('/admin/api/system/settler-pause', { settlerPaused: false }))).status).toBe(200);
    expect(data.toggleSettlerPause).toHaveBeenCalledWith(false);
  });
});
```

(If `system/pause/route.ts` imports something else from `@/lib/admin-data`, add it to the `data` mock object.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run --root apps/web src/lib/__tests__/admin-writes.test.ts src/app/admin/api/__tests__/read-only.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the gate**

`apps/web/src/lib/admin-writes.ts`:

```ts
import { NextResponse } from 'next/server';

/** Hosted admin is read-only until the panel's write surface has been separately reviewed. */
export function adminWritesEnabled(): boolean {
  return process.env.ADMIN_WRITES_ENABLED === 'true';
}

export function adminReadOnlyResponse(): NextResponse {
  return NextResponse.json({ error: 'Admin panel is read-only' }, { status: 403 });
}
```

In each listed write handler, immediately after the `if (!session) return 401` check (or, for `provider/test`, as the first line after auth), insert:

```ts
    if (!adminWritesEnabled()) return adminReadOnlyResponse();
```

with `import { adminWritesEnabled, adminReadOnlyResponse } from '@/lib/admin-writes';`. For `cities/route.ts` apply to both `POST` and `PATCH`; leave `GET` handlers untouched. Do not gate `auth/*` routes.

- [ ] **Step 4: Reflect read-only mode in the UI**

`apps/web/src/components/admin/header.tsx`: add prop `readOnly: boolean` and, next to the wallet display, render when true:

```tsx
{readOnly && (
  <span className="px-2 py-1 rounded-lg bg-neutral-100 text-xs font-body text-neutral-600">
    Read-only
  </span>
)}
```

`apps/web/src/app/admin/(dashboard)/layout.tsx`: pass `readOnly={!adminWritesEnabled()}` to `AdminHeader`.

`apps/web/src/components/admin/emergency-controls.tsx`: add prop `writesEnabled: boolean`; add `disabled={!writesEnabled}` and `title={writesEnabled ? undefined : 'Admin panel is read-only'}` to both buttons, plus class `disabled:opacity-50 disabled:cursor-not-allowed`.

`apps/web/src/app/admin/(dashboard)/page.tsx`: pass `writesEnabled={adminWritesEnabled()}` into `DashboardClient` (add the prop to `DashboardClientProps` and forward it to `EmergencyControls`).

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run --root apps/web src/lib/__tests__/admin-writes.test.ts src/app/admin/api/__tests__/ src/components/admin && npm --workspace=@weatherb/web run typecheck && npm run lint`
Expected: PASS. Fix any existing `EmergencyControls` test that constructs the component without the new prop by passing `writesEnabled={true}`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/admin-writes.ts apps/web/src/app/admin apps/web/src/components/admin apps/web/src/lib/__tests__/admin-writes.test.ts
git commit -m "feat(admin): default hosted admin panel to read-only"
```

---

### Task 10: Admin Operations page (read-only)

**Files:**
- Create: `apps/web/src/lib/admin-operations.ts`
- Create: `apps/web/src/app/admin/(dashboard)/operations/page.tsx`, `operations-client.tsx`
- Modify: `apps/web/src/components/admin/sidebar.tsx:8-14`
- Test: `apps/web/src/lib/__tests__/admin-operations.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OperationsAlert = { level: 'critical' | 'warning'; code: string; message: string };
  export type OutstandingMarket = { contractMarketId: number; cityName: string; thresholdTemp: number; resolveTime: string; windowClosesAt: string; status: string; settlementAttempts: number; lastSettlementAttemptAt: string | null; lastSettlementError: string | null; settlementTxHash: string | null; settlementSubmittedAt: string | null; isTest: boolean };
  export type OperationsSnapshot = { checkedAt: string; settlerPaused: boolean; schedulerPaused: boolean; settlerAddress: string | null; settlerBalance: string | null; worker: WorkerStatus; runs: Array<{ id: string; kind: string; trigger: string; status: string; startedAt: string; finishedAt: string | null; summary: unknown; error: string | null }>; outstanding: OutstandingMarket[]; alerts: OperationsAlert[] };
  export function deriveOperationsAlerts(input: { now: Date; settlerPaused: boolean; worker: WorkerStatus; outstanding: OutstandingMarket[]; settlerBalanceWei: bigint | null }): OperationsAlert[];
  export async function getOperationsSnapshot(): Promise<OperationsSnapshot>;
  ```
- Consumes `readWorkerStatus` (T8), `getSystemConfig` from `admin-data`.

- [ ] **Step 1: Write the failing unit test for alert derivation**

`apps/web/src/lib/__tests__/admin-operations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveOperationsAlerts, type OutstandingMarket } from '@/lib/admin-operations';

const now = new Date('2026-09-21T12:20:00Z');
const worker = {
  lastSweepAt: '2026-09-21T12:19:00.000Z',
  lastSuccessfulSweepAt: '2026-09-21T12:19:00.000Z',
  lastSweepStatus: 'succeeded',
  overdueMarkets: 0,
  dueMarkets: 0,
};
const market = (overrides: Partial<OutstandingMarket>): OutstandingMarket => ({
  contractMarketId: 2,
  cityName: 'Austin',
  thresholdTemp: 780,
  resolveTime: '2026-09-21T12:08:23.000Z',
  windowClosesAt: '2026-09-21T12:18:23.000Z',
  status: 'CLOSED',
  settlementAttempts: 0,
  lastSettlementAttemptAt: null,
  lastSettlementError: null,
  settlementTxHash: null,
  settlementSubmittedAt: null,
  isTest: false,
  ...overrides,
});
const codes = (alerts: { code: string }[]) => alerts.map((a) => a.code).sort();

describe('deriveOperationsAlerts', () => {
  it('is quiet when the worker is fresh and nothing is due', () => {
    expect(deriveOperationsAlerts({ now, settlerPaused: false, worker, outstanding: [], settlerBalanceWei: 10n ** 18n })).toEqual([]);
  });
  it('flags overdue markets as critical', () => {
    const alerts = deriveOperationsAlerts({ now, settlerPaused: false, worker, outstanding: [market({})], settlerBalanceWei: 10n ** 18n });
    expect(codes(alerts)).toEqual(['market-overdue']);
    expect(alerts[0]!.level).toBe('critical');
  });
  it('flags a stale worker when settlement is enabled and no sweep succeeded for 6 minutes', () => {
    const stale = { ...worker, lastSuccessfulSweepAt: '2026-09-21T12:13:00.000Z' };
    expect(codes(deriveOperationsAlerts({ now, settlerPaused: false, worker: stale, outstanding: [], settlerBalanceWei: null }))).toEqual(['worker-stale']);
  });
  it('does not call a paused worker stale, but warns when markets are due while paused', () => {
    const due = market({ resolveTime: '2026-09-21T12:15:00.000Z', windowClosesAt: '2026-09-21T12:25:00.000Z' });
    expect(codes(deriveOperationsAlerts({ now, settlerPaused: true, worker: { ...worker, lastSuccessfulSweepAt: null }, outstanding: [due], settlerBalanceWei: 10n ** 18n }))).toEqual(['settler-paused']);
  });
  it('warns on retrying settlements, failed runs, and low balance', () => {
    const retrying = market({ resolveTime: '2026-09-21T12:15:00.000Z', windowClosesAt: '2026-09-21T12:25:00.000Z', settlementAttempts: 2, lastSettlementError: 'weather unavailable' });
    const alerts = deriveOperationsAlerts({ now, settlerPaused: false, worker: { ...worker, lastSweepStatus: 'failed' }, outstanding: [retrying], settlerBalanceWei: 10n ** 16n });
    expect(codes(alerts)).toEqual(['settlement-retrying', 'settler-low-balance', 'worker-failed']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --root apps/web src/lib/__tests__/admin-operations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `admin-operations.ts`**

```ts
import { ARC_TESTNET, assertArcChain } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { formatUsdc } from '@weatherb/shared/utils/payout';
import { SETTLEMENT_WINDOW_SECONDS } from '@weatherb/shared/utils/weather-timing';
import { createPublicClient, http, type Hex } from 'viem';
import prisma from './prisma';
import { getSystemConfig } from './admin-data';
import { readWorkerStatus, type WorkerStatus } from './worker-status';

export type OperationsAlert = { level: 'critical' | 'warning'; code: string; message: string };
export type OutstandingMarket = {
  contractMarketId: number;
  cityName: string;
  thresholdTemp: number;
  resolveTime: string;
  windowClosesAt: string;
  status: string;
  settlementAttempts: number;
  lastSettlementAttemptAt: string | null;
  lastSettlementError: string | null;
  settlementTxHash: string | null;
  settlementSubmittedAt: string | null;
  isTest: boolean;
};
export type OperationsRun = {
  id: string;
  kind: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: unknown;
  error: string | null;
};
export type OperationsSnapshot = {
  checkedAt: string;
  settlerPaused: boolean;
  schedulerPaused: boolean;
  settlerAddress: string | null;
  settlerBalance: string | null;
  worker: WorkerStatus;
  runs: OperationsRun[];
  outstanding: OutstandingMarket[];
  alerts: OperationsAlert[];
};

const STALE_WORKER_MS = 6 * 60 * 1000;
const LOW_BALANCE_WEI = 2n * 10n ** 17n; // 0.2 USDC covers many testnet settlements.

export function deriveOperationsAlerts(input: {
  now: Date;
  settlerPaused: boolean;
  worker: WorkerStatus;
  outstanding: OutstandingMarket[];
  settlerBalanceWei: bigint | null;
}): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];
  const nowMs = input.now.getTime();
  const overdue = input.outstanding.filter((m) => Date.parse(m.windowClosesAt) < nowMs);
  const due = input.outstanding.filter(
    (m) => Date.parse(m.resolveTime) <= nowMs && Date.parse(m.windowClosesAt) >= nowMs,
  );
  if (overdue.length)
    alerts.push({
      level: 'critical',
      code: 'market-overdue',
      message: `${overdue.length} market(s) passed the observation window without settlement or cancellation: ${overdue.map((m) => `#${m.contractMarketId}`).join(', ')}`,
    });
  const retrying = due.filter((m) => m.settlementAttempts > 0 && m.lastSettlementError);
  if (retrying.length)
    alerts.push({
      level: 'warning',
      code: 'settlement-retrying',
      message: `${retrying.length} market(s) retrying inside the window: ${retrying.map((m) => `#${m.contractMarketId}`).join(', ')}`,
    });
  if (input.settlerPaused) {
    if (due.length || overdue.length)
      alerts.push({
        level: 'warning',
        code: 'settler-paused',
        message: 'Settlement is paused while markets are due',
      });
  } else {
    const lastOk = input.worker.lastSuccessfulSweepAt
      ? Date.parse(input.worker.lastSuccessfulSweepAt)
      : null;
    if (lastOk === null || nowMs - lastOk > STALE_WORKER_MS)
      alerts.push({
        level: 'critical',
        code: 'worker-stale',
        message: lastOk === null ? 'No successful worker sweep recorded' : `Last successful sweep ${Math.round((nowMs - lastOk) / 60000)} min ago`,
      });
  }
  if (input.worker.lastSweepStatus === 'failed')
    alerts.push({ level: 'warning', code: 'worker-failed', message: 'The most recent sweep failed' });
  if (input.settlerBalanceWei !== null && input.settlerBalanceWei < LOW_BALANCE_WEI)
    alerts.push({
      level: 'warning',
      code: 'settler-low-balance',
      message: `Settler balance ${formatUsdc(input.settlerBalanceWei)} USDC is below ${formatUsdc(LOW_BALANCE_WEI)} USDC`,
    });
  return alerts;
}

async function readSettler(): Promise<{ address: string | null; balanceWei: bigint | null }> {
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const rpcUrl = process.env.RPC_URL;
  if (!contract || !rpcUrl) return { address: null, balanceWei: null };
  try {
    const client = createPublicClient({ chain: ARC_TESTNET, transport: http(rpcUrl) });
    assertArcChain(await client.getChainId());
    const address = await client.readContract({ address: contract, abi: WEATHER_MARKET_ABI, functionName: 'settler' });
    return { address, balanceWei: await client.getBalance({ address }) };
  } catch (error) {
    console.error('[Operations] Settler read failed:', error instanceof Error ? error.message : error);
    return { address: null, balanceWei: null };
  }
}

export async function getOperationsSnapshot(now: Date = new Date()): Promise<OperationsSnapshot> {
  const [config, worker, settler, runs, markets] = await Promise.all([
    getSystemConfig(),
    readWorkerStatus(now),
    readSettler(),
    prisma.workerRun.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
    prisma.market.findMany({
      where: { isSettled: false },
      orderBy: { resolveTime: 'asc' },
      select: {
        contractMarketId: true, cityName: true, thresholdTemp: true, resolveTime: true, status: true,
        settlementAttempts: true, lastSettlementAttemptAt: true, lastSettlementError: true,
        settlementTxHash: true, settlementSubmittedAt: true, isTest: true,
      },
    }),
  ]);
  const outstanding: OutstandingMarket[] = markets.map((m) => ({
    ...m,
    resolveTime: m.resolveTime.toISOString(),
    windowClosesAt: new Date(m.resolveTime.getTime() + SETTLEMENT_WINDOW_SECONDS * 1000).toISOString(),
    lastSettlementAttemptAt: m.lastSettlementAttemptAt?.toISOString() ?? null,
    settlementSubmittedAt: m.settlementSubmittedAt?.toISOString() ?? null,
  }));
  return {
    checkedAt: now.toISOString(),
    settlerPaused: config.settlerPaused,
    schedulerPaused: config.isPaused,
    settlerAddress: settler.address,
    settlerBalance: settler.balanceWei === null ? null : formatUsdc(settler.balanceWei),
    worker,
    runs: runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    outstanding,
    alerts: deriveOperationsAlerts({
      now,
      settlerPaused: config.settlerPaused,
      worker,
      outstanding,
      settlerBalanceWei: settler.balanceWei,
    }),
  };
}
```

- [ ] **Step 4: Run the unit test**

Run: `npx vitest run --root apps/web src/lib/__tests__/admin-operations.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the page, client, and nav entry**

`apps/web/src/app/admin/(dashboard)/operations/page.tsx`:

```tsx
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getOperationsSnapshot } from '@/lib/admin-operations';
import { OperationsClient } from './operations-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function OperationsContent(): Promise<React.ReactElement> {
  try {
    return <OperationsClient snapshot={await getOperationsSnapshot()} />;
  } catch (error) {
    console.error('Failed to load operations snapshot:', error);
    return (
      <div role="alert" className="p-6 rounded-2xl border border-error-soft bg-error-soft/10">
        <AlertTriangle className="w-6 h-6 text-error-soft mb-2" />
        <h3 className="font-display font-bold text-lg">Failed to Load Operations</h3>
        <p className="font-body text-sm">Operations data is unavailable.</p>
      </div>
    );
  }
}

export default function OperationsPage(): React.ReactElement {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-neutral-800 mb-1">Operations</h1>
        <p className="font-body text-neutral-500">
          Hosted settlement worker status, outstanding markets, and recent runs. Read-only.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 rounded-2xl bg-neutral-100 animate-pulse" />}>
        <OperationsContent />
      </Suspense>
    </div>
  );
}
```

`apps/web/src/app/admin/(dashboard)/operations/operations-client.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { arcTransactionUrl } from '@weatherb/shared/constants';
import type { OperationsSnapshot } from '@/lib/admin-operations';

const REFRESH_MS = 30_000;
const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : '—');

export function OperationsClient({ snapshot }: { snapshot: OperationsSnapshot }): React.ReactElement {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="space-y-6">
      <section aria-label="Alerts" className="space-y-2">
        {snapshot.alerts.length === 0 ? (
          <div className="p-4 rounded-2xl border border-success-soft/40 bg-success-soft/20 font-body text-sm">
            No active alerts. Checked {fmt(snapshot.checkedAt)}.
          </div>
        ) : (
          snapshot.alerts.map((alert) => (
            <div
              key={alert.code}
              role="alert"
              className={`p-4 rounded-2xl border font-body text-sm ${
                alert.level === 'critical'
                  ? 'border-error-soft/50 bg-error-soft/20'
                  : 'border-sunset-orange/40 bg-sunset-orange/10'
              }`}
            >
              <span className="font-mono text-xs uppercase mr-2">{alert.level}</span>
              <span className="font-mono text-xs mr-2">{alert.code}</span>
              {alert.message}
            </div>
          ))
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['Settlement', snapshot.settlerPaused ? 'Paused' : 'Enabled'],
          ['Last successful sweep', fmt(snapshot.worker.lastSuccessfulSweepAt)],
          ['Due / overdue', `${snapshot.worker.dueMarkets} / ${snapshot.worker.overdueMarkets}`],
          ['Settler balance', snapshot.settlerBalance ? `${snapshot.settlerBalance} USDC` : '—'],
        ].map(([title, value]) => (
          <div key={title} className="p-5 rounded-2xl border border-neutral-200 bg-white">
            <p className="font-body text-sm text-neutral-500 mb-1">{title}</p>
            <p className="font-display text-xl font-bold text-neutral-800 break-all">{value}</p>
          </div>
        ))}
      </section>
      <p className="font-mono text-xs text-neutral-500 break-all">
        Settler: {snapshot.settlerAddress ?? 'unavailable'}
      </p>

      <section className="p-5 rounded-2xl border border-neutral-200 bg-white overflow-x-auto">
        <h2 className="font-display font-bold text-lg text-neutral-800 mb-4">Outstanding markets</h2>
        {snapshot.outstanding.length === 0 ? (
          <p className="font-body text-neutral-400">None</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Market</th>
                <th className="py-2 pr-4">Resolves</th><th className="py-2 pr-4">Window closes</th>
                <th className="py-2 pr-4">Attempts</th><th className="py-2 pr-4">Last error</th>
                <th className="py-2 pr-4">Submission</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.outstanding.map((m) => (
                <tr key={m.contractMarketId} className="border-t border-neutral-100 align-top">
                  <td className="py-2 pr-4 font-mono">#{m.contractMarketId}{m.isTest ? ' (test)' : ''}</td>
                  <td className="py-2 pr-4">{m.cityName} ≥ {Math.round(m.thresholdTemp / 10)}°F</td>
                  <td className="py-2 pr-4">{fmt(m.resolveTime)}</td>
                  <td className="py-2 pr-4">{fmt(m.windowClosesAt)}</td>
                  <td className="py-2 pr-4">{m.settlementAttempts}</td>
                  <td className="py-2 pr-4 max-w-xs break-words text-neutral-600">{m.lastSettlementError ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {m.settlementTxHash ? (
                      <a className="underline" href={arcTransactionUrl(m.settlementTxHash as `0x${string}`)} target="_blank" rel="noreferrer">
                        {m.settlementTxHash.slice(0, 12)}… ({fmt(m.settlementSubmittedAt)})
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="p-5 rounded-2xl border border-neutral-200 bg-white overflow-x-auto">
        <h2 className="font-display font-bold text-lg text-neutral-800 mb-4">Recent worker runs</h2>
        {snapshot.runs.length === 0 ? (
          <p className="font-body text-neutral-400">No runs recorded</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-4">Started</th><th className="py-2 pr-4">Kind</th>
                <th className="py-2 pr-4">Trigger</th><th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.runs.map((run) => (
                <tr key={run.id} className="border-t border-neutral-100 align-top">
                  <td className="py-2 pr-4">{fmt(run.startedAt)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{run.kind}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{run.trigger}</td>
                  <td className="py-2 pr-4">{run.status}</td>
                  <td className="py-2 pr-4 font-mono text-xs max-w-md break-words">
                    {run.error ?? JSON.stringify(run.summary ?? {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

Check `arcTransactionUrl` is exported from `@weatherb/shared/constants` (it is imported by `arc-lifecycle.ts` from there).

In `apps/web/src/components/admin/sidebar.tsx` add `Activity` to the lucide import and insert after the Dashboard entry:

```ts
  { href: '/admin/operations', label: 'Operations', icon: Activity },
```

- [ ] **Step 6: Typecheck, lint, build**

Run: `npm --workspace=@weatherb/web run typecheck && npm run lint && npm --workspace=@weatherb/web run build`
Expected: PASS; `/admin/operations` appears in the route list as dynamic.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/admin-operations.ts "apps/web/src/app/admin/(dashboard)/operations" apps/web/src/components/admin/sidebar.tsx apps/web/src/lib/__tests__/admin-operations.test.ts
git commit -m "feat(admin): read-only Operations page with worker runs, outstanding markets and alerts"
```

---

### Task 11: Operator scripts — hosted settler key, worker profile, worker CLI, lifecycle commands

**Files:**
- Create: `scripts/development/setup-hosted-settler.mjs`, `scripts/development/worker-profile.mjs`, `scripts/development/worker.mjs`, `scripts/development/worker-role.sql`, `.env.arc-worker.example`
- Create: `scripts/verification/worker-profile.test.mjs`
- Modify: `scripts/development/hosted.mjs`, `apps/web/src/scripts/development-database.ts`, `apps/web/src/scripts/arc-lifecycle.ts`, `package.json`, `.env.arc-dev.example`
- Lint scope: root `lint` script already covers `scripts/development`.

**Interfaces:**
- `workerEnvironment(settings): { vercelEnv: Record<string,string>; cli: { VERCEL_ORG_ID: string; VERCEL_PROJECT_ID: string }; workerUrl: string; qstashToken: string; cronSecret: string }`.
- npm scripts: `arc:worker` (`env-push | deploy | schedules | check`), `arc:hosted -- settler enable|disable`, `arc:hosted -- mark-test <id>`, `arc:hosted-settler`.
- `arc:lifecycle -- rotate-settler | fund-hosted-settler | hosted-test <label>`.

- [ ] **Step 1: Write the failing safety test**

`scripts/verification/worker-profile.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workerEnvironment, PUBLIC_PROJECT_ID } from '../development/worker-profile.mjs';

const settings = {
  WEATHERB_DATABASE_TARGET: 'neon',
  WEATHERB_NEON_ENDPOINT: 'ep-example-123',
  NEXT_PUBLIC_CHAIN_ID: '5042002',
  NEXT_PUBLIC_CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID: 'client',
  RPC_URL: 'https://rpc.testnet.arc.io',
  DATABASE_URL:
    'postgresql://weatherb_worker:test@ep-example-123-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full',
  SETTLER_PRIVATE_KEY: `0x${'a'.repeat(64)}`,
  CRON_SECRET: 'c'.repeat(64),
  TOMORROW_IO_API_KEY: 'weather',
  QSTASH_TOKEN: 'qstash',
  VERCEL_ORG_ID: 'team_2l4gGocPPIEpAB4OWmKXM5LJ',
  VERCEL_PROJECT_ID: 'prj_workerworkerworkerworker',
  WORKER_URL: 'https://weatherb-arc-worker.vercel.app',
};

test('worker profile produces only runtime variables and marks the deployment as the worker', () => {
  const env = workerEnvironment({ ...settings, DIRECT_URL: 'must-not-export', ADMIN_PRIVATE_KEY: 'no', SCHEDULER_PRIVATE_KEY: 'no', ADMIN_WALLETS: 'no', ADMIN_WRITES_ENABLED: 'true' });
  assert.equal(env.vercelEnv.WEATHERB_WORKER_ROLE, 'settler');
  assert.equal(env.vercelEnv.WEATHERB_ENV_FILE, 'none');
  assert.equal(env.vercelEnv.APP_URL, settings.WORKER_URL);
  for (const key of ['DIRECT_URL', 'ADMIN_PRIVATE_KEY', 'SCHEDULER_PRIVATE_KEY', 'ADMIN_WALLETS', 'ADMIN_WRITES_ENABLED', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
    assert.equal(env.vercelEnv[key], undefined);
  assert.deepEqual(env.cli, { VERCEL_ORG_ID: settings.VERCEL_ORG_ID, VERCEL_PROJECT_ID: settings.VERCEL_PROJECT_ID });
});

test('worker profile refuses the public project, missing signer, wrong DB role, and weak secrets', () => {
  for (const replacement of [
    { VERCEL_PROJECT_ID: PUBLIC_PROJECT_ID },
    { VERCEL_ORG_ID: 'team_other' },
    { SETTLER_PRIVATE_KEY: undefined },
    { SETTLER_PRIVATE_KEY: '0x1234' },
    { CRON_SECRET: 'short' },
    { TOMORROW_IO_API_KEY: '' },
    { DATABASE_URL: settings.DATABASE_URL.replace('weatherb_worker', 'weatherb_app') },
    { DATABASE_URL: settings.DATABASE_URL.replace('verify-full', 'require') },
    { WORKER_URL: 'http://weatherb-arc-worker.vercel.app' },
    { WORKER_URL: 'https://weatherb-arc-testnet.vercel.app' },
    { RPC_URL: 'https://other.example' },
  ])
    assert.throws(() => workerEnvironment({ ...settings, ...replacement }), undefined, JSON.stringify(replacement));
});
```

Run: `npm run test:safety`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement `worker-profile.mjs`**

```js
/** Worker-only Vercel profile: the ONLY deployment that may hold settlement credentials. */
export const PUBLIC_PROJECT_ID = 'prj_Xf7r8PYDcxuvtLKApRK4YvfunSfi';
export const TEAM_ID = 'team_2l4gGocPPIEpAB4OWmKXM5LJ';
export const PUBLIC_HOST = 'weatherb-arc-testnet.vercel.app';

export function workerEnvironment(settings) {
  if (
    settings.WEATHERB_DATABASE_TARGET !== 'neon' ||
    !/^ep-[a-z0-9-]+$/.test(settings.WEATHERB_NEON_ENDPOINT ?? '') ||
    settings.NEXT_PUBLIC_CHAIN_ID !== '5042002' ||
    !/^0x[0-9a-fA-F]{40}$/.test(settings.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '') ||
    settings.RPC_URL !== 'https://rpc.testnet.arc.io'
  )
    throw new Error('Expected an explicit Neon / Arc Testnet worker profile');
  if (settings.VERCEL_ORG_ID !== TEAM_ID) throw new Error('Unexpected Vercel team');
  if (!/^prj_[A-Za-z0-9]+$/.test(settings.VERCEL_PROJECT_ID ?? '') || settings.VERCEL_PROJECT_ID === PUBLIC_PROJECT_ID)
    throw new Error('Worker must target a dedicated Vercel project, never the public site');
  let workerUrl;
  try {
    workerUrl = new URL(settings.WORKER_URL);
  } catch {
    throw new Error('Invalid WORKER_URL');
  }
  if (workerUrl.protocol !== 'https:' || workerUrl.hostname === PUBLIC_HOST || !workerUrl.hostname.endsWith('.vercel.app'))
    throw new Error('WORKER_URL must be the dedicated worker deployment over HTTPS');
  let db;
  try {
    db = new URL(settings.DATABASE_URL);
  } catch {
    throw new Error('Invalid DATABASE_URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(db.protocol) ||
    !db.password ||
    db.username !== 'weatherb_worker' ||
    db.pathname !== '/neondb' ||
    !db.hostname.startsWith(`${settings.WEATHERB_NEON_ENDPOINT}-pooler.`) ||
    !db.hostname.endsWith('.aws.neon.tech') ||
    db.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new Error('Expected restricted weatherb_worker credentials on the selected Neon endpoint');
  if (!/^0x[0-9a-fA-F]{64}$/.test(settings.SETTLER_PRIVATE_KEY ?? '')) throw new Error('SETTLER_PRIVATE_KEY missing or malformed');
  if ((settings.CRON_SECRET ?? '').length < 32) throw new Error('CRON_SECRET must be at least 32 characters');
  if (!settings.TOMORROW_IO_API_KEY) throw new Error('TOMORROW_IO_API_KEY required');
  if (!settings.QSTASH_TOKEN) throw new Error('QSTASH_TOKEN required');
  const vercelEnv = {
    WEATHERB_ENV_FILE: 'none',
    NEXT_TELEMETRY_DISABLED: '1',
    WEATHERB_WORKER_ROLE: 'settler',
    APP_URL: workerUrl.origin,
    DATABASE_URL: db.href,
    RPC_URL: settings.RPC_URL,
    NEXT_PUBLIC_CHAIN_ID: settings.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_CONTRACT_ADDRESS: settings.NEXT_PUBLIC_CONTRACT_ADDRESS,
    SETTLER_PRIVATE_KEY: settings.SETTLER_PRIVATE_KEY,
    CRON_SECRET: settings.CRON_SECRET,
    TOMORROW_IO_API_KEY: settings.TOMORROW_IO_API_KEY,
    QSTASH_TOKEN: settings.QSTASH_TOKEN,
  };
  if (settings.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) vercelEnv.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = settings.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  return {
    vercelEnv,
    cli: { VERCEL_ORG_ID: settings.VERCEL_ORG_ID, VERCEL_PROJECT_ID: settings.VERCEL_PROJECT_ID },
    workerUrl: workerUrl.origin,
    qstashToken: settings.QSTASH_TOKEN,
    cronSecret: settings.CRON_SECRET,
  };
}
```

Run: `npm run test:safety` → the two new tests PASS.

- [ ] **Step 3: Implement `worker.mjs`**

```js
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { workerEnvironment } from './worker-profile.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2];
if (!['env-push', 'deploy', 'schedules', 'check'].includes(command))
  throw new Error('Use env-push, deploy, schedules, or check');
const profile = `${root}.env.arc-worker`;
if (statSync(profile).mode & 0o077) throw new Error('Worker profile must have mode 0600');
const worker = workerEnvironment(parse(readFileSync(profile)));
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP'].includes(key)),
);
const cliEnv = { ...baseEnv, ...worker.cli };
function vercel(args, input) {
  const result = spawnSync('vercel', args, { cwd: root, env: cliEnv, input, stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'] });
  if (result.error) throw new Error('Vercel CLI could not start');
  return result.status ?? 1;
}
if (command === 'env-push') {
  for (const [key, value] of Object.entries(worker.vercelEnv)) {
    vercel(['env', 'rm', key, 'production', '--yes']); // Ignore "not found" on first push.
    if (vercel(['env', 'add', key, 'production'], value) !== 0) throw new Error(`Failed to set ${key}`);
    console.log(`set ${key}`);
  }
} else if (command === 'deploy') {
  process.exitCode = vercel(['deploy', '--prod', '--yes']);
} else if (command === 'schedules') {
  const { Client } = await import('@upstash/qstash');
  const client = new Client({ token: worker.qstashToken });
  const schedule = await client.schedules.create({
    scheduleId: 'weatherb-arc-settle-sweep',
    destination: `${worker.workerUrl}/api/cron/settle-markets`,
    cron: '*/2 * * * *',
    method: 'GET',
    retries: 0,
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  console.log(JSON.stringify({ scheduleId: schedule.scheduleId, cron: '*/2 * * * *', destination: `${worker.workerUrl}/api/cron/settle-markets` }));
} else {
  const health = await fetch(`${worker.workerUrl}/api/health`);
  const anonymous = await fetch(`${worker.workerUrl}/api/cron/settle-markets`);
  const authorized = await fetch(`${worker.workerUrl}/api/cron/settle-markets`, {
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  console.log(JSON.stringify({ health: { status: health.status, body: await health.json() }, anonymous: anonymous.status, authorized: { status: authorized.status, body: await authorized.json() } }, null, 2));
}
```

`@upstash/qstash` is a dependency of `apps/web`; run this script with `node` from repo root — resolution works because npm workspaces hoist it to root `node_modules`. If not hoisted, use `createRequire(new URL('../../apps/web/package.json', import.meta.url)).resolve('@upstash/qstash')` like `safety.test.mjs` does for vitest.

- [ ] **Step 4: Implement `setup-hosted-settler.mjs`**

```js
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
const dir = fileURLToPath(new URL('../../.tools/arc-hosted', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const path = `${dir}/settler.json`;
if (!existsSync(path)) {
  const privateKey = generatePrivateKey();
  writeFileSync(
    path,
    JSON.stringify({ chainId: ARC_TESTNET.id, createdAt: new Date().toISOString(), address: privateKeyToAccount(privateKey).address, privateKey }, null, 2),
    { mode: 0o600, flag: 'wx' },
  );
}
if (statSync(path).mode & 0o077) throw new Error('Hosted settler file permissions must be 0600');
const saved = JSON.parse(readFileSync(path));
assertArcChain(saved.chainId);
console.log(`hosted settler: ${saved.address}`);
console.log('Copy the private key into .env.arc-worker as SETTLER_PRIVATE_KEY by hand (never via chat or logs).');
```

Run `setup-wallets.mjs` uses the same `.ts` import style; confirm `node scripts/development/setup-wallets.mjs --help` style invocation works under Node 24 with type stripping (it is how the existing script runs).

- [ ] **Step 5: `worker-role.sql` and `.env.arc-worker.example`**

`scripts/development/worker-role.sql`:

```sql
-- Run once on the hosted Neon project with its administrative role, then set the password out of band:
--   ALTER ROLE weatherb_worker LOGIN PASSWORD '<generated>';
-- Then re-run `npm run arc:hosted -- migrate` so access.sql grants the tables and policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='weatherb_worker') THEN
    CREATE ROLE weatherb_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO weatherb_worker', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO weatherb_worker;
```

`.env.arc-worker.example`:

```
# Copy to .env.arc-worker, chmod 600. This profile is the ONLY place settlement credentials live locally.
# Never copy it into the public project or print it. Set every REPLACE value by hand.
WEATHERB_DATABASE_TARGET=neon
WEATHERB_NEON_ENDPOINT=ep-delicate-lake-b5447hyb
DATABASE_URL="postgresql://weatherb_worker:REPLACE@ep-delicate-lake-b5447hyb-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full"
NEXT_PUBLIC_CHAIN_ID=5042002
NEXT_PUBLIC_CONTRACT_ADDRESS=0xd86e2774e4a9bf2e86199791068b9350b718b891
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=REPLACE
RPC_URL=https://rpc.testnet.arc.io
SETTLER_PRIVATE_KEY=REPLACE   # from .tools/arc-hosted/settler.json (npm run arc:hosted-settler)
CRON_SECRET=REPLACE           # openssl rand -hex 32
TOMORROW_IO_API_KEY=REPLACE
QSTASH_TOKEN=REPLACE
VERCEL_ORG_ID=team_2l4gGocPPIEpAB4OWmKXM5LJ
VERCEL_PROJECT_ID=REPLACE     # prj_... of weatherb-arc-worker (never the public project)
WORKER_URL=https://weatherb-arc-worker.vercel.app
```

Confirm `.gitignore` already ignores `.env.*` except examples (it ignores `.env.arc-dev` / `.env.arc-hosted` today; add `.env.arc-worker` explicitly if the pattern is not a glob).

- [ ] **Step 6: Hosted DB operator commands**

In `apps/web/src/scripts/development-database.ts`, extend the command handling:

```ts
  } else if (command === 'settler') {
    const mode = process.argv[3];
    if (mode !== 'enable' && mode !== 'disable') throw new Error('Use settler enable|disable');
    await db.systemConfig.update({ where: { id: 'default' }, data: { settlerPaused: mode === 'disable' } });
    console.log(JSON.stringify({ settlerPaused: mode === 'disable' }));
  } else if (command === 'mark-test') {
    const contractMarketId = Number(process.argv[3]);
    if (!Number.isSafeInteger(contractMarketId) || contractMarketId < 0) throw new Error('Use mark-test <contractMarketId>');
    await db.market.update({ where: { contractMarketId }, data: { isTest: true } });
    console.log(JSON.stringify({ contractMarketId, isTest: true }));
  } else if (command === 'seed') await seedDevelopmentDatabase(db);
  else if (command !== 'check') throw new Error('Use seed, check, settler, or mark-test');
```

and skip the trailing check output for `settler`/`mark-test` (only print for `seed`/`check`). In `scripts/development/hosted.mjs` add:

```js
  settler: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'settler', ...process.argv.slice(3)],
  'mark-test': ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'mark-test', ...process.argv.slice(3)],
```

and update the error message.

- [ ] **Step 7: Lifecycle commands for rotation, funding, and short hosted-test markets**

In `apps/web/src/scripts/arc-lifecycle.ts`:

1. Add `hostedSettler?: Hex;` to `Journal`.
2. In `requireDeployment()`, compare `settler` against `(journal.hostedSettler ?? saved.wallets.settler!.address).toLowerCase()`.
3. Extend the `send` `functionName` union with `'setSettler'`.
4. In `create()`, change the duration line to:
   ```ts
   const resolveTime = Number(block.timestamp) + (label === 'browser-test' || label.startsWith('hosted-test-') ? 1800 : 86400);
   ```
5. Add commands before the final `else`:

```ts
  } else if (command === 'rotate-settler') {
    const file = `${root}.tools/arc-hosted/settler.json`;
    if (statSync(file).mode & 0o077) throw new Error('Hosted settler file must have mode 0600.');
    const hosted = JSON.parse(readFileSync(file, 'utf8')) as { chainId: number; address: Hex };
    assertArcChain(hosted.chainId);
    if (journal.hostedSettler && journal.hostedSettler.toLowerCase() !== hosted.address.toLowerCase())
      throw new Error('Journal already records a different hosted settler.');
    const target = await requireDeployment(); // Passes while the local settler is still active.
    journal.hostedSettler = hosted.address;
    save();
    await send('rotate-settler', 'owner', 'setSettler', [hosted.address]);
    const current = await publicClient.readContract({ address: target, abi, functionName: 'settler' });
    if (current.toLowerCase() !== hosted.address.toLowerCase()) throw new Error('Settler rotation not confirmed.');
    console.log(`settler is now hosted ${hosted.address}; local settlement is disabled.`);
  } else if (command === 'fund-hosted-settler') {
    if (!journal.hostedSettler) throw new Error('Run rotate-settler first.');
    const signer = wallet('owner');
    const to = journal.hostedSettler;
    await receipt('fund-hosted-settler', () => signer.sendTransaction({ to, value: parseNativeUsdc('2') }));
    console.log(`hosted settler balance: ${formatEther(await publicClient.getBalance({ address: to }))} USDC`);
  } else if (command === 'hosted-test') {
    const suffix = process.argv[3];
    if (!/^[a-z0-9-]{1,20}$/.test(suffix ?? '')) throw new Error('Use hosted-test <label>');
    const id = await create(`hosted-test-${suffix}`, false);
    await send(`hosted-test-${suffix}-yes`, 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.01'));
    await send(`hosted-test-${suffix}-no`, 'noBettor', 'placeBet', [id, false], parseNativeUsdc('0.01'));
    await persistMarket(id, await readMarket(publicClient, address(), id));
```

6. In the `settle` command, first line: `if (journal.hostedSettler) throw new Error('Settlement is owned by the hosted worker; use the Operations page.');`
7. Update the usage error string to include the new commands. Note `claims` skips only `cancellation`; hosted-test markets will be claimed by the generated wallets on the next `claims` run, which is desired evidence.

- [ ] **Step 8: npm scripts and dev profile**

In root `package.json` `scripts` add:

```json
    "arc:worker": "node scripts/development/worker.mjs",
    "arc:hosted-settler": "node scripts/development/setup-hosted-settler.mjs",
```

In `.env.arc-dev.example` add `WEATHERB_WORKER_ROLE=settler` with a comment that it is required to exercise `/api/cron/*` locally.

- [ ] **Step 9: Verify**

Run: `npm run lint && npm --workspace=@weatherb/web run typecheck && npm run test:safety`
Expected: PASS. Also `node scripts/development/worker.mjs` without a profile must fail with an ENOENT/mode error, never a stack trace containing values.

- [ ] **Step 10: Commit**

```bash
git add scripts/development scripts/verification/worker-profile.test.mjs .env.arc-worker.example .env.arc-dev.example package.json apps/web/src/scripts
git commit -m "feat(ops): worker deployment profile, hosted settler key setup, and lifecycle rotation commands"
```

---

### Task 12: Provision the worker (paused) and validate authentication/readiness

This is an operator task. Nothing here signs a settlement. Perform in order; record each result in `docs/testing/arc-testnet-lifecycle-acceptance.md` (Task 15).

- [ ] **Step 1: Full local verification on the branch**

Run: `npm run verify`
Expected: all green (lint, typecheck, safety incl. new worker-profile tests, shared/web/DB/Foundry tests, builds, ABI).

- [ ] **Step 2: Neon worker role**

Using the owner connection kept privately under `.tools/arc-hosted/` (never echo it):

```sh
psql "$(cat .tools/arc-hosted/owner-url)" -f scripts/development/worker-role.sql
psql "$(cat .tools/arc-hosted/owner-url)" -c "ALTER ROLE weatherb_worker LOGIN PASSWORD '<paste a fresh openssl rand -base64 32 value>'"
```

(Adapt the first argument to however the owner URL is actually stored; if it is not stored, run these in the Neon SQL editor.) Then apply the migration and refreshed access policy with the migrator:

```sh
npm run arc:hosted -- migrate
npm run arc:hosted -- check
```

Expected: migration `20260920210000_worker_operations` applied; `check` prints `ready: true`, `settlerPaused: true`, markets 0–3 unchanged.

- [ ] **Step 3: Generate the hosted settler key and worker profile**

```sh
npm run arc:hosted-settler          # prints ONLY the address
cp .env.arc-worker.example .env.arc-worker && chmod 600 .env.arc-worker
```

Fill `.env.arc-worker` by hand: the `weatherb_worker` password, `SETTLER_PRIVATE_KEY` from `.tools/arc-hosted/settler.json`, `CRON_SECRET` from `openssl rand -hex 32`, Tomorrow.io key and QStash token from the existing local profiles/Upstash console. Leave `VERCEL_PROJECT_ID=REPLACE` until Step 4.

- [ ] **Step 4: Create the Vercel worker project (CLI, no git integration)**

```sh
vercel project add weatherb-arc-worker --scope cobi-beans-projects
vercel project inspect weatherb-arc-worker --scope cobi-beans-projects
```

Copy the `prj_…` ID into `.env.arc-worker` as `VERCEL_PROJECT_ID`. Confirm the project's Node version is 24.x and Framework is Next.js in the dashboard (it inherits from `vercel.json` on first deploy). Do **not** connect a Git repository to this project; deploys are deliberate CLI actions.

- [ ] **Step 5: Push environment and deploy**

```sh
npm run arc:worker -- env-push
npm run arc:worker -- deploy
```

Expected: `set …` for each key; a production deployment URL `https://weatherb-arc-worker.vercel.app`. Values are never printed.

- [ ] **Step 6: Validate the worker while paused**

```sh
npm run arc:worker -- check
```

Expected JSON: `health.status 200` with `settler: "paused"` and a `worker` object; `anonymous: 401`; `authorized.status 200` with `{ success: true, skipped: true, reason: "settler is paused" }`.

Also verify from the public site that nothing changed: `curl -s https://weatherb-arc-testnet.vercel.app/api/cron/settle-markets` → 401, and `/api/health` still `settler: paused`.

- [ ] **Step 7: Create the QStash schedule**

```sh
npm run arc:worker -- schedules
```

Expected: `{ scheduleId: "weatherb-arc-settle-sweep", cron: "*/2 * * * *", … }`. Within four minutes, `/admin/operations` (after Task 13) or `npm run arc:hosted -- check`-adjacent queries show `WorkerRun` rows with `status: skipped` (paused) and trigger `qstash:weatherb-arc-settle-sweep`. This proves the trigger path end-to-end before any signing.

- [ ] **Step 8: Redeploy the public site with the admin allowlist**

In the public project (still linked in `.vercel/project.json`), add only `ADMIN_WALLETS=<your wallet address>` for production via `vercel env add ADMIN_WALLETS production` and redeploy with `vercel deploy --prod --yes`. Do **not** add `ADMIN_WRITES_ENABLED`. Log in at `https://weatherb-arc-testnet.vercel.app/admin/login`, confirm the `Read-only` badge, and open **Operations**: settlement `Paused`, worker runs listed as `skipped`, Markets 2 and 3 in outstanding markets with their 12:08 UTC deadlines. Try a pause toggle: button disabled; `curl -X POST …/admin/api/system/settler-pause` with the session cookie → 403.

---

### Task 13: Handover and hosted acceptance with 30-minute markets

Prerequisite: Task 12 fully green. Time budget: rotation through first hosted settlement takes about 45 minutes. If the current time is past **2026-09-21 11:00 UTC** and this task has not begun, stop and leave the heartbeat as the writer for Markets 2/3; resume with Market 4.

- [ ] **Step 1: Rotate the contract settler to the hosted key and fund it**

```sh
npm run arc:lifecycle -- rotate-settler
npm run arc:lifecycle -- fund-hosted-settler
npm run arc:lifecycle -- status
```

Expected: rotation receipt link; `settler is now hosted 0x…`; funded balance ≈ 2 USDC. From this point `npm run arc:lifecycle -- settle` refuses to run, and the local heartbeat's settlement step would revert on chain even if it fired — one writer by construction.

- [ ] **Step 2: Unpause hosted settlement**

```sh
npm run arc:hosted -- settler enable
```

Within two minutes, Operations shows a `succeeded` sweep with `pending: 2` (Markets 2 and 3 are not yet due) and per-market `settlementMessageId` populated (QStash deliveries scheduled at their `resolveTime`).

- [ ] **Step 3: Happy-path hosted settlement (hosted-test-1)**

```sh
npm run arc:lifecycle -- hosted-test 1
npm run arc:hosted -- reconcile && npm run arc:hosted -- mark-test <printed marketId>
```

Wait for `resolveTime` (30 min). Expected within the ten-minute window: a sweep or per-market run with `settled: 1`, Market row `RESOLVED`/`NO_WINNERS` with `settlementTxHash`, chain `getMarket` terminal, Operations shows no alerts and the market leaves the outstanding table. Record the receipt link, observation timestamp, outcome, and `WorkerRun.id`.

- [ ] **Step 4: Duplicate delivery (hosted-test-2)**

Create `hosted-test 2` as above. At `resolveTime + 20s`, fire two concurrent authenticated single-market requests:

```sh
for i in 1 2; do curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET .env.arc-worker | cut -d= -f2)" https://weatherb-arc-worker.vercel.app/api/markets/<id>/settle & done; wait
```

Expected: one `200` (or `503` if weather is not yet published, then a later attempt succeeds) and one `409` (busy) or `202` (in_flight); exactly **one** settlement transaction on chain; Operations shows a `busy`/`skipped` run next to the `succeeded` one.

- [ ] **Step 5: Missed-window cancellation (hosted-test-3)**

Create `hosted-test 3`. Immediately `npm run arc:hosted -- settler disable`. Operations must show `settler-paused` once the market is due and `market-overdue` once the window closes (~40 min after creation). Then `npm run arc:hosted -- settler enable`. Expected within two minutes: `cancelled: 1`, market `CANCELLED`, and the generated wallets' refunds claimable (`npm run arc:lifecycle -- claims` later returns the 0.01 USDC stakes). Alerts clear.

- [ ] **Step 6: Cancel the Codex heartbeat**

User action: cancel or disable the `start-arc-testnet-lifecycle` heartbeat in Codex. It is now redundant (the hosted worker settles Markets 2/3), and its settlement step would revert against the rotated settler anyway. Do not delete the local journal or wallets; `claims` still needs the bettor keys.

- [ ] **Step 7: Markets 2 and 3 on 2026-09-21 (no local process)**

With the Mac closed: by 12:20 UTC the per-market QStash deliveries at 12:08:23/12:08:47 or the two-minute sweep must have settled Market 2 (real Austin observation within `[12:08:23, 12:18:23]`) and Market 3 (`NO_WINNERS`, zero fee). Afterwards, from the Mac: `npm run arc:lifecycle -- claims` (generated wallets, journaled balance reconciliation) and `npm run arc:hosted -- check`. Verify chain, hosted DB, public Past Markets API, and Operations agree.

---

### Task 14: Post-acceptance verification checklist

- [ ] `npm run verify` green on the final commit.
- [ ] `curl https://weatherb-arc-testnet.vercel.app/api/health` shows `settler: "enabled"`, `worker.lastSuccessfulSweepAt` under 3 minutes old, `overdueMarkets: 0`.
- [ ] Public project env contains no `SETTLER_PRIVATE_KEY`, `CRON_SECRET`, `TOMORROW_IO_API_KEY`, `QSTASH_TOKEN`, `DIRECT_URL`, `ADMIN_WRITES_ENABLED`, `WEATHERB_WORKER_ROLE`: `vercel env ls production` in the linked public project lists only the pre-existing keys plus `ADMIN_WALLETS`.
- [ ] Worker project env contains no `DIRECT_URL`, `ADMIN_*`, `SCHEDULER_PRIVATE_KEY`.
- [ ] `git status` shows no `.env.arc-worker`, `.tools/**`, or wallet files staged; `gitleaks protect --staged` (as used before the last push) reports zero findings.
- [ ] Contract `settler()` equals the hosted address; local `.tools/arc-lifecycle/wallets.json` settler key is now inert and can be left in place for the record.

---

### Task 15: Documentation

**Files:**
- Modify: `docs/testing/arc-hosted-testnet.md`, `docs/testing/arc-testnet-lifecycle-acceptance.md`, `AGENTS.md`
- Create: `docs/memory/2026-09-21/hosted-settlement-worker-memory-2026-09-21.md`

- [ ] **Step 1: Hosted runbook** — add a "Settlement worker" section to `docs/testing/arc-hosted-testnet.md` covering: project `weatherb-arc-worker`, URL, env boundary (what it holds, what the public site never holds), the `weatherb_worker` role, QStash schedule id/cadence and per-market deliveries, `npm run arc:worker -- env-push|deploy|schedules|check`, `npm run arc:hosted -- settler enable|disable`, `mark-test`, lease/in-flight semantics (`WorkerLease`, `settlementTxHash`, 180 s grace), how to read the Operations page and alerts, and recovery steps (stale lease expires in 280 s; a stuck `in_flight` older than 180 s is resubmitted; overdue markets are cancelled automatically; if the worker is down, re-run `arc:worker -- check` and inspect QStash logs).
- [ ] **Step 2: Acceptance report** — append a "2026-09-21 — hosted settlement acceptance" section with the rotation receipt, hosted settler address, the three hosted-test market results (IDs, receipts, observation timestamps, run IDs, HTTP codes for the duplicate delivery), the Markets 2/3 outcomes and generated-wallet claims, and the explicit statement that the Codex heartbeat was cancelled and the Mac was not running during the 12:08 UTC window. Mark honestly anything that did not pass.
- [ ] **Step 3: `AGENTS.md`** — in the restart banner add: "Settlement runs from the dedicated Vercel worker `weatherb-arc-worker` triggered by QStash; the public site holds no signer. Automatic market creation remains manual pending the scheduler-role contract change (separate plan)." Update the Quick Reference cron line accordingly.
- [ ] **Step 4: Memory note** — short file summarizing decisions (separate worker project, settler rotation, QStash over Vercel cron and why, read-only admin) and the state at handoff.
- [ ] **Step 5: Commit**

```bash
git add docs AGENTS.md
git commit -m "docs: hosted settlement worker runbook, acceptance evidence, and restart notes"
```

---

## Out of scope / follow-ups (not part of this plan)

- **Automatic market creation** (`schedule-daily`) requires owner authority today. Follow-up plan: add a `scheduler` role to `WeatherMarketV2` (`createScheduledMarket` callable by owner or scheduler), Foundry tests, version bump, UUPS upgrade decision, then a QStash schedule `0 12-16 * * *` against the worker with a `SCHEDULER_PRIVATE_KEY`. Until then, run `npm run arc:lifecycle -- start` locally inside 12:00–16:59 UTC when a scheduled market is wanted; the worker will settle it.
- Push notifications (email/Slack) from alerts — the Operations page is the destination for now.
- Enabling admin writes on the hosted panel after a separate security review.
- QStash signature verification in addition to the bearer secret.
- Upstash Redis for the worker (provider-health tracking currently logs a configuration error and continues).
