# Market Settlement Schema Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add settlement tracking fields to Market model and revert incorrect Codex workarounds to enable proper real-time monitoring.

**Architecture:** Extend Prisma Market model with settlement fields (isSettled, settledAt, actualTemp, outcome), create migration, update test-runner to populate these fields on settlement, restore original SSE endpoint logic that reads real settlement data.

**Tech Stack:** Prisma, PostgreSQL, Next.js 15, TypeScript, React Server Components

---

## Background

Commit `4b0bad3` made Codex work around a schema deficiency by faking settlement data in the SSE endpoint. The Market model is missing critical fields needed for real-time monitoring. This plan:

1. Rolls back the problematic commit
2. Adds proper settlement fields to schema
3. Re-applies ONLY the good changes from Codex
4. Updates settlement logic to populate new fields
5. Restores proper SSE endpoint with real data

---

## Task 1: Revert Problematic Commit

**Files:**
- Revert: All files from commit `4b0bad3`

**Step 1: Create backup branch**

```bash
git branch backup-before-revert
```

**Step 2: Revert the commit**

```bash
git revert 4b0bad3 --no-edit
```

Expected: Creates new commit that undoes changes from 4b0bad3

**Step 3: Verify revert**

```bash
git log --oneline -3
git diff HEAD~1 HEAD --stat
```

Expected: Shows revert commit, files restored to pre-4b0bad3 state

**Step 4: Commit**

Already committed by `git revert`

---

## Task 2: Add Settlement Fields to Market Model

**Files:**
- Modify: `apps/web/prisma/schema.prisma` (Market model section)

**Step 1: Add settlement tracking fields**

Update the Market model to include:

```prisma
model Market {
  id               String   @id @default(cuid())
  contractMarketId Int // The on-chain market ID
  cityId           String
  city             City     @relation(fields: [cityId], references: [id])

  cityName         String // Denormalized for query performance
  latitude         Float
  longitude        Float
  timezone         String

  thresholdTemp    Int // Stored as tenths (85.3°F → 853)
  resolveTime      DateTime @db.Timestamptz(6)

  // Settlement tracking (NEW)
  isSettled        Boolean  @default(false)
  settledAt        DateTime? @db.Timestamptz(6)
  actualTemp       Int?     // Actual temp in tenths (same format as thresholdTemp)
  outcome          String?  // "YES" or "NO"

  isTest           Boolean  @default(false) // Filter test markets from public view
  testRunId        String?
  testRun          TestRun? @relation(fields: [testRunId], references: [id])

  createdAt        DateTime @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  @@index([isTest]) // Critical: Filter test markets from public queries
  @@index([contractMarketId])
  @@index([cityId])
  @@index([testRunId])
  @@index([resolveTime]) // For settlement cron queries
  @@index([isTest, resolveTime]) // Combined index for public market queries
  @@index([isSettled]) // NEW: For settlement queries
}
```

**Step 2: Generate migration**

```bash
cd apps/web
DATABASE_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
npx prisma migrate dev --name add_market_settlement_fields
```

Expected: Creates migration file in `prisma/migrations/`, applies to database

**Step 3: Verify migration**

```bash
DATABASE_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
npx prisma migrate status
```

Expected: Shows migration applied, no pending migrations

**Step 4: Generate Prisma Client**

```bash
npx prisma generate
```

Expected: Updates TypeScript types to include new fields

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add settlement tracking fields to Market model

- Add isSettled, settledAt, actualTemp, outcome fields
- Add index on isSettled for efficient queries
- Enables real-time settlement monitoring
- Supports test run verification"
```

---

## Task 3: Re-apply Good Changes from Codex Commit

**Files:**
- Create: `apps/web/src/components/ui/progress.tsx`
- Create: `apps/web/src/lib/db.ts`
- Modify: `apps/web/src/lib/admin-auth.ts`
- Modify: `apps/web/src/lib/email.ts`
- Modify: `apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts` (params only)
- Modify: `apps/web/src/app/api/magic/[token]/route.ts`
- Create: `apps/web/src/app/magic/magic-link-confirmation.tsx`
- Modify: `apps/web/src/app/magic/page.tsx`
- Modify: `apps/web/src/lib/test-markets.ts` (TypeScript safety only)
- Modify: `apps/web/src/lib/ai-insights.ts` (optional spreading only)

**Step 1: Create Progress component**

```typescript
// apps/web/src/components/ui/progress.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedValue)}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-neutral-200',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-neutral-900 transition-[width]"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
```

**Step 2: Create db.ts alias**

```typescript
// apps/web/src/lib/db.ts
import prisma from '@/lib/prisma';

export const db = prisma;

export default db;
```

**Step 3: Add verifyAdminWallet to admin-auth.ts**

```typescript
// apps/web/src/lib/admin-auth.ts
// Add these imports at top:
import prisma from './prisma';
import { isAdminWallet } from './admin-session';

// Add this type after AdminAuthResult:
export type AdminTokenVerification =
  | { isValid: true; wallet: string }
  | { isValid: false; error: string };

// Add this function at bottom:
/**
 * Verify an admin token (session id) for API routes that use bearer auth.
 */
export async function verifyAdminWallet(token: string): Promise<AdminTokenVerification> {
  if (!token) {
    return { isValid: false, error: 'Missing token' };
  }

  const session = await prisma.adminSession.findUnique({
    where: { id: token },
  });

  if (!session) {
    return { isValid: false, error: 'Session not found' };
  }

  if (new Date() > session.expiresAt) {
    await prisma.adminSession.delete({ where: { id: token } }).catch(() => {});
    return { isValid: false, error: 'Session expired' };
  }

  if (!isAdminWallet(session.wallet)) {
    await prisma.adminSession.delete({ where: { id: token } }).catch(() => {});
    return { isValid: false, error: 'Wallet not authorized' };
  }

  return { isValid: true, wallet: session.wallet };
}
```

**Step 4: Fix email rendering (renderAsync → render)**

```typescript
// apps/web/src/lib/email.ts
// Change import at top:
- import { renderAsync } from '@react-email/render';
+ import { render } from '@react-email/render';

// Add export:
export type { TestResultsData, WeeklySummaryData };

// In sendTestResultsEmail function:
- const html = await renderAsync(TestResultsEmail(data));
+ const html = await render(TestResultsEmail(data));

// In sendWeeklySummaryEmail function:
- const html = await renderAsync(WeeklySummaryEmail(data));
+ const html = await render(WeeklySummaryEmail(data));

// In sendEmail function:
- text: options.text,
+ ...(options.text !== undefined ? { text: options.text } : {}),
```

**Step 5: Fix Next.js 15 async params in SSE route**

```typescript
// apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts
// Update imports:
- import { NextResponse } from 'next/server';
+ import { NextRequest, NextResponse } from 'next/server';

// Update function signature:
export async function GET(
-  request: Request,
-  { params }: { params: { id: string } }
+  request: NextRequest,
+  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ... auth code ...

-    const testRunId = params.id;
+    const { id: testRunId } = await params;

    // ... rest of function unchanged ...
```

**Step 6: Fix magic link route params**

```typescript
// apps/web/src/app/api/magic/[token]/route.ts
// Update function signature:
export async function GET(
  request: Request,
-  { params }: { params: { token: string } }
+  { params }: { params: Promise<{ token: string }> }
) {
-  const token = params.token;
+  const { token } = await params;

  // ... rest unchanged ...
}
```

**Step 7: Create MagicLinkConfirmationClient component**

```typescript
// apps/web/src/app/magic/magic-link-confirmation.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';

export function MagicLinkConfirmationClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'success' | 'error' | 'loading'>('loading');
  const [message, setMessage] = useState('');
  const [action, setAction] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const messageParam = searchParams.get('message');
    const actionParam = searchParams.get('action');
    const cityParam = searchParams.get('city');

    if (statusParam === 'success') {
      setStatus('success');
      setAction(actionParam || '');
      setCity(cityParam || '');

      if (actionParam === 'approve') {
        setMessage(`Successfully approved ${cityParam || 'the city'} for production use.`);
      } else if (actionParam === 'deny') {
        setMessage(`Successfully denied ${cityParam || 'the city'}.`);
      } else {
        setMessage('Action completed successfully.');
      }
    } else if (statusParam === 'error') {
      setStatus('error');
      setMessage(messageParam || 'An error occurred processing your request.');
    } else {
      setStatus('error');
      setMessage('Invalid request.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Icon and Status */}
          <div className="flex justify-center mb-6">
            {status === 'success' ? (
              <div className="relative">
                <CheckCircle2 className="w-20 h-20 text-green-500" />
                <div className="absolute inset-0 animate-ping">
                  <CheckCircle2 className="w-20 h-20 text-green-500 opacity-30" />
                </div>
              </div>
            ) : status === 'error' ? (
              <XCircle className="w-20 h-20 text-red-500" />
            ) : (
              <AlertCircle className="w-20 h-20 text-gray-400 animate-pulse" />
            )}
          </div>

          {/* Message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === 'success' ? 'Success!' : status === 'error' ? 'Error' : 'Processing...'}
            </h1>
            <p className="text-gray-600">{message}</p>
          </div>

          {/* Actions */}
          {status === 'success' && (
            <div className="space-y-3">
              <Link
                href="/admin/suggestions"
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Go to Admin Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Return to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 8: Update magic link page to use client component**

```typescript
// apps/web/src/app/magic/page.tsx
import { Suspense } from 'react';
import { MagicLinkConfirmationClient } from './magic-link-confirmation';

export default function MagicLinkConfirmation(): React.ReactElement {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MagicLinkConfirmationClient />
    </Suspense>
  );
}
```

**Step 9: Add TypeScript safety to test-markets.ts**

```typescript
// apps/web/src/lib/test-markets.ts
// In createTestMarkets function, around line 218:
- const resolveTime = params.baseResolveTime + MARKET_SPACING_MINUTES[i] * 60;
+ const spacingMinutes = MARKET_SPACING_MINUTES[i] ?? 0;
+ const resolveTime = params.baseResolveTime + spacingMinutes * 60;

// In placeBets function, around line 358:
const market = markets[i];
+ if (!market) {
+   throw new Error('Market not found for bet placement');
+ }
const betPattern = BET_AMOUNTS[i % BET_AMOUNTS.length];

+ if (!betPattern) {
+   throw new Error('Bet pattern not available for market index');
+ }

// Around line 370:
const yesWallet = wallets[yesWalletIdx];
const noWallet = wallets[noWalletIdx];

+ if (!yesWallet || !noWallet) {
+   throw new Error('Insufficient wallets available for opposing bets');
+ }

// In verifyPayouts, around line 570, update event log decoding:
- for (const log of receipt.logs) {
-   if (log.eventName === 'WinningsClaimed') {
-     actualPayoutWei = log.args.amount as bigint;
-     break;
-   }
- }

+ for (const log of receipt.logs) {
+   try {
+     const decoded = decodeEventLog({
+       abi: WEATHER_MARKET_ABI,
+       data: log.data,
+       topics: log.topics,
+     });
+
+     if (decoded.eventName === 'WinningsClaimed') {
+       actualPayoutWei = (decoded.args as { amount: bigint }).amount;
+       break;
+     }
+   } catch {
+     // Skip non-matching logs
+   }
+ }

// Add import at top if not present:
+ import { decodeEventLog } from 'viem';

// Around line 600, update error spreading:
- error: verified ? undefined : `Payout mismatch: expected ${expectedPayout} FLR, got ${actualPayout} FLR`,
+ const errorMessage = verified
+   ? undefined
+   : `Payout mismatch: expected ${expectedPayout} FLR, got ${actualPayout} FLR`;
+
+ verifications.push({
+   // ... other fields ...
+   ...(errorMessage !== undefined ? { error: errorMessage } : {}),
+ });
```

**Step 10: Fix optional token spreading in ai-insights.ts**

```typescript
// apps/web/src/lib/ai-insights.ts
// In tryClaudeProvider function, around line 158:
return {
  success: true,
  insights,
-  tokensUsed,
+  ...(tokensUsed !== undefined ? { tokensUsed } : {}),
};

// In tryOpenAIProvider function, around line 212:
return {
  success: true,
  insights,
-  tokensUsed,
+  ...(tokensUsed !== undefined ? { tokensUsed } : {}),
};
```

**Step 11: Commit good changes**

```bash
git add apps/web/src/components/ui/progress.tsx \
  apps/web/src/lib/db.ts \
  apps/web/src/lib/admin-auth.ts \
  apps/web/src/lib/email.ts \
  apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts \
  apps/web/src/app/api/magic/[token]/route.ts \
  apps/web/src/app/magic/magic-link-confirmation.tsx \
  apps/web/src/app/magic/page.tsx \
  apps/web/src/lib/test-markets.ts \
  apps/web/src/lib/ai-insights.ts

git commit -m "refactor: apply Next.js 15 and TypeScript improvements

- Add Progress component for UI feedback
- Create db.ts alias for consistency
- Add verifyAdminWallet for bearer token auth
- Fix email rendering (renderAsync → render)
- Update route params for Next.js 15 async API
- Separate magic link client component (RSC pattern)
- Add TypeScript null checks in test-markets
- Fix optional token spreading in ai-insights

These changes improve Next.js 15 compatibility and type safety
without compromising the monitoring dashboard functionality."
```

---

## Task 4: Update Test Runner to Populate Settlement Fields

**Files:**
- Modify: `apps/web/src/lib/test-runner.ts`

**Step 1: Update settlement logic in monitorTestRun**

Find the section in `monitorTestRun` where markets are checked for settlement and update to populate the new fields:

```typescript
// apps/web/src/lib/test-runner.ts
// In monitorTestRun function, where settlement is detected:

// After detecting a market has settled, update it in the database:
for (const market of markets) {
  // Fetch on-chain market data
  const onChainMarket = await contract.read.markets([market.contractMarketId]);

  // Check if settled
  if (onChainMarket.isSettled && !market.isSettled) {
    // Fetch actual temperature from weather provider
    const actualTempF = await weatherProvider.getActualTemperature(
      market.latitude,
      market.longitude,
      market.resolveTime
    );

    // Convert to tenths
    const actualTempTenths = Math.round(actualTempF * 10);

    // Determine outcome (YES if actual >= threshold, NO otherwise)
    const outcome = actualTempTenths >= market.thresholdTemp ? 'YES' : 'NO';

    // Update market in database
    await db.market.update({
      where: { id: market.id },
      data: {
        isSettled: true,
        settledAt: new Date(),
        actualTemp: actualTempTenths,
        outcome,
      },
    });

    console.log(`[TestRunner] Market ${market.id} settled: ${outcome} (actual: ${actualTempF}°F, threshold: ${market.thresholdTemp / 10}°F)`);
  }
}
```

**Step 2: Update settledCount calculation**

Update the logic that counts settled markets to use the database field:

```typescript
// In monitorTestRun, update settled count:
const settledMarkets = await db.market.count({
  where: {
    testRunId,
    isSettled: true,
  },
});

await db.testRun.update({
  where: { id: testRunId },
  data: { marketsSettled: settledMarkets },
});
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/test-runner.ts
git commit -m "feat: populate Market settlement fields in test runner

- Update monitorTestRun to set isSettled, settledAt, actualTemp, outcome
- Fetch actual temperature from weather provider on settlement
- Calculate outcome based on threshold comparison
- Count settled markets from database field
- Enables real-time monitoring with accurate settlement data"
```

---

## Task 5: Restore Original SSE Endpoint Logic

**Files:**
- Modify: `apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts`

**Step 1: Restore proper market field selection**

Update the market selection to use the real settlement fields:

```typescript
// apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts
// In the testRun query:

const testRun = await db.testRun.findUnique({
  where: { id: testRunId },
  include: {
    markets: {
      select: {
        id: true,
        resolveTime: true,
        isSettled: true,      // ✅ Real field
        settledAt: true,       // ✅ Real field
        outcome: true,         // ✅ Real field
        cityName: true,        // ✅ Real field
        thresholdTemp: true,   // ✅ Real field
        actualTemp: true,      // ✅ Real field
        createdAt: true,
      },
      orderBy: {
        resolveTime: 'asc',  // Sort by resolve time
      },
    },
    suggestion: {
      select: {
        id: true,
        customCityName: true,
        latitude: true,
        longitude: true,
      },
    },
  },
});
```

**Step 2: Map markets with real data**

```typescript
// Update the data mapping:
const data = {
  id: testRun.id,
  status: testRun.status,
  createdAt: testRun.createdAt.toISOString(),
  completedAt: testRun.completedAt?.toISOString(),
  marketsCreated: testRun.marketsCreated,
  marketsSettled: testRun.marketsSettled,
  fundingAmount: testRun.fundingAmount.toString(),
  recoveredAmount: testRun.recoveredAmount?.toString(),
  netCost: testRun.netCost?.toString(),
  cityName: testRun.suggestion.customCityName,
  markets: testRun.markets.map(m => ({
    id: m.id,
    resolveTime: m.resolveTime.toISOString(),
    isSettled: m.isSettled,                              // ✅ Real data
    outcome: m.outcome,                                   // ✅ Real data
    city: m.cityName,
    threshold: Math.round(m.thresholdTemp / 10),         // Convert tenths to whole degrees
    actualTemp: m.actualTemp ? Math.round(m.actualTemp / 10) : undefined, // ✅ Real data
    settledAt: m.settledAt?.toISOString(),               // ✅ Real data
    createdAt: m.createdAt.toISOString(),
  })),
};
```

**Step 3: Test the endpoint compiles**

```bash
cd apps/web
pnpm exec tsc --noEmit
```

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts
git commit -m "fix: restore real settlement data in SSE endpoint

- Use real isSettled, outcome, actualTemp fields from Market model
- Remove fake settlement logic based on index
- Sort markets by resolveTime for consistent ordering
- Convert temperature tenths to whole degrees for display
- Enables accurate real-time monitoring of test progress"
```

---

## Task 6: Update TypeScript Types in useTestRunStream Hook

**Files:**
- Modify: `apps/web/src/hooks/useTestRunStream.ts`

**Step 1: Add actualTemp and settledAt to TestRunMarket interface**

```typescript
// apps/web/src/hooks/useTestRunStream.ts

export interface TestRunMarket {
  id: string;
  resolveTime: string;
  isSettled: boolean;
  outcome: 'YES' | 'NO' | null;
  city: string;
  threshold: number;
  actualTemp?: number;        // NEW
  settledAt?: string;          // NEW
  createdAt: string;
}
```

**Step 2: Verify hook still works**

No code changes needed in hook logic - just the type update.

**Step 3: Commit**

```bash
git add apps/web/src/hooks/useTestRunStream.ts
git commit -m "feat: add settlement fields to TestRunMarket interface

- Add actualTemp and settledAt fields
- Matches updated SSE endpoint data structure
- Enables UI to display actual temperatures and settlement times"
```

---

## Task 7: Update TestRunMonitor Component

**Files:**
- Modify: `apps/web/src/components/admin/test-run-monitor.tsx`

**Step 1: Display actual temperature in MarketCard**

Update the MarketCard component to show actual temperature when settled:

```typescript
// In MarketCard component, update the threshold info section:

{/* Threshold Info (when settled) */}
{market.isSettled && (
  <div className="mt-3 pt-3 border-t text-xs space-y-1">
    <div className="flex items-center justify-between text-neutral-600">
      <span>Threshold:</span>
      <span className="font-mono">{market.threshold}°F</span>
    </div>
    {market.actualTemp !== undefined && (
      <div className="flex items-center justify-between text-neutral-600">
        <span>Actual:</span>
        <span className="font-mono font-semibold">{market.actualTemp}°F</span>
      </div>
    )}
    {market.settledAt && (
      <div className="flex items-center justify-between text-neutral-500 text-xs">
        <span>Settled:</span>
        <span>{new Date(market.settledAt).toLocaleTimeString()}</span>
      </div>
    )}
  </div>
)}
```

**Step 2: Test the component compiles**

```bash
cd apps/web
pnpm exec tsc --noEmit
```

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add apps/web/src/components/admin/test-run-monitor.tsx
git commit -m "feat: display actual temperature in test monitoring

- Show threshold vs actual temperature comparison
- Display settlement timestamp for completed markets
- Provides transparency for settlement accuracy verification"
```

---

## Task 8: Integration Testing

**Files:**
- Test: Full test run flow

**Step 1: Start development server**

```bash
cd apps/web
pnpm dev
```

Expected: Server starts on http://localhost:3000

**Step 2: Navigate to admin suggestions page**

Open: http://localhost:3000/admin/suggestions

Expected: Page loads, tabs visible

**Step 3: Approve a test city suggestion**

1. Click "Approve" on a pending suggestion
2. Verify test run starts
3. Navigate to Testing tab
4. Verify TestRunMonitor component renders

Expected:
- Monitor shows 0/5 markets settled initially
- Connection indicator green and pulsing
- Markets show as pending

**Step 4: Monitor settlement progression**

Wait for markets to resolve (or manually trigger settlement via cron):

```bash
curl http://localhost:3000/api/cron/monitor-test-runs \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Markets transition from pending to settled
- Progress bar updates
- Actual temperatures display
- YES/NO outcomes show correctly

**Step 5: Verify database state**

```bash
psql "postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  -c "SELECT id, isSettled, outcome, actualTemp, thresholdTemp FROM \"Market\" WHERE \"isTest\" = true ORDER BY \"createdAt\" DESC LIMIT 5;"
```

Expected: Shows settlement fields populated correctly

**Step 6: No commit** (testing step)

---

## Task 9: Update Documentation

**Files:**
- Create: `docs/epic-8-settlement-schema-fix.md`

**Step 1: Document the changes**

```markdown
# Epic 8 Settlement Schema Fix

**Date**: 2025-01-28
**Status**: Complete

## Problem

The original Market schema was missing settlement tracking fields, causing the SSE monitoring endpoint to fake settlement data based on market count rather than actual on-chain settlement status.

## Solution

Added proper settlement fields to Market model:
- `isSettled: Boolean` - Settlement status
- `settledAt: DateTime?` - When settlement occurred
- `actualTemp: Int?` - Actual temperature in tenths
- `outcome: String?` - "YES" or "NO"

## Changes

### Database Schema
- Added 4 new fields to Market model
- Added index on `isSettled` for efficient queries
- Migration: `add_market_settlement_fields`

### Settlement Logic
- Updated `test-runner.ts` to populate fields on settlement
- Fetches actual temperature from weather provider
- Calculates outcome based on threshold comparison

### SSE Endpoint
- Restored real data queries (removed fake index-based logic)
- Returns actual settlement status, outcomes, temperatures
- Sorted markets by resolveTime for consistency

### UI Components
- Added actual temperature display
- Show settlement timestamps
- Threshold vs actual comparison

## Testing

Verified:
- Migration applies cleanly
- Settlement fields populate correctly
- SSE stream sends real data
- UI displays accurate settlement info
- Progress tracking works in real-time

## Benefits

- ✅ Accurate real-time monitoring
- ✅ Per-market settlement visibility
- ✅ Transparent outcome verification
- ✅ No fake data workarounds
- ✅ Production-ready settlement tracking
```

**Step 2: Commit**

```bash
git add docs/epic-8-settlement-schema-fix.md
git commit -m "docs: document Market settlement schema fix

Explains problem, solution, changes, and benefits of adding
proper settlement tracking fields to enable real-time monitoring."
```

---

## Task 10: Final Verification and Cleanup

**Files:**
- Verify: All changes

**Step 1: Run full type check**

```bash
cd apps/web
pnpm exec tsc --noEmit
```

Expected: No errors

**Step 2: Run database migrations check**

```bash
DATABASE_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true" \
DIRECT_URL="postgresql://postgres.zgyzypyketbzhclzewcs:Vivalasllamas777!@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
npx prisma migrate status
```

Expected: All migrations applied, none pending

**Step 3: Verify git history is clean**

```bash
git log --oneline -10
```

Expected: Shows clear progression of commits

**Step 4: Delete backup branch (optional)**

```bash
git branch -d backup-before-revert
```

Expected: Branch deleted (or keep for safety)

**Step 5: Push to remote**

```bash
git push origin master
```

Expected: Pushes all commits to remote repository

**Step 6: No commit** (verification step)

---

## Summary

This plan:
1. ✅ Reverts the problematic Codex commit
2. ✅ Adds proper settlement fields to Market model
3. ✅ Re-applies ONLY the good Next.js 15 and TypeScript fixes
4. ✅ Updates test runner to populate settlement data
5. ✅ Restores SSE endpoint with real settlement queries
6. ✅ Enhances UI to display actual temperatures and outcomes
7. ✅ Documents all changes for future reference

**Result**: Real-time monitoring dashboard with accurate settlement tracking, no fake data, production-ready.

---

## Acceptance Criteria

- [ ] Market model has isSettled, settledAt, actualTemp, outcome fields
- [ ] Migration applies cleanly to production database
- [ ] Test runner populates settlement fields on settlement
- [ ] SSE endpoint queries real settlement data (no faking)
- [ ] UI displays actual temperatures and settlement times
- [ ] Progress tracking works accurately in real-time
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Documentation complete

---

## Estimated Time

- Task 1 (Revert): 5 minutes
- Task 2 (Schema): 10 minutes
- Task 3 (Re-apply good changes): 30 minutes
- Task 4 (Test runner): 20 minutes
- Task 5 (SSE endpoint): 15 minutes
- Task 6 (Hook types): 5 minutes
- Task 7 (UI update): 10 minutes
- Task 8 (Integration testing): 20 minutes
- Task 9 (Documentation): 10 minutes
- Task 10 (Verification): 10 minutes

**Total**: ~2 hours
