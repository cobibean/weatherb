# Epic 8: AI-Powered City Approval Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build automated city testing system with AI-powered weekly reports for confident city approval decisions

**Architecture:** Admin panel triggers 4-hour test windows with real on-chain markets, dynamic wallet generation, and payout verification. Weekly emails provide AI insights and metrics. Test markets remain hidden from public view.

**Tech Stack:** Next.js, Prisma, Vercel Cron, Resend emails, Claude Sonnet API, ethers.js

**Model Note:** Implementation tasks should be executed using Sonnet 4.5 model for optimal performance on coding tasks.

---

## Phase 1: Database & Admin Panel

### Task 1: Database Schema Updates

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/[timestamp]_add_test_markets/migration.sql`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/test-markets.test.ts
import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Test Market Schema', () => {
  it('should create a test run with linked markets', async () => {
    const testRun = await prisma.testRun.create({
      data: {
        suggestionId: 'test-suggestion-id',
        fundingAmount: 25.0,
        marketsCreated: 3
      }
    });

    expect(testRun.status).toBe('RUNNING');
    expect(testRun.keysDisposed).toBe(false);
  });

  it('should filter test markets from public queries', async () => {
    const publicMarkets = await prisma.market.findMany({
      where: { isTest: false }
    });

    const testMarkets = await prisma.market.findMany({
      where: { isTest: true }
    });

    expect(publicMarkets).not.toContainEqual(
      expect.objectContaining({ isTest: true })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/test-markets.test.ts`
Expected: FAIL with "Unknown arg `isTest`" and "Invalid model name `testRun`"

**Step 3: Update schema.prisma**

```prisma
// Add to apps/web/prisma/schema.prisma

// Add to existing Market model (if exists, otherwise create)
model Market {
  id           String    @id @default(cuid())
  marketId     String    @unique // On-chain market ID
  city         String
  latitude     Float
  longitude    Float
  threshold    Int       // Temperature in tenths (e.g., 853 = 85.3°F)
  resolveTime  DateTime
  isTest       Boolean   @default(false)  // Hide from frontend
  testRunId    String?                    // Link to test run
  testRun      TestRun?  @relation(fields: [testRunId], references: [id])
  createdAt    DateTime  @default(now())
  settledAt    DateTime?
  outcome      String?   // "YES" or "NO"
  actualTemp   Int?      // Actual temperature in tenths

  @@index([isTest])  // Fast filtering
  @@index([resolveTime])
  @@index([testRunId])
}

model TestRun {
  id              String      @id @default(cuid())
  suggestionId    String
  suggestion      Suggestion  @relation(fields: [suggestionId], references: [id])
  status          TestStatus  @default(RUNNING)
  createdAt       DateTime    @default(now())
  completedAt     DateTime?

  // Market tracking
  marketsCreated  Int         @default(0)
  marketsSettled  Int         @default(0)
  markets         Market[]

  // Financial tracking
  fundingAmount   Decimal     @db.Decimal(10, 2)  // Initial FLR sent
  recoveredAmount Decimal?    @db.Decimal(10, 2)  // FLR swept back
  netCost         Decimal?    @db.Decimal(10, 2)  // Gas + fees

  // Wallet management (encrypted)
  walletKeys      String?     @db.Text  // JSON: [{ address, privateKey }]
  keysDisposed    Boolean     @default(false)

  // Results storage
  results         Json?       // Detailed test results

  @@index([suggestionId])
  @@index([status])
}

enum TestStatus {
  RUNNING
  COMPLETED
  FAILED
}

// Update existing Suggestion model
model Suggestion {
  // ... existing fields ...
  testRuns    TestRun[]
}
```

**Step 4: Create and run migration**

Run: `pnpm prisma migrate dev --name add_test_markets`
Expected: Migration created and applied successfully

**Step 5: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/test-markets.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/src/lib/__tests__/test-markets.test.ts
git commit -m "feat(epic8): add test market schema and TestRun model"
```

---

### Task 2: Admin Panel UI - Tabbed Interface

**Files:**
- Create: `apps/web/src/app/admin/suggestions/page.tsx`
- Create: `apps/web/src/components/admin/suggestions-tabs.tsx`
- Create: `apps/web/src/lib/admin-suggestions.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/admin/suggestions/__tests__/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SuggestionsPage from '../page';

describe('Admin Suggestions Page', () => {
  it('should render all four tabs', async () => {
    render(await SuggestionsPage());

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/app/admin/suggestions/__tests__/page.test.tsx`
Expected: FAIL with "Cannot find module '../page'"

**Step 3: Create suggestions page component**

```tsx
// apps/web/src/app/admin/suggestions/page.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLayout } from '@/components/admin/layout';
import { SuggestionsTabs } from '@/components/admin/suggestions-tabs';
import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SuggestionsPage() {
  const session = await getServerSession();

  if (!session?.isAdmin) {
    redirect('/admin');
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">City Suggestions</h1>
        <SuggestionsTabs />
      </div>
    </AdminLayout>
  );
}
```

**Step 4: Create tabs component**

```tsx
// apps/web/src/components/admin/suggestions-tabs.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { SuggestionWithVotes } from '@/types/suggestions';
import { approveSuggestion, denySuggestion, getAdminSuggestions } from '@/lib/admin-suggestions';

export function SuggestionsTabs() {
  const [suggestions, setSuggestions] = useState<{
    pending: SuggestionWithVotes[];
    testing: SuggestionWithVotes[];
    live: SuggestionWithVotes[];
    rejected: SuggestionWithVotes[];
  }>({
    pending: [],
    testing: [],
    live: [],
    rejected: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    try {
      const data = await getAdminSuggestions();
      setSuggestions(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(suggestionId: string) {
    await approveSuggestion(suggestionId);
    await loadSuggestions();
  }

  async function handleDeny(suggestionId: string) {
    await denySuggestion(suggestionId);
    await loadSuggestions();
  }

  return (
    <Tabs defaultValue="pending" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="pending">
          Pending {suggestions.pending.length > 0 && (
            <Badge className="ml-2">{suggestions.pending.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="testing">
          Testing {suggestions.testing.length > 0 && (
            <Badge className="ml-2">{suggestions.testing.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="live">Live</TabsTrigger>
        <TabsTrigger value="rejected">Rejected</TabsTrigger>
      </TabsList>

      <TabsContent value="pending">
        <PendingTab
          suggestions={suggestions.pending}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      </TabsContent>

      <TabsContent value="testing">
        <TestingTab suggestions={suggestions.testing} />
      </TabsContent>

      <TabsContent value="live">
        <LiveTab suggestions={suggestions.live} />
      </TabsContent>

      <TabsContent value="rejected">
        <RejectedTab suggestions={suggestions.rejected} />
      </TabsContent>
    </Tabs>
  );
}

function PendingTab({ suggestions, onApprove, onDeny }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Total Votes</TableHead>
          <TableHead>Recent Votes (7d)</TableHead>
          <TableHead>Time Preference</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              {s.cityId ? s.city.name : s.customCityName}
              {s.latitude && ` (${s.latitude}, ${s.longitude})`}
            </TableCell>
            <TableCell>{s.voteCount}</TableCell>
            <TableCell>
              {s.recentVoteCount}
              {s.recentVoteCount > s.voteCount * 0.3 && (
                <Badge className="ml-2" variant="secondary">Trending</Badge>
              )}
            </TableCell>
            <TableCell>{s.timeWindow || 'Any'}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onApprove(s.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDeny(s.id)}
                >
                  Deny
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TestingTab({ suggestions }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Markets Status</TableHead>
          <TableHead>Est. Completion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((s) => {
          const testRun = s.testRuns?.[0]; // Latest test run
          return (
            <TableRow key={s.id}>
              <TableCell>
                {s.cityId ? s.city.name : s.customCityName}
              </TableCell>
              <TableCell>
                {testRun?.createdAt ? new Date(testRun.createdAt).toLocaleString() : '-'}
              </TableCell>
              <TableCell>
                {testRun ? `${testRun.marketsSettled}/${testRun.marketsCreated} settled` : '-'}
              </TableCell>
              <TableCell>
                {testRun ? new Date(testRun.createdAt.getTime() + 4 * 60 * 60 * 1000).toLocaleTimeString() : '-'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LiveTab({ suggestions }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Total Votes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              {s.cityId ? s.city.name : s.customCityName}
            </TableCell>
            <TableCell>
              {new Date(s.updatedAt).toLocaleDateString()}
            </TableCell>
            <TableCell>{s.voteCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RejectedTab({ suggestions }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>City</TableHead>
          <TableHead>Rejected Date</TableHead>
          <TableHead>Votes at Rejection</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suggestions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              {s.cityId ? s.city.name : s.customCityName}
            </TableCell>
            <TableCell>
              {new Date(s.updatedAt).toLocaleDateString()}
            </TableCell>
            <TableCell>{s.voteCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test apps/web/src/app/admin/suggestions/__tests__/page.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/app/admin/suggestions/ apps/web/src/components/admin/suggestions-tabs.tsx
git commit -m "feat(epic8): add admin suggestions page with tabbed interface"
```

---

### Task 3: Admin API Routes

**Files:**
- Create: `apps/web/src/app/api/admin/suggestions/approve/route.ts`
- Create: `apps/web/src/app/api/admin/suggestions/deny/route.ts`
- Create: `apps/web/src/lib/admin-suggestions.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/api/admin/suggestions/__tests__/routes.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST as approveRoute } from '../approve/route';
import { POST as denyRoute } from '../deny/route';

describe('Admin Suggestions API', () => {
  it('should start test window on approval', async () => {
    const mockStartTestWindow = vi.fn().mockResolvedValue({ id: 'test-run-123' });

    const request = new Request('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({ suggestionId: 'suggestion-123' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await approveRoute(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.testRunId).toBe('test-run-123');
  });

  it('should update status on deny', async () => {
    const request = new Request('http://localhost:3000', {
      method: 'POST',
      body: JSON.stringify({ suggestionId: 'suggestion-456' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await denyRoute(request);

    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/app/api/admin/suggestions/__tests__/routes.test.ts`
Expected: FAIL with "Cannot find module '../approve/route'"

**Step 3: Create approve route**

```typescript
// apps/web/src/app/api/admin/suggestions/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { startTestWindow } from '@/lib/test-runner';
import { logAdminAction } from '@/lib/admin-log';

const approveSchema = z.object({
  suggestionId: z.string().cuid()
});

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminWallet = await verifyAdminAuth(request);
    if (!adminWallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { suggestionId } = approveSchema.parse(body);

    // Check suggestion exists and is pending
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: { testRuns: { where: { status: 'RUNNING' } } }
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    if (suggestion.status !== 'PENDING') {
      return NextResponse.json({
        error: `Cannot approve suggestion with status ${suggestion.status}`
      }, { status: 400 });
    }

    if (suggestion.testRuns.length > 0) {
      return NextResponse.json({
        error: 'Test already running for this suggestion'
      }, { status: 400 });
    }

    // Start test window (creates TestRun, generates wallets, creates markets)
    const testRun = await startTestWindow(suggestionId);

    // Log admin action
    await logAdminAction({
      wallet: adminWallet,
      action: 'APPROVE_SUGGESTION',
      details: { suggestionId, testRunId: testRun.id }
    });

    return NextResponse.json({
      success: true,
      testRunId: testRun.id,
      message: 'Test window started. Results will be emailed in ~4 hours.'
    });
  } catch (error) {
    console.error('Error approving suggestion:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to approve suggestion'
    }, { status: 500 });
  }
}
```

**Step 4: Create deny route**

```typescript
// apps/web/src/app/api/admin/suggestions/deny/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-log';

const denySchema = z.object({
  suggestionId: z.string().cuid()
});

export async function POST(request: NextRequest) {
  try {
    const adminWallet = await verifyAdminAuth(request);
    if (!adminWallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { suggestionId } = denySchema.parse(body);

    // Update suggestion status
    const suggestion = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'REJECTED' }
    });

    // Log admin action
    await logAdminAction({
      wallet: adminWallet,
      action: 'DENY_SUGGESTION',
      details: { suggestionId }
    });

    return NextResponse.json({
      success: true,
      message: `Suggestion for ${suggestion.customCityName || 'city'} has been rejected`
    });
  } catch (error) {
    console.error('Error denying suggestion:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to deny suggestion'
    }, { status: 500 });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test apps/web/src/app/api/admin/suggestions/__tests__/routes.test.ts`
Expected: PASS (with mocked dependencies)

**Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/suggestions/
git commit -m "feat(epic8): add admin approval/deny API routes"
```

---

### Task 4: Filter Test Markets from Public Queries

**Files:**
- Modify: `apps/web/src/lib/markets.ts`
- Modify: `apps/web/src/app/api/markets/route.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/markets-filter.test.ts
import { describe, it, expect } from 'vitest';
import { getPublicMarkets } from '@/lib/markets';
import { prisma } from '@/lib/prisma';

describe('Market Filtering', () => {
  it('should exclude test markets from public queries', async () => {
    // Create test market
    await prisma.market.create({
      data: {
        marketId: 'test-market-1',
        city: 'Test City',
        latitude: 0,
        longitude: 0,
        threshold: 750,
        resolveTime: new Date(Date.now() + 3600000),
        isTest: true
      }
    });

    // Create real market
    await prisma.market.create({
      data: {
        marketId: 'real-market-1',
        city: 'Real City',
        latitude: 0,
        longitude: 0,
        threshold: 750,
        resolveTime: new Date(Date.now() + 3600000),
        isTest: false
      }
    });

    const markets = await getPublicMarkets();

    expect(markets).not.toContainEqual(
      expect.objectContaining({ marketId: 'test-market-1' })
    );
    expect(markets).toContainEqual(
      expect.objectContaining({ marketId: 'real-market-1' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/markets-filter.test.ts`
Expected: FAIL - test markets still visible

**Step 3: Update markets library**

```typescript
// apps/web/src/lib/markets.ts
import { prisma } from '@/lib/prisma';

export async function getPublicMarkets(options?: {
  status?: 'active' | 'resolved';
  limit?: number;
}) {
  return await prisma.market.findMany({
    where: {
      isTest: false, // Always filter out test markets
      ...(options?.status === 'active' && {
        resolveTime: { gt: new Date() },
        settledAt: null
      }),
      ...(options?.status === 'resolved' && {
        settledAt: { not: null }
      })
    },
    orderBy: { resolveTime: 'asc' },
    take: options?.limit
  });
}

export async function getMarketById(marketId: string, includeTest = false) {
  return await prisma.market.findFirst({
    where: {
      marketId,
      ...(includeTest ? {} : { isTest: false })
    }
  });
}
```

**Step 4: Update API route**

```typescript
// Modify apps/web/src/app/api/markets/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as 'active' | 'resolved' | null;

  const markets = await getPublicMarkets({
    status: status || undefined
  });

  return NextResponse.json(markets);
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/markets-filter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/lib/markets.ts apps/web/src/app/api/markets/route.ts
git commit -m "feat(epic8): filter test markets from public queries"
```

---

## Phase 2: Test Window Core

### Task 5: Test Wallet Generation and Management

**Files:**
- Create: `apps/web/src/lib/test-wallets.ts`
- Create: `apps/web/src/lib/__tests__/test-wallets.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/test-wallets.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateTestWallets,
  encryptWalletKeys,
  decryptWalletKeys,
  fundWallets,
  sweepWallets
} from '@/lib/test-wallets';
import { ethers } from 'ethers';

describe('Test Wallet Management', () => {
  it('should generate unique wallets', () => {
    const wallets = generateTestWallets(2);

    expect(wallets).toHaveLength(2);
    expect(wallets[0].address).not.toBe(wallets[1].address);
    expect(ethers.utils.isAddress(wallets[0].address)).toBe(true);
  });

  it('should encrypt and decrypt wallet keys', () => {
    const wallets = generateTestWallets(2);
    const encrypted = encryptWalletKeys(wallets);
    const decrypted = decryptWalletKeys(encrypted);

    expect(decrypted[0].address).toBe(wallets[0].address);
    expect(decrypted[0].privateKey).toBe(wallets[0].privateKey);
  });

  it('should fund wallets from admin wallet', async () => {
    const wallets = generateTestWallets(2);
    const txHashes = await fundWallets(wallets, '10.0');

    expect(txHashes).toHaveLength(2);
    expect(txHashes[0]).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should sweep wallets back to admin', async () => {
    const wallets = generateTestWallets(2);
    const result = await sweepWallets(wallets, process.env.ADMIN_WALLET_ADDRESS!);

    expect(result.success).toBe(true);
    expect(result.totalRecovered).toBeGreaterThan(0);
    expect(result.transactions).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/test-wallets.test.ts`
Expected: FAIL with "Cannot find module '@/lib/test-wallets'"

**Step 3: Implement test wallets module**

```typescript
// apps/web/src/lib/test-wallets.ts
import { ethers } from 'ethers';
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

export interface TestWallet {
  address: string;
  privateKey: string;
}

export interface SweepResult {
  success: boolean;
  totalRecovered: number;
  transactions: string[];
  errors?: string[];
}

// Generate fresh wallets for testing
export function generateTestWallets(count: number): TestWallet[] {
  const wallets: TestWallet[] = [];

  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey
    });
  }

  return wallets;
}

// Encrypt wallet keys for storage
export function encryptWalletKeys(wallets: TestWallet[]): string {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error('MAGIC_LINK_SECRET not configured');
  }

  const key = crypto.scryptSync(secret, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const data = JSON.stringify(wallets);
  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted.toString('hex')
  });
}

// Decrypt wallet keys
export function decryptWalletKeys(encryptedData: string): TestWallet[] {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error('MAGIC_LINK_SECRET not configured');
  }

  const { iv, authTag, encrypted } = JSON.parse(encryptedData);
  const key = crypto.scryptSync(secret, 'salt', 32);

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

// Fund wallets from admin wallet
export async function fundWallets(
  wallets: TestWallet[],
  amountPerWallet: string
): Promise<string[]> {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY!, provider);

  const txHashes: string[] = [];
  const amount = ethers.utils.parseEther(amountPerWallet);

  for (const wallet of wallets) {
    const tx = await adminWallet.sendTransaction({
      to: wallet.address,
      value: amount
    });

    await tx.wait(1); // Wait for 1 confirmation
    txHashes.push(tx.hash);

    console.log(`Funded ${wallet.address} with ${amountPerWallet} FLR: ${tx.hash}`);
  }

  return txHashes;
}

// Sweep all funds back to admin wallet
export async function sweepWallets(
  wallets: TestWallet[],
  toAddress: string
): Promise<SweepResult> {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const transactions: string[] = [];
  const errors: string[] = [];
  let totalRecovered = ethers.BigNumber.from(0);

  for (const walletData of wallets) {
    try {
      const wallet = new ethers.Wallet(walletData.privateKey, provider);
      const balance = await wallet.getBalance();

      if (balance.gt(0)) {
        // Calculate gas for transfer
        const gasPrice = await provider.getGasPrice();
        const gasLimit = 21000; // Standard transfer
        const gasCost = gasPrice.mul(gasLimit);

        // Send remaining balance minus gas
        const valueToSend = balance.sub(gasCost);

        if (valueToSend.gt(0)) {
          const tx = await wallet.sendTransaction({
            to: toAddress,
            value: valueToSend,
            gasLimit,
            gasPrice
          });

          await tx.wait(3); // Wait for 3 confirmations
          transactions.push(tx.hash);
          totalRecovered = totalRecovered.add(valueToSend);

          console.log(`Swept ${ethers.utils.formatEther(valueToSend)} FLR from ${wallet.address}: ${tx.hash}`);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to sweep ${walletData.address}: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    success: errors.length === 0,
    totalRecovered: parseFloat(ethers.utils.formatEther(totalRecovered)),
    transactions,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/test-wallets.test.ts`
Expected: PASS (with mocked RPC calls)

**Step 5: Commit**

```bash
git add apps/web/src/lib/test-wallets.ts apps/web/src/lib/__tests__/test-wallets.test.ts
git commit -m "feat(epic8): implement test wallet generation and management"
```

---

### Task 6: Test Market Creation and Betting

**Files:**
- Create: `apps/web/src/lib/test-markets.ts`
- Create: `apps/web/src/lib/__tests__/test-markets-creation.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/test-markets-creation.test.ts
import { describe, it, expect } from 'vitest';
import {
  createTestMarkets,
  placeBets,
  verifyPayouts
} from '@/lib/test-markets';
import { generateTestWallets } from '@/lib/test-wallets';

describe('Test Market Creation', () => {
  it('should create multiple test markets with staggered resolve times', async () => {
    const markets = await createTestMarkets({
      city: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      count: 5,
      testRunId: 'test-run-123'
    });

    expect(markets).toHaveLength(5);
    expect(markets[0].isTest).toBe(true);
    expect(markets[0].testRunId).toBe('test-run-123');

    // Check staggered times
    const times = markets.map(m => m.resolveTime.getTime());
    expect(times[1] - times[0]).toBeGreaterThan(30 * 60 * 1000); // 30+ minutes apart
  });

  it('should place opposing bets on test markets', async () => {
    const wallets = generateTestWallets(2);
    const markets = await createTestMarkets({
      city: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      count: 3,
      testRunId: 'test-run-123'
    });

    const betResults = await placeBets(markets, wallets);

    expect(betResults).toHaveLength(3);
    expect(betResults[0].yesBet.wallet).toBe(wallets[0].address);
    expect(betResults[0].noBet.wallet).toBe(wallets[1].address);
    expect(betResults[0].yesBet.amount).not.toBe(betResults[0].noBet.amount);
  });

  it('should verify payouts match expected calculations', async () => {
    const wallets = generateTestWallets(2);
    const markets = [/* ... settled markets ... */];

    const verifications = await verifyPayouts(markets, wallets);

    expect(verifications[0].payoutMatches).toBe(true);
    expect(verifications[0].discrepancy).toBeLessThan(0.001);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/test-markets-creation.test.ts`
Expected: FAIL with "Cannot find module '@/lib/test-markets'"

**Step 3: Implement test markets module**

```typescript
// apps/web/src/lib/test-markets.ts
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { TestWallet } from './test-wallets';
import { getWeatherForecast } from '@/lib/weather';
import WeatherMarketABI from '@weatherb/shared/abi/weather-market';

export interface TestMarketParams {
  city: string;
  latitude: number;
  longitude: number;
  count: number;
  testRunId: string;
}

export interface BetResult {
  marketId: string;
  yesBet: {
    wallet: string;
    amount: string;
    txHash: string;
  };
  noBet: {
    wallet: string;
    amount: string;
    txHash: string;
  };
}

export interface PayoutVerification {
  marketId: string;
  outcome: 'YES' | 'NO';
  expectedPayout: number;
  actualPayout: number;
  payoutMatches: boolean;
  discrepancy: number;
}

// Create test markets with staggered resolve times
export async function createTestMarkets(params: TestMarketParams) {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const scheduler = new ethers.Wallet(process.env.SCHEDULER_PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
    WeatherMarketABI,
    scheduler
  );

  const markets = [];
  const baseTime = Date.now();

  // Staggered times: +30min, +1hr, +2hr, +3hr, +4hr
  const intervals = [30, 60, 120, 180, 240];

  for (let i = 0; i < params.count; i++) {
    const resolveTime = new Date(baseTime + intervals[i] * 60 * 1000);

    // Get forecast for this time
    const forecast = await getWeatherForecast({
      latitude: params.latitude,
      longitude: params.longitude,
      targetTime: resolveTime
    });

    // Create market on-chain
    const tx = await contract.createMarket(
      params.city,
      Math.round(params.latitude * 1e6),  // Convert to microdegrees
      Math.round(params.longitude * 1e6),
      Math.round(forecast.temperature * 10), // Convert to tenths
      Math.floor(resolveTime.getTime() / 1000) // Unix timestamp
    );

    const receipt = await tx.wait();
    const event = receipt.events?.find(e => e.event === 'MarketCreated');
    const marketId = event?.args?.marketId;

    // Save to database with isTest flag
    const market = await prisma.market.create({
      data: {
        marketId,
        city: params.city,
        latitude: params.latitude,
        longitude: params.longitude,
        threshold: Math.round(forecast.temperature * 10),
        resolveTime,
        isTest: true,
        testRunId: params.testRunId
      }
    });

    markets.push(market);
    console.log(`Created test market ${marketId} for ${params.city} at ${resolveTime.toISOString()}`);
  }

  return markets;
}

// Place opposing bets with unequal amounts
export async function placeBets(markets: any[], wallets: TestWallet[]): Promise<BetResult[]> {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const results: BetResult[] = [];

  // Bet amounts pattern (in FLR)
  const betAmounts = [
    { yes: '0.9', no: '1.8' },
    { yes: '2.5', no: '3.1' },
    { yes: '4.2', no: '5.99' },
    { yes: '1.5', no: '2.7' },
    { yes: '3.8', no: '4.5' }
  ];

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    const amounts = betAmounts[i % betAmounts.length];

    // Alternate who goes first
    const firstWallet = i % 2 === 0 ? wallets[0] : wallets[1];
    const secondWallet = i % 2 === 0 ? wallets[1] : wallets[0];
    const firstIsYes = i % 2 === 0;

    // Place first bet
    const wallet1 = new ethers.Wallet(firstWallet.privateKey, provider);
    const contract1 = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      WeatherMarketABI,
      wallet1
    );

    const tx1 = await contract1.placeBet(
      market.marketId,
      firstIsYes,
      { value: ethers.utils.parseEther(firstIsYes ? amounts.yes : amounts.no) }
    );
    await tx1.wait();

    // Place second bet
    const wallet2 = new ethers.Wallet(secondWallet.privateKey, provider);
    const contract2 = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      WeatherMarketABI,
      wallet2
    );

    const tx2 = await contract2.placeBet(
      market.marketId,
      !firstIsYes,
      { value: ethers.utils.parseEther(!firstIsYes ? amounts.yes : amounts.no) }
    );
    await tx2.wait();

    results.push({
      marketId: market.marketId,
      yesBet: {
        wallet: firstIsYes ? firstWallet.address : secondWallet.address,
        amount: amounts.yes,
        txHash: firstIsYes ? tx1.hash : tx2.hash
      },
      noBet: {
        wallet: !firstIsYes ? firstWallet.address : secondWallet.address,
        amount: amounts.no,
        txHash: !firstIsYes ? tx1.hash : tx2.hash
      }
    });

    console.log(`Placed bets on market ${market.marketId}: YES ${amounts.yes} FLR, NO ${amounts.no} FLR`);
  }

  return results;
}

// Verify payouts match expected calculations
export async function verifyPayouts(markets: any[], wallets: TestWallet[]): Promise<PayoutVerification[]> {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const verifications: PayoutVerification[] = [];

  for (const market of markets) {
    if (!market.outcome) continue; // Skip unsettled markets

    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      WeatherMarketABI,
      provider
    );

    // Get market data from contract
    const marketData = await contract.markets(market.marketId);
    const yesPool = parseFloat(ethers.utils.formatEther(marketData.yesPool));
    const noPool = parseFloat(ethers.utils.formatEther(marketData.noPool));
    const fee = parseFloat(marketData.feePercentage) / 100;

    // Calculate expected payouts
    const losingPool = market.outcome === 'YES' ? noPool : yesPool;
    const winningPool = market.outcome === 'YES' ? yesPool : noPool;

    // Get actual payouts for each wallet
    for (const wallet of wallets) {
      const position = await contract.getPosition(market.marketId, wallet.address);
      const yesBet = parseFloat(ethers.utils.formatEther(position.yesAmount));
      const noBet = parseFloat(ethers.utils.formatEther(position.noAmount));

      const winningBet = market.outcome === 'YES' ? yesBet : noBet;
      if (winningBet === 0) continue; // No winning bet

      // Calculate expected payout: (myBet / winningPool) * losingPool * (1 - fee)
      const expectedPayout = (winningBet / winningPool) * losingPool * (1 - fee) + winningBet;

      // Get actual payout (check wallet balance change)
      const walletContract = new ethers.Wallet(wallet.privateKey, provider);
      const balanceBefore = await walletContract.getBalance();

      const claimContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        WeatherMarketABI,
        walletContract
      );

      const claimTx = await claimContract.claimWinnings(market.marketId);
      await claimTx.wait();

      const balanceAfter = await walletContract.getBalance();
      const actualPayout = parseFloat(
        ethers.utils.formatEther(balanceAfter.sub(balanceBefore))
      );

      const discrepancy = Math.abs(expectedPayout - actualPayout);

      verifications.push({
        marketId: market.marketId,
        outcome: market.outcome as 'YES' | 'NO',
        expectedPayout,
        actualPayout,
        payoutMatches: discrepancy < 0.001, // 0.001 FLR tolerance
        discrepancy
      });
    }
  }

  return verifications;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/test-markets-creation.test.ts`
Expected: PASS (with mocked contract calls)

**Step 5: Commit**

```bash
git add apps/web/src/lib/test-markets.ts apps/web/src/lib/__tests__/test-markets-creation.test.ts
git commit -m "feat(epic8): implement test market creation and betting"
```

---

### Task 7: Test Runner Orchestration

**Files:**
- Create: `apps/web/src/lib/test-runner.ts`
- Create: `apps/web/src/lib/__tests__/test-runner.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/test-runner.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  startTestWindow,
  monitorTestRun,
  finalizeTestRun
} from '@/lib/test-runner';

describe('Test Runner', () => {
  it('should orchestrate complete test window', async () => {
    const testRun = await startTestWindow('suggestion-123');

    expect(testRun.status).toBe('RUNNING');
    expect(testRun.marketsCreated).toBe(5);
    expect(testRun.fundingAmount).toBeGreaterThan(0);
    expect(testRun.walletKeys).toBeTruthy();
  });

  it('should monitor and update test run progress', async () => {
    const testRunId = 'test-run-123';

    await monitorTestRun(testRunId);

    const updatedRun = await prisma.testRun.findUnique({
      where: { id: testRunId }
    });

    expect(updatedRun?.marketsSettled).toBeGreaterThan(0);
  });

  it('should finalize test run and send results', async () => {
    const results = await finalizeTestRun('test-run-123');

    expect(results.success).toBe(true);
    expect(results.fundsRecovered).toBe(true);
    expect(results.emailSent).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/test-runner.test.ts`
Expected: FAIL with "Cannot find module '@/lib/test-runner'"

**Step 3: Implement test runner**

```typescript
// apps/web/src/lib/test-runner.ts
import { prisma } from '@/lib/prisma';
import {
  generateTestWallets,
  encryptWalletKeys,
  fundWallets,
  sweepWallets,
  decryptWalletKeys
} from './test-wallets';
import {
  createTestMarkets,
  placeBets,
  verifyPayouts
} from './test-markets';
import { sendTestResultsEmail } from './email/test-results';
import { ethers } from 'ethers';

export interface TestResults {
  success: boolean;
  fundsRecovered: boolean;
  emailSent: boolean;
  errors?: string[];
}

// Start complete test window
export async function startTestWindow(suggestionId: string) {
  try {
    // Get suggestion details
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      include: { city: true }
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    // Create test run record
    const testRun = await prisma.testRun.create({
      data: {
        suggestionId,
        fundingAmount: 25.0,
        marketsCreated: 5
      }
    });

    // Generate test wallets
    const wallets = generateTestWallets(2);
    console.log('Generated test wallets:', wallets.map(w => w.address));

    // Encrypt and store wallet keys
    const encryptedKeys = encryptWalletKeys(wallets);
    await prisma.testRun.update({
      where: { id: testRun.id },
      data: { walletKeys: encryptedKeys }
    });

    // Fund wallets (12.5 FLR each for 5 markets)
    const fundingTxs = await fundWallets(wallets, '12.5');
    console.log('Funded wallets:', fundingTxs);

    // Create test markets
    const markets = await createTestMarkets({
      city: suggestion.city?.name || suggestion.customCityName!,
      latitude: suggestion.city?.latitude || suggestion.latitude!,
      longitude: suggestion.city?.longitude || suggestion.longitude!,
      count: 5,
      testRunId: testRun.id
    });
    console.log('Created test markets:', markets.map(m => m.marketId));

    // Place opposing bets
    const betResults = await placeBets(markets, wallets);
    console.log('Placed bets:', betResults);

    // Update test run with initial results
    await prisma.testRun.update({
      where: { id: testRun.id },
      data: {
        results: {
          fundingTxs,
          markets: markets.map(m => m.marketId),
          bets: betResults
        }
      }
    });

    // Start monitoring in background
    setTimeout(() => monitorTestRun(testRun.id), 60000); // Check after 1 minute

    return testRun;
  } catch (error) {
    console.error('Failed to start test window:', error);

    // Update test run status to failed
    if (suggestionId) {
      await prisma.testRun.updateMany({
        where: {
          suggestionId,
          status: 'RUNNING'
        },
        data: {
          status: 'FAILED',
          results: { error: error.message }
        }
      });
    }

    throw error;
  }
}

// Monitor test run for settlement
export async function monitorTestRun(testRunId: string) {
  try {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        markets: true,
        suggestion: { include: { city: true } }
      }
    });

    if (!testRun || testRun.status !== 'RUNNING') {
      return;
    }

    // Check market settlement status
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
      WeatherMarketABI,
      provider
    );

    let settledCount = 0;
    const updatedMarkets = [];

    for (const market of testRun.markets) {
      if (!market.settledAt) {
        const marketData = await contract.markets(market.marketId);

        if (marketData.isResolved) {
          // Market has been settled
          const outcome = marketData.outcome ? 'YES' : 'NO';
          const actualTemp = marketData.actualTemp;

          await prisma.market.update({
            where: { id: market.id },
            data: {
              settledAt: new Date(),
              outcome,
              actualTemp
            }
          });

          settledCount++;
          updatedMarkets.push({ ...market, outcome, actualTemp });
          console.log(`Market ${market.marketId} settled: ${outcome} (temp: ${actualTemp/10}°F)`);
        }
      } else {
        settledCount++;
        updatedMarkets.push(market);
      }
    }

    // Update test run progress
    await prisma.testRun.update({
      where: { id: testRunId },
      data: { marketsSettled: settledCount }
    });

    // Check if all markets settled
    if (settledCount === testRun.marketsCreated) {
      console.log('All markets settled, finalizing test run...');
      await finalizeTestRun(testRunId);
    } else {
      // Check again in 5 minutes
      setTimeout(() => monitorTestRun(testRunId), 5 * 60 * 1000);
    }
  } catch (error) {
    console.error('Error monitoring test run:', error);

    // Mark test run as failed
    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'FAILED',
        results: { monitoringError: error.message }
      }
    });
  }
}

// Finalize test run and send results
export async function finalizeTestRun(testRunId: string): Promise<TestResults> {
  const results: TestResults = {
    success: false,
    fundsRecovered: false,
    emailSent: false,
    errors: []
  };

  try {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        markets: true,
        suggestion: { include: { city: true } }
      }
    });

    if (!testRun) {
      throw new Error('Test run not found');
    }

    // Decrypt wallet keys
    const wallets = decryptWalletKeys(testRun.walletKeys!);

    // Verify payouts
    const payoutVerifications = await verifyPayouts(testRun.markets, wallets);
    const allPayoutsCorrect = payoutVerifications.every(v => v.payoutMatches);

    if (!allPayoutsCorrect) {
      results.errors?.push('Payout verification failed');
      console.error('Payout mismatches:', payoutVerifications.filter(v => !v.payoutMatches));
    }

    // Sweep funds back to admin
    const sweepResult = await sweepWallets(
      wallets,
      process.env.ADMIN_WALLET_ADDRESS!
    );

    if (sweepResult.success) {
      results.fundsRecovered = true;

      // Dispose of keys only after successful sweep
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          keysDisposed: true,
          recoveredAmount: sweepResult.totalRecovered,
          netCost: testRun.fundingAmount.toNumber() - sweepResult.totalRecovered
        }
      });

      console.log(`Recovered ${sweepResult.totalRecovered} FLR from test wallets`);
    } else {
      results.errors?.push('Fund recovery failed');
      console.error('Sweep errors:', sweepResult.errors);
    }

    // Send test results email
    try {
      await sendTestResultsEmail({
        testRun,
        markets: testRun.markets,
        payoutVerifications,
        sweepResult,
        cityName: testRun.suggestion.city?.name || testRun.suggestion.customCityName!
      });
      results.emailSent = true;
    } catch (emailError) {
      results.errors?.push(`Email failed: ${emailError.message}`);
      console.error('Failed to send results email:', emailError);
    }

    // Update test run status
    const finalStatus = allPayoutsCorrect && results.fundsRecovered ? 'COMPLETED' : 'FAILED';
    results.success = finalStatus === 'COMPLETED';

    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        results: {
          ...testRun.results,
          payoutVerifications,
          sweepResult,
          finalStatus
        }
      }
    });

    console.log(`Test run ${testRunId} finalized: ${finalStatus}`);

  } catch (error) {
    console.error('Failed to finalize test run:', error);
    results.errors?.push(error.message);

    await prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        results: { finalizationError: error.message }
      }
    });
  }

  return results;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/test-runner.test.ts`
Expected: PASS (with mocked dependencies)

**Step 5: Commit**

```bash
git add apps/web/src/lib/test-runner.ts apps/web/src/lib/__tests__/test-runner.test.ts
git commit -m "feat(epic8): implement test runner orchestration"
```

---

## Phase 3: Email System

### Task 8: Email Setup and Templates

**Files:**
- Create: `apps/web/src/lib/email/client.ts`
- Create: `apps/web/src/lib/email/templates/test-results.tsx`
- Create: `apps/web/src/lib/email/test-results.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/email/__tests__/test-results.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TestResultsEmail } from '../templates/test-results';
import { sendTestResultsEmail } from '../test-results';

describe('Test Results Email', () => {
  it('should render email template with results', () => {
    const props = {
      cityName: 'Miami, FL',
      testRun: {
        createdAt: new Date(),
        completedAt: new Date(),
        marketsCreated: 5,
        marketsSettled: 5,
        fundingAmount: 25.0,
        recoveredAmount: 24.87,
        netCost: 0.13
      },
      markets: [],
      passed: true
    };

    const { getByText } = render(<TestResultsEmail {...props} />);

    expect(getByText(/Test Results for: Miami, FL/)).toBeInTheDocument();
    expect(getByText(/✅ ALL TESTS PASSED/)).toBeInTheDocument();
  });

  it('should send email via Resend', async () => {
    const result = await sendTestResultsEmail({
      testRun: { /* ... */ },
      markets: [],
      cityName: 'Miami, FL'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/email/__tests__/test-results.test.tsx`
Expected: FAIL with module not found

**Step 3: Create email client**

```typescript
// apps/web/src/lib/email/client.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not configured');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const ADMIN_EMAIL = process.env.ADMIN_REPORT_EMAIL || 'cobibean777@gmail.com';
export const FROM_EMAIL = 'WeatherB <reports@weatherb.app>';
```

**Step 4: Create email template**

```tsx
// apps/web/src/lib/email/templates/test-results.tsx
import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface TestResultsEmailProps {
  cityName: string;
  testRun: {
    createdAt: Date;
    completedAt: Date;
    marketsCreated: number;
    marketsSettled: number;
    fundingAmount: number;
    recoveredAmount: number;
    netCost: number;
  };
  markets: Array<{
    marketId: string;
    resolveTime: Date;
    threshold: number;
    actualTemp: number;
    outcome: string;
    yesBet: string;
    noBet: string;
    expectedPayout: string;
    actualPayout: string;
    passed: boolean;
  }>;
  passed: boolean;
  promoteUrl?: string;
  retestUrl?: string;
  rejectUrl?: string;
}

export function TestResultsEmail({
  cityName,
  testRun,
  markets,
  passed,
  promoteUrl,
  retestUrl,
  rejectUrl
}: TestResultsEmailProps) {
  const duration = Math.round(
    (testRun.completedAt.getTime() - testRun.createdAt.getTime()) / 60000
  );

  return (
    <Html>
      <Head />
      <Preview>
        Test Results: {cityName} - {passed ? '✅ PASSED' : '❌ FAILED'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            Test Results for: {cityName}
          </Heading>

          <Text style={text}>
            Started: {testRun.createdAt.toLocaleString()}<br />
            Completed: {testRun.completedAt.toLocaleString()} ({duration} minutes)
          </Text>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>MARKET RESULTS ({markets.length} markets)</Heading>

            {markets.map((market, idx) => (
              <Section key={market.marketId} style={marketSection}>
                <Text style={marketHeader}>
                  Market #{idx + 1}: {new Date(market.resolveTime).toLocaleString()}
                </Text>
                <Text style={marketDetails}>
                  Threshold: Temp ≥ {(market.threshold / 10).toFixed(1)}°F<br />
                  Actual: {(market.actualTemp / 10).toFixed(1)}°F<br />
                  Outcome: {market.outcome} wins<br />
                  Bets: {market.yesBet} FLR (YES) vs {market.noBet} FLR (NO)<br />
                  Expected Payout: {market.expectedPayout} FLR<br />
                  Actual Payout: {market.actualPayout} FLR {market.passed ? '✅' : '❌'}<br />
                  Status: {market.passed ? 'PASSED' : 'FAILED'}<br />
                  Tx: {market.marketId}
                </Text>
              </Section>
            ))}
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>FUNDS RECOVERY</Heading>
            <Text style={text}>
              Initial funding: {testRun.fundingAmount.toFixed(2)} FLR<br />
              Swept back: {testRun.recoveredAmount.toFixed(2)} FLR<br />
              Net cost: {testRun.netCost.toFixed(2)} FLR (gas + fees)<br />
              Recovery status: ✅ COMPLETE
            </Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>
              OVERALL: {passed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}
            </Heading>
            <Text style={text}>
              {passed
                ? 'This city is ready to go live.'
                : 'Issues were found during testing. Please review the results above.'}
            </Text>
          </Section>

          {(promoteUrl || retestUrl || rejectUrl) && (
            <Section style={buttonContainer}>
              {promoteUrl && (
                <Button style={button} href={promoteUrl}>
                  PROMOTE TO LIVE
                </Button>
              )}
              {retestUrl && (
                <Button style={buttonSecondary} href={retestUrl}>
                  RUN TESTS AGAIN
                </Button>
              )}
              {rejectUrl && (
                <Button style={buttonDanger} href={rejectUrl}>
                  REJECT & DELETE
                </Button>
              )}
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
  padding: '0 48px',
};

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '30px 0 10px',
  padding: '0 48px',
};

const text = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 10px',
  padding: '0 48px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 48px',
};

const marketSection = {
  marginBottom: '20px',
};

const marketHeader = {
  ...text,
  fontWeight: '600',
  color: '#333',
};

const marketDetails = {
  ...text,
  fontSize: '13px',
  fontFamily: 'monospace',
};

const buttonContainer = {
  padding: '27px 48px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  width: '100%',
  padding: '11px 23px',
  marginBottom: '10px',
};

const buttonSecondary = {
  ...button,
  backgroundColor: '#666',
};

const buttonDanger = {
  ...button,
  backgroundColor: '#dc2626',
};

export default TestResultsEmail;
```

**Step 5: Create email sender**

```typescript
// apps/web/src/lib/email/test-results.ts
import { resend, ADMIN_EMAIL, FROM_EMAIL } from './client';
import { TestResultsEmail } from './templates/test-results';
import { createActionLink } from '@/lib/magic-links';

export interface SendTestResultsParams {
  testRun: any;
  markets: any[];
  payoutVerifications: any[];
  sweepResult: any;
  cityName: string;
}

export async function sendTestResultsEmail(params: SendTestResultsParams) {
  const { testRun, markets, payoutVerifications, sweepResult, cityName } = params;

  // Prepare market data for template
  const marketData = markets.map((market, idx) => {
    const verification = payoutVerifications.find(v => v.marketId === market.marketId);
    const betInfo = testRun.results?.bets?.find(b => b.marketId === market.marketId);

    return {
      marketId: market.marketId,
      resolveTime: market.resolveTime,
      threshold: market.threshold,
      actualTemp: market.actualTemp || 0,
      outcome: market.outcome || 'UNKNOWN',
      yesBet: betInfo?.yesBet?.amount || '0',
      noBet: betInfo?.noBet?.amount || '0',
      expectedPayout: verification?.expectedPayout?.toFixed(3) || '0',
      actualPayout: verification?.actualPayout?.toFixed(3) || '0',
      passed: verification?.payoutMatches || false
    };
  });

  const allPassed = marketData.every(m => m.passed) && sweepResult.success;

  // Generate magic link URLs
  const promoteUrl = allPassed
    ? await createActionLink('promote', testRun.suggestionId)
    : undefined;
  const retestUrl = await createActionLink('retest', testRun.suggestionId);
  const rejectUrl = await createActionLink('reject', testRun.suggestionId);

  // Send email
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[WeatherB] Test Results: ${cityName} - ${allPassed ? '✅ PASSED' : '❌ FAILED'}`,
    react: TestResultsEmail({
      cityName,
      testRun: {
        createdAt: testRun.createdAt,
        completedAt: testRun.completedAt || new Date(),
        marketsCreated: testRun.marketsCreated,
        marketsSettled: testRun.marketsSettled,
        fundingAmount: parseFloat(testRun.fundingAmount),
        recoveredAmount: parseFloat(testRun.recoveredAmount || 0),
        netCost: parseFloat(testRun.netCost || 0)
      },
      markets: marketData,
      passed: allPassed,
      promoteUrl,
      retestUrl,
      rejectUrl
    })
  });

  return {
    success: true,
    messageId: result.id
  };
}
```

**Step 6: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/email/__tests__/test-results.test.tsx`
Expected: PASS (with mocked Resend)

**Step 7: Commit**

```bash
git add apps/web/src/lib/email/
git commit -m "feat(epic8): implement test results email system"
```

---

### Task 9: Magic Links Implementation

**Files:**
- Create: `apps/web/src/lib/magic-links.ts`
- Create: `apps/web/src/app/api/admin/action/route.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/magic-links.test.ts
import { describe, it, expect } from 'vitest';
import { createActionLink, verifyActionLink } from '@/lib/magic-links';

describe('Magic Links', () => {
  it('should create signed action links', async () => {
    const link = await createActionLink('promote', 'suggestion-123');

    expect(link).toMatch(/^https?:\/\/.*\/api\/admin\/action\?token=/);
  });

  it('should verify and decode valid tokens', async () => {
    const link = await createActionLink('approve', 'suggestion-456');
    const token = new URL(link).searchParams.get('token')!;

    const payload = await verifyActionLink(token);

    expect(payload.action).toBe('approve');
    expect(payload.suggestionId).toBe('suggestion-456');
  });

  it('should reject expired tokens', async () => {
    // Create token with 1ms expiry
    const expiredToken = '...';

    await expect(verifyActionLink(expiredToken)).rejects.toThrow('Token expired');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/magic-links.test.ts`
Expected: FAIL with module not found

**Step 3: Implement magic links**

```typescript
// apps/web/src/lib/magic-links.ts
import jwt from 'jsonwebtoken';

const SECRET = process.env.MAGIC_LINK_SECRET!;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const EXPIRY = 7 * 24 * 60 * 60; // 7 days

export type ActionType = 'approve' | 'deny' | 'promote' | 'reject' | 'retest';

export interface ActionPayload {
  action: ActionType;
  suggestionId: string;
  exp: number;
}

export async function createActionLink(
  action: ActionType,
  suggestionId: string
): Promise<string> {
  const payload: ActionPayload = {
    action,
    suggestionId,
    exp: Math.floor(Date.now() / 1000) + EXPIRY
  };

  const token = jwt.sign(payload, SECRET, { algorithm: 'HS256' });

  return `${APP_URL}/api/admin/action?token=${encodeURIComponent(token)}`;
}

export async function verifyActionLink(token: string): Promise<ActionPayload> {
  try {
    const payload = jwt.verify(token, SECRET, {
      algorithms: ['HS256']
    }) as ActionPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    if (error.message === 'Token expired') {
      throw error;
    }
    throw new Error('Invalid token');
  }
}
```

**Step 4: Create action handler route**

```typescript
// apps/web/src/app/api/admin/action/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyActionLink } from '@/lib/magic-links';
import { prisma } from '@/lib/prisma';
import { startTestWindow } from '@/lib/test-runner';
import { logAdminAction } from '@/lib/admin-log';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(
      '<html><body><h1>Invalid Link</h1><p>Missing token</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const payload = await verifyActionLink(token);
    const { action, suggestionId } = payload;

    // Execute action
    let message = '';

    switch (action) {
      case 'approve':
        await startTestWindow(suggestionId);
        message = 'Test window started. Results will be emailed in ~4 hours.';
        break;

      case 'promote':
        // Check test passed
        const testRun = await prisma.testRun.findFirst({
          where: {
            suggestionId,
            status: 'COMPLETED'
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!testRun) {
          throw new Error('No completed test run found');
        }

        // Update suggestion status
        await prisma.suggestion.update({
          where: { id: suggestionId },
          data: { status: 'IMPLEMENTED' }
        });

        // TODO: Add city to rotation
        message = 'City promoted to live rotation.';
        break;

      case 'deny':
      case 'reject':
        await prisma.suggestion.update({
          where: { id: suggestionId },
          data: { status: 'REJECTED' }
        });
        message = 'Suggestion rejected.';
        break;

      case 'retest':
        await startTestWindow(suggestionId);
        message = 'New test window started. Results will be emailed in ~4 hours.';
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log action
    await logAdminAction({
      wallet: 'MAGIC_LINK',
      action: `MAGIC_LINK_${action.toUpperCase()}`,
      details: { suggestionId }
    });

    // Return success page
    return new NextResponse(
      `<html>
        <head><title>WeatherB Admin Action</title></head>
        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>✅ Success</h1>
          <p>${message}</p>
          <p><a href="/admin/suggestions">Go to Admin Panel</a></p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Magic link action failed:', error);

    return new NextResponse(
      `<html>
        <head><title>WeatherB Admin Action</title></head>
        <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>❌ Error</h1>
          <p>${error.message}</p>
          <p><a href="/admin/suggestions">Go to Admin Panel</a></p>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/magic-links.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/lib/magic-links.ts apps/web/src/app/api/admin/action/route.ts
git commit -m "feat(epic8): implement magic links for email actions"
```

---

## Phase 4: AI & Weekly Reports

### Task 10: Weekly Metrics Collection

**Files:**
- Create: `apps/web/src/lib/weekly-metrics.ts`
- Create: `apps/web/src/lib/__tests__/weekly-metrics.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/weekly-metrics.test.ts
import { describe, it, expect } from 'vitest';
import {
  getWeeklyMetrics,
  getTopSuggestions,
  getCityPerformance
} from '@/lib/weekly-metrics';

describe('Weekly Metrics', () => {
  it('should calculate weekly market metrics', async () => {
    const metrics = await getWeeklyMetrics();

    expect(metrics.marketsCreated).toBeGreaterThanOrEqual(0);
    expect(metrics.totalVolume).toBeGreaterThanOrEqual(0);
    expect(metrics.uniqueWallets).toBeGreaterThanOrEqual(0);
    expect(metrics.weekOverWeekGrowth).toBeDefined();
  });

  it('should get top suggestions with vote trends', async () => {
    const suggestions = await getTopSuggestions(10);

    expect(suggestions).toHaveLength(10);
    expect(suggestions[0].voteCount).toBeGreaterThanOrEqual(suggestions[1].voteCount);
    expect(suggestions[0].recentVoteCount).toBeDefined();
    expect(suggestions[0].trending).toBeDefined();
  });

  it('should analyze city performance', async () => {
    const performance = await getCityPerformance();

    expect(Array.isArray(performance)).toBe(true);
    if (performance.length > 0) {
      expect(performance[0]).toHaveProperty('city');
      expect(performance[0]).toHaveProperty('marketsCount');
      expect(performance[0]).toHaveProperty('totalVolume');
      expect(performance[0]).toHaveProperty('avgBetsPerMarket');
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/weekly-metrics.test.ts`
Expected: FAIL with module not found

**Step 3: Implement weekly metrics**

```typescript
// apps/web/src/lib/weekly-metrics.ts
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

export interface WeeklyMetrics {
  marketsCreated: number;
  totalBetsPlaced: number;
  totalVolume: number;
  feesCollected: number;
  uniqueWallets: number;
  avgBetsPerMarket: number;
  weekOverWeekGrowth: number;
}

export interface SuggestionWithTrend {
  id: string;
  cityName: string;
  state: string | null;
  voteCount: number;
  recentVoteCount: number;
  timeWindow: string | null;
  trending: boolean;
}

export interface CityPerformance {
  city: string;
  marketsCount: number;
  totalVolume: number;
  totalBets: number;
  avgBetsPerMarket: number;
  avgVolume: number;
}

export async function getWeeklyMetrics(): Promise<WeeklyMetrics> {
  const now = new Date();
  const oneWeekAgo = subDays(now, 7);
  const twoWeeksAgo = subDays(now, 14);

  // Get this week's data from contract events
  // Note: In production, this would query indexed events
  // For now, using mock data or database records

  // Get market data (excluding test markets)
  const thisWeekMarkets = await prisma.market.count({
    where: {
      createdAt: { gte: oneWeekAgo },
      isTest: false
    }
  });

  const lastWeekMarkets = await prisma.market.count({
    where: {
      createdAt: {
        gte: twoWeeksAgo,
        lt: oneWeekAgo
      },
      isTest: false
    }
  });

  // Mock data for demonstration
  // In production, query blockchain events or indexed data
  const totalBetsPlaced = 142;
  const totalVolume = 2450;
  const feesCollected = totalVolume * 0.01;
  const uniqueWallets = 67;
  const avgBetsPerMarket = thisWeekMarkets > 0 ? totalBetsPlaced / thisWeekMarkets : 0;

  // Calculate growth
  const weekOverWeekGrowth = lastWeekMarkets > 0
    ? ((thisWeekMarkets - lastWeekMarkets) / lastWeekMarkets) * 100
    : 0;

  return {
    marketsCreated: thisWeekMarkets,
    totalBetsPlaced,
    totalVolume,
    feesCollected,
    uniqueWallets,
    avgBetsPerMarket,
    weekOverWeekGrowth
  };
}

export async function getTopSuggestions(limit: number): Promise<SuggestionWithTrend[]> {
  const suggestions = await prisma.suggestion.findMany({
    where: {
      status: 'PENDING'
    },
    include: {
      city: true,
      votes: {
        where: {
          createdAt: { gte: subDays(new Date(), 7) }
        }
      }
    },
    orderBy: {
      voteCount: 'desc'
    },
    take: limit
  });

  return suggestions.map(s => ({
    id: s.id,
    cityName: s.city?.name || s.customCityName || 'Unknown',
    state: s.city?.id ? s.city.id.split('-')[1] : null, // Extract state from city ID
    voteCount: s.voteCount,
    recentVoteCount: s.recentVoteCount,
    timeWindow: s.timeWindow,
    trending: s.recentVoteCount > (s.voteCount * 0.3) // 30%+ votes in last week
  }));
}

export async function getCityPerformance(): Promise<CityPerformance[]> {
  // Get performance data for cities in rotation
  // In production, this would query blockchain events

  const cities = await prisma.city.findMany({
    where: { isActive: true }
  });

  const performance: CityPerformance[] = [];

  for (const city of cities) {
    const markets = await prisma.market.findMany({
      where: {
        city: city.name,
        isTest: false,
        createdAt: { gte: subDays(new Date(), 30) } // Last 30 days
      }
    });

    if (markets.length === 0) continue;

    // Mock volume data (in production, from blockchain)
    const totalVolume = Math.random() * 1000 + 500; // Mock: 500-1500 FLR
    const totalBets = Math.floor(Math.random() * 50 + 10); // Mock: 10-60 bets

    performance.push({
      city: city.name,
      marketsCount: markets.length,
      totalVolume,
      totalBets,
      avgBetsPerMarket: totalBets / markets.length,
      avgVolume: totalVolume / markets.length
    });
  }

  // Sort by volume
  return performance.sort((a, b) => b.totalVolume - a.totalVolume);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/weekly-metrics.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/weekly-metrics.ts apps/web/src/lib/__tests__/weekly-metrics.test.ts
git commit -m "feat(epic8): implement weekly metrics collection"
```

---

### Task 11: AI Integration and Weekly Report

**Files:**
- Create: `apps/web/src/lib/ai-insights.ts`
- Create: `apps/web/src/lib/email/templates/weekly-summary.tsx`
- Create: `apps/web/src/app/api/cron/weekly-report/route.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/ai-insights.test.ts
import { describe, it, expect } from 'vitest';
import { generateCityInsights } from '@/lib/ai-insights';

describe('AI Insights', () => {
  it('should generate insights for top suggestions', async () => {
    const suggestions = [
      { cityName: 'Miami', state: 'FL', voteCount: 47, recentVoteCount: 23, trending: true },
      { cityName: 'Seattle', state: 'WA', voteCount: 31, recentVoteCount: 8, trending: false }
    ];

    const insights = await generateCityInsights(suggestions, {});

    expect(insights).toHaveLength(2);
    expect(insights[0].recommendation).toMatch(/APPROVE|WAIT|MONITOR/);
    expect(insights[0].analysis).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/src/lib/__tests__/ai-insights.test.ts`
Expected: FAIL with module not found

**Step 3: Implement AI insights**

```typescript
// apps/web/src/lib/ai-insights.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

export interface CityInsight {
  cityName: string;
  analysis: string;
  recommendation: 'APPROVE' | 'WAIT' | 'MONITOR';
}

export async function generateCityInsights(
  suggestions: any[],
  performanceData: any
): Promise<CityInsight[]> {
  const prompt = `You are analyzing user voting data for a weather prediction market platform.

TOP SUGGESTIONS:
${JSON.stringify(suggestions.slice(0, 3).map(s => ({
  city: s.cityName,
  state: s.state,
  totalVotes: s.voteCount,
  recentVotes: s.recentVoteCount,
  timePreference: s.timeWindow,
  trending: s.trending
})), null, 2)}

CURRENT ROTATION PERFORMANCE:
${JSON.stringify(performanceData, null, 2)}

Analyze the top 3 suggestions and provide:
1. Vote momentum analysis (is growth accelerating?)
2. Comparison to similar cities already in rotation
3. Weather characteristics (volatility, forecast reliability)
4. Recommendation: APPROVE / WAIT / MONITOR

Be concise (2-3 sentences per city). Be conservative (prefer waiting over rushing). Focus on data-driven insights.

Return as JSON array with structure:
[{ "cityName": "...", "analysis": "...", "recommendation": "APPROVE|WAIT|MONITOR" }]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to generate AI insights:', error);

    // Fallback to basic recommendations
    return suggestions.slice(0, 3).map(s => ({
      cityName: s.cityName,
      analysis: 'AI analysis unavailable. Manual review recommended.',
      recommendation: 'WAIT' as const
    }));
  }
}
```

**Step 4: Create weekly summary email template**

```tsx
// apps/web/src/lib/email/templates/weekly-summary.tsx
import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface WeeklySummaryEmailProps {
  dateRange: string;
  metrics: {
    marketsCreated: number;
    totalBets: number;
    totalVolume: number;
    feesCollected: number;
    uniqueWallets: number;
    avgBetsPerMarket: number;
    weekOverWeekGrowth: number;
  };
  topSuggestions: Array<{
    cityName: string;
    voteCount: number;
    recentVoteCount: number;
    timeWindow: string | null;
    trending: boolean;
  }>;
  aiInsights: Array<{
    cityName: string;
    analysis: string;
    recommendation: string;
  }>;
  actionLinks: {
    [cityName: string]: {
      approve: string;
      deny: string;
    };
  };
  adminPanelUrl: string;
}

export function WeeklySummaryEmail({
  dateRange,
  metrics,
  topSuggestions,
  aiInsights,
  actionLinks,
  adminPanelUrl
}: WeeklySummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>WeatherB Weekly Report - {dateRange}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            📊 WeatherB Weekly Report
          </Heading>
          <Text style={subtitle}>{dateRange}</Text>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>📈 MARKET METRICS</Heading>
            <Text style={metricsText}>
              Markets created: {metrics.marketsCreated}<br />
              Total bets placed: {metrics.totalBets}<br />
              Total volume: {metrics.totalVolume.toFixed(2)} FLR<br />
              Fees collected: {metrics.feesCollected.toFixed(2)} FLR<br />
              Unique wallets: {metrics.uniqueWallets}<br />
              Avg bets/market: {metrics.avgBetsPerMarket.toFixed(1)}<br />
              <br />
              Week-over-week: {metrics.weekOverWeekGrowth > 0 ? '+' : ''}{metrics.weekOverWeekGrowth.toFixed(1)}% volume {metrics.weekOverWeekGrowth > 0 ? '📈' : '📉'}
            </Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>🗳️ TOP CITY SUGGESTIONS</Heading>
            {topSuggestions.map((s, idx) => (
              <div key={s.cityName} style={suggestionItem}>
                <Text style={suggestionHeader}>
                  {idx + 1}. {s.cityName}
                </Text>
                <Text style={suggestionDetails}>
                  Total: {s.voteCount} votes | This week: +{s.recentVoteCount} {s.trending ? '🔥 TRENDING' : ''}<br />
                  Time preference: {s.timeWindow || 'Any'}
                </Text>
              </div>
            ))}
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>🤖 AI INSIGHTS (Claude Sonnet)</Heading>
            {aiInsights.map(insight => (
              <div key={insight.cityName} style={insightItem}>
                <Text style={insightHeader}>
                  {insight.cityName} Analysis:
                </Text>
                <Text style={insightText}>
                  {insight.analysis}<br />
                  <strong>RECOMMENDATION: {insight.recommendation}</strong>
                </Text>
              </div>
            ))}
          </Section>

          <Hr style={hr} />

          <Section>
            <Heading style={h2}>⚡ QUICK ACTIONS</Heading>
            {Object.entries(actionLinks).slice(0, 3).map(([city, links]) => (
              <div key={city} style={actionRow}>
                <Text style={actionCity}>{city}</Text>
                <Button style={approveButton} href={links.approve}>
                  APPROVE
                </Button>
                <Button style={denyButton} href={links.deny}>
                  DENY
                </Button>
              </div>
            ))}
          </Section>

          <Section style={footer}>
            <Button style={adminButton} href={adminPanelUrl}>
              VIEW FULL ADMIN PANEL
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0 0 10px',
};

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: '600',
  margin: '30px 0 15px',
};

const subtitle = {
  color: '#666',
  fontSize: '14px',
  margin: '0 0 20px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const metricsText = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '22px',
  fontFamily: 'monospace',
};

const suggestionItem = {
  marginBottom: '20px',
};

const suggestionHeader = {
  color: '#333',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 5px',
};

const suggestionDetails = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const insightItem = {
  marginBottom: '20px',
};

const insightHeader = {
  color: '#333',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 5px',
};

const insightText = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const actionRow = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: '15px',
};

const actionCity = {
  flex: '1',
  color: '#333',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0',
};

const approveButton = {
  backgroundColor: '#22c55e',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '8px 16px',
  marginRight: '10px',
};

const denyButton = {
  backgroundColor: '#ef4444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '8px 16px',
};

const adminButton = {
  backgroundColor: '#5469d4',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '100%',
  padding: '12px',
};

const footer = {
  marginTop: '40px',
};

export default WeeklySummaryEmail;
```

**Step 5: Create weekly report cron route**

```typescript
// apps/web/src/app/api/cron/weekly-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  getWeeklyMetrics,
  getTopSuggestions,
  getCityPerformance
} from '@/lib/weekly-metrics';
import { generateCityInsights } from '@/lib/ai-insights';
import { createActionLink } from '@/lib/magic-links';
import { resend, ADMIN_EMAIL, FROM_EMAIL } from '@/lib/email/client';
import { WeeklySummaryEmail } from '@/lib/email/templates/weekly-summary';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = headers().get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Collect metrics
    const metrics = await getWeeklyMetrics();
    const topSuggestions = await getTopSuggestions(10);
    const cityPerformance = await getCityPerformance();

    // Generate AI insights for top 3 suggestions
    const aiInsights = await generateCityInsights(
      topSuggestions.slice(0, 3),
      cityPerformance
    );

    // Create action links for top suggestions
    const actionLinks: Record<string, { approve: string; deny: string }> = {};

    for (const suggestion of topSuggestions.slice(0, 3)) {
      actionLinks[suggestion.cityName] = {
        approve: await createActionLink('approve', suggestion.id),
        deny: await createActionLink('deny', suggestion.id)
      };
    }

    // Generate date range
    const endDate = new Date();
    const startDate = subDays(endDate, 7);
    const dateRange = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;

    // Send email
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `📊 WeatherB Weekly Report - ${dateRange}`,
      react: WeeklySummaryEmail({
        dateRange,
        metrics: {
          marketsCreated: metrics.marketsCreated,
          totalBets: metrics.totalBetsPlaced,
          totalVolume: metrics.totalVolume,
          feesCollected: metrics.feesCollected,
          uniqueWallets: metrics.uniqueWallets,
          avgBetsPerMarket: metrics.avgBetsPerMarket,
          weekOverWeekGrowth: metrics.weekOverWeekGrowth
        },
        topSuggestions: topSuggestions.slice(0, 10),
        aiInsights,
        actionLinks,
        adminPanelUrl: `${process.env.APP_URL}/admin/suggestions`
      })
    });

    console.log('Weekly report sent:', result.id);

    return NextResponse.json({
      success: true,
      messageId: result.id,
      metrics,
      suggestions: topSuggestions.length
    });

  } catch (error) {
    console.error('Failed to send weekly report:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send weekly report'
    }, { status: 500 });
  }
}
```

**Step 6: Update vercel.json with cron schedule**

```json
// Add to vercel.json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"  // Every Monday at 9:00 AM UTC
    }
  ]
}
```

**Step 7: Run test to verify it passes**

Run: `pnpm test apps/web/src/lib/__tests__/ai-insights.test.ts`
Expected: PASS (with mocked AI calls)

**Step 8: Commit**

```bash
git add apps/web/src/lib/ai-insights.ts apps/web/src/lib/email/templates/weekly-summary.tsx apps/web/src/app/api/cron/weekly-report/route.ts
git commit -m "feat(epic8): implement AI insights and weekly report system"
```

---

## Phase 5: Polish & Testing

### Task 12: Integration Tests

**Files:**
- Create: `apps/web/src/__tests__/epic8-integration.test.ts`

**Step 1: Write integration tests**

```typescript
// apps/web/src/__tests__/epic8-integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { startTestWindow } from '@/lib/test-runner';
import { sendTestResultsEmail } from '@/lib/email/test-results';
import { generateCityInsights } from '@/lib/ai-insights';

describe('Epic 8 Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.testRun.deleteMany({ where: { status: 'RUNNING' } });
  });

  it('should complete full test window flow', async () => {
    // Create test suggestion
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 25.7617,
        longitude: -80.1918,
        wallet: '0xtest',
        voteCount: 10
      }
    });

    // Start test window
    const testRun = await startTestWindow(suggestion.id);
    expect(testRun.status).toBe('RUNNING');
    expect(testRun.walletKeys).toBeTruthy();

    // Simulate market settlement
    // ... monitoring and settlement logic ...

    // Verify email sent
    const emailResult = await sendTestResultsEmail({
      testRun,
      markets: [],
      payoutVerifications: [],
      sweepResult: { success: true, totalRecovered: 24.5, transactions: [] },
      cityName: 'Test City'
    });
    expect(emailResult.success).toBe(true);
  });

  it('should filter test markets from public view', async () => {
    // Create test and real markets
    await prisma.market.create({
      data: {
        marketId: 'test-market',
        city: 'Test City',
        latitude: 0,
        longitude: 0,
        threshold: 750,
        resolveTime: new Date(Date.now() + 3600000),
        isTest: true
      }
    });

    await prisma.market.create({
      data: {
        marketId: 'real-market',
        city: 'Real City',
        latitude: 0,
        longitude: 0,
        threshold: 750,
        resolveTime: new Date(Date.now() + 3600000),
        isTest: false
      }
    });

    // Query public markets
    const publicMarkets = await prisma.market.findMany({
      where: { isTest: false }
    });

    expect(publicMarkets).not.toContainEqual(
      expect.objectContaining({ marketId: 'test-market' })
    );
  });

  it('should generate AI insights for suggestions', async () => {
    const suggestions = [
      { cityName: 'Miami', state: 'FL', voteCount: 50, recentVoteCount: 25, trending: true }
    ];

    const insights = await generateCityInsights(suggestions, {});

    expect(insights).toHaveLength(1);
    expect(['APPROVE', 'WAIT', 'MONITOR']).toContain(insights[0].recommendation);
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm test apps/web/src/__tests__/epic8-integration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/__tests__/epic8-integration.test.ts
git commit -m "feat(epic8): add integration tests"
```

---

### Task 13: Documentation and Environment Setup

**Files:**
- Modify: `.env.example`
- Create: `docs/epics/epic-8-implementation.md`

**Step 1: Update environment variables**

```bash
# Append to .env.example

# Epic 8: AI Reports & Testing
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
ADMIN_REPORT_EMAIL=admin@example.com

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Magic Links
MAGIC_LINK_SECRET=generate-64-char-random-string-here

# App URL (for magic links)
APP_URL=https://weatherb.app  # or http://localhost:3000 for dev
```

**Step 2: Create implementation documentation**

```markdown
# Create docs/epics/epic-8-implementation.md

# Epic 8: AI-Powered City Approval Workflow - Implementation Guide

## Overview
Epic 8 implements automated testing for user-suggested cities with AI-powered weekly reports.

## Setup Instructions

### 1. Install Dependencies
```bash
pnpm add resend @anthropic-ai/sdk jsonwebtoken @react-email/components
pnpm add -D @types/jsonwebtoken
```

### 2. Environment Variables
Add to `.env`:
```bash
RESEND_API_KEY=your_resend_key
ADMIN_REPORT_EMAIL=your_email@example.com
ANTHROPIC_API_KEY=your_anthropic_key
MAGIC_LINK_SECRET=64_char_random_string
APP_URL=https://weatherb.app
```

### 3. Database Migration
```bash
pnpm prisma migrate dev
```

### 4. Verify Cron Schedule
Check `vercel.json` includes:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

## Testing

### Manual Testing
1. Create test suggestion in admin panel
2. Click "Approve" to start test window
3. Monitor test progress in "Testing" tab
4. Check email for results (~4 hours)

### Automated Tests
```bash
pnpm test epic8
```

## Key Components

- **Admin Panel**: `/admin/suggestions`
- **Test Runner**: `lib/test-runner.ts`
- **Email Templates**: `lib/email/templates/`
- **AI Insights**: `lib/ai-insights.ts`
- **Magic Links**: `lib/magic-links.ts`

## Safety Rules

1. Test markets always have `isTest: true`
2. Wallet keys encrypted until funds recovered
3. 3 block confirmations for fund sweep
4. Test markets never appear in public views

## Monitoring

Check logs for:
- Test window starts: "Starting test window for suggestion X"
- Market creation: "Created test market Y"
- Settlement: "Market Z settled: YES/NO"
- Fund recovery: "Recovered X FLR from test wallets"
```

**Step 3: Commit documentation**

```bash
git add .env.example docs/epics/epic-8-implementation.md
git commit -m "feat(epic8): add documentation and environment setup"
```

---

## Dependencies and Risk Mitigation

### Dependencies
- **Resend Account**: Set up and verify domain before Phase 3
- **Anthropic API Key**: Obtain before Phase 4
- **Database Migration**: Run before any testing
- **Contract Access**: Ensure admin wallet has sufficient FLR

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Test wallet key loss | Encrypt keys, only dispose after confirmed sweep |
| Settlement failure | Retry logic, alert emails, manual recovery option |
| AI API failure | Fallback to basic recommendations |
| Email delivery issues | Log all attempts, provide admin panel fallback |
| Payout calculation errors | 0.001 FLR tolerance, detailed logging |

### Blockers to Watch
1. **Resend domain verification** - Can take 24-48 hours
2. **Contract upgrades** - May need contract changes for test market support
3. **RPC rate limits** - Monitor during 5 parallel market creation
4. **Gas price spikes** - Buffer extra FLR for test funding

---

## Testing Strategy

### Unit Tests
- Wallet generation and encryption
- Payout calculations
- Magic link signing/verification
- Metric calculations

### Integration Tests
- Full test window flow
- Email sending with templates
- AI insight generation
- Market filtering

### E2E Tests (Manual)
1. Create suggestion via UI
2. Approve from admin panel
3. Monitor test progress
4. Verify email receipt
5. Use magic link to promote
6. Confirm city in rotation

---

## Acceptance Criteria Checklist

### Phase 1: Database & Admin Panel ✅
- [ ] Schema migration successful
- [ ] Admin panel shows 4 tabs
- [ ] Approve/deny buttons functional
- [ ] Test markets filtered from public

### Phase 2: Test Window Core ✅
- [ ] Wallets generated and funded
- [ ] 5 markets created with staggered times
- [ ] Opposing bets placed
- [ ] Funds sweep back successfully

### Phase 3: Email System ✅
- [ ] Test results email sent
- [ ] Template renders correctly
- [ ] Magic links functional
- [ ] Action page handles all actions

### Phase 4: AI & Weekly Reports ✅
- [ ] Weekly metrics calculated
- [ ] AI insights generated
- [ ] Weekly email sent on schedule
- [ ] Quick actions work from email

### Phase 5: Polish & Testing ✅
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Environment variables documented
- [ ] Error handling robust

---

## Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1 | 2 days | Ready |
| Phase 2 | 3 days | Ready |
| Phase 3 | 2 days | Ready |
| Phase 4 | 1.5 days | Ready |
| Phase 5 | 1.5 days | Ready |
| **Total** | **10 days** | **Ready for execution** |

---

## Next Steps

1. **Immediate**: Switch to Sonnet 4.5 for implementation
2. **Execution**: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`
3. **Validation**: Run integration tests after each phase
4. **Deployment**: Test on Coston2 before mainnet

Plan complete and ready for implementation with Sonnet 4.5.