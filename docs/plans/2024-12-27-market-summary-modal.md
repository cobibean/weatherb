# Market Summary Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable market summary modal displaying comprehensive market information for both settled and live markets.

**Architecture:** Modal follows existing Framer Motion patterns, integrates with past markets dropdown, positions page, and admin panel. Displays different views for settled vs live markets with user-specific data when applicable.

**Tech Stack:** Next.js 16, React 19, Framer Motion, TailwindCSS, TypeScript, Lucide Icons

---

## Task 1: Create TypeScript Types

**Files:**
- Create: `apps/web/src/types/market-summary.ts`

**Step 1: Write the failing test**

Create `apps/web/src/types/__tests__/market-summary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { MarketSummaryData, SettledMarketSummary, LiveMarketSummary } from '../market-summary';
import type { Market } from '@weatherb/shared/types/market';

describe('MarketSummaryData types', () => {
  it('should create valid settled market summary', () => {
    const market: Market = {
      id: '1',
      cityId: 'seattle',
      cityName: 'Seattle',
      latitude: 47.6062,
      longitude: -122.3321,
      resolveTime: 1735344000,
      thresholdF_tenths: 650,
      currency: 'FLR',
      status: 'resolved',
      yesPool: BigInt(100e18),
      noPool: BigInt(50e18),
      resolvedTempF_tenths: 680,
      observedTimestamp: 1735344100,
      outcome: true,
      resolutionTxHash: '0xabc123'
    };

    const summary: SettledMarketSummary = {
      type: 'settled',
      market,
      totalPool: BigInt(150e18),
      winningPool: BigInt(100e18),
      losingPool: BigInt(50e18),
      winnerSide: 'YES',
      feeAmount: BigInt(0.5e18),
      winningPoolPercentage: 66.67,
      numberOfBettors: { yes: 10, no: 5 }
    };

    expect(summary.type).toBe('settled');
    expect(summary.winnerSide).toBe('YES');
    expect(summary.winningPoolPercentage).toBeCloseTo(66.67, 2);
  });

  it('should create valid live market summary', () => {
    const market: Market = {
      id: '2',
      cityId: 'miami',
      cityName: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      resolveTime: 1735430400,
      thresholdF_tenths: 850,
      currency: 'FLR',
      status: 'open',
      yesPool: BigInt(200e18),
      noPool: BigInt(300e18)
    };

    const summary: LiveMarketSummary = {
      type: 'live',
      market,
      totalPool: BigInt(500e18),
      bettingDeadline: 1735429800,
      timeUntilClose: 86400,
      timeUntilResolve: 87000,
      impliedProbability: { yes: 40, no: 60 },
      currentMultiplier: { yes: 2.5, no: 1.67 }
    };

    expect(summary.type).toBe('live');
    expect(summary.impliedProbability.yes).toBe(40);
    expect(summary.currentMultiplier.yes).toBeCloseTo(2.5, 2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test market-summary.test.ts`
Expected: FAIL with "Cannot find module '../market-summary'"

**Step 3: Write minimal implementation**

Create `apps/web/src/types/market-summary.ts`:

```typescript
import type { Market } from '@weatherb/shared/types/market';
import type { UserPosition } from './positions';

// Base type for all market summaries
export type MarketSummaryData = {
  market: Market;
  totalPool: bigint;
  userPosition?: UserPosition;
};

// Settled market specific data
export type SettledMarketSummary = MarketSummaryData & {
  type: 'settled';
  winningPool: bigint;
  losingPool: bigint;
  winnerSide: 'YES' | 'NO' | 'NONE';
  feeAmount: bigint;
  winningPoolPercentage: number;
  numberOfBettors?: {
    yes: number;
    no: number;
  };
};

// Live market specific data
export type LiveMarketSummary = MarketSummaryData & {
  type: 'live';
  bettingDeadline: number;
  timeUntilClose: number;
  timeUntilResolve: number;
  impliedProbability: {
    yes: number;
    no: number;
  };
  currentMultiplier: {
    yes: number;
    no: number;
  };
};

// Combined type
export type MarketSummary = SettledMarketSummary | LiveMarketSummary;
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test market-summary.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/types/market-summary.ts apps/web/src/types/__tests__/market-summary.test.ts
git commit -m "feat: add MarketSummary TypeScript types"
```

---

## Task 2: Create Market Summary Utilities

**Files:**
- Create: `apps/web/src/lib/market-summary-utils.ts`

**Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/market-summary-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateMarketSummary,
  formatTemperatureDisplay,
  getMarketQuestion,
  getOutcomeMessage
} from '../market-summary-utils';
import type { Market } from '@weatherb/shared/types/market';

describe('market summary utilities', () => {
  it('should calculate settled market summary', () => {
    const market: Market = {
      id: '1',
      cityId: 'seattle',
      cityName: 'Seattle',
      latitude: 47.6062,
      longitude: -122.3321,
      resolveTime: 1735344000,
      thresholdF_tenths: 650,
      currency: 'FLR',
      status: 'resolved',
      yesPool: BigInt(100e18),
      noPool: BigInt(50e18),
      resolvedTempF_tenths: 680,
      observedTimestamp: 1735344100,
      outcome: true
    };

    const summary = calculateMarketSummary(market, 0.01); // 1% fee

    expect(summary.type).toBe('settled');
    if (summary.type === 'settled') {
      expect(summary.winnerSide).toBe('YES');
      expect(summary.winningPool).toBe(BigInt(100e18));
      expect(summary.losingPool).toBe(BigInt(50e18));
      expect(summary.feeAmount).toBe(BigInt(0.5e18)); // 1% of losing pool
      expect(summary.winningPoolPercentage).toBeCloseTo(66.67, 2);
    }
  });

  it('should calculate live market summary', () => {
    const now = Date.now();
    const resolveTime = now + 86400000; // 24 hours from now

    const market: Market = {
      id: '2',
      cityId: 'miami',
      cityName: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      resolveTime: resolveTime / 1000,
      thresholdF_tenths: 850,
      currency: 'FLR',
      status: 'open',
      yesPool: BigInt(200e18),
      noPool: BigInt(300e18)
    };

    const summary = calculateMarketSummary(market, 0.01);

    expect(summary.type).toBe('live');
    if (summary.type === 'live') {
      expect(summary.impliedProbability.yes).toBe(40);
      expect(summary.impliedProbability.no).toBe(60);
      expect(summary.currentMultiplier.yes).toBeCloseTo(2.5, 2);
      expect(summary.currentMultiplier.no).toBeCloseTo(1.67, 2);
    }
  });

  it('should format temperature display', () => {
    expect(formatTemperatureDisplay(850)).toBe('85°F');
    expect(formatTemperatureDisplay(723)).toBe('72°F');
    expect(formatTemperatureDisplay(1000)).toBe('100°F');
  });

  it('should get market question', () => {
    const question = getMarketQuestion('Seattle', 650, new Date('2024-12-27T12:00:00Z'));
    expect(question).toBe('Will Seattle hit ≥65°F on Dec 27?');
  });

  it('should get outcome message', () => {
    expect(getOutcomeMessage('resolved', true)).toBe('YES Won');
    expect(getOutcomeMessage('resolved', false)).toBe('NO Won');
    expect(getOutcomeMessage('cancelled')).toBe('Cancelled');
    expect(getOutcomeMessage('noWinners')).toBe('No Winners');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test market-summary-utils.test.ts`
Expected: FAIL with "Cannot find module '../market-summary-utils'"

**Step 3: Write minimal implementation**

Create `apps/web/src/lib/market-summary-utils.ts`:

```typescript
import type { Market } from '@weatherb/shared/types/market';
import type { MarketSummary, SettledMarketSummary, LiveMarketSummary } from '@/types/market-summary';

// 10 minutes before resolve time in seconds
const BETTING_CLOSE_BUFFER = 600;

export function calculateMarketSummary(
  market: Market,
  feePercentage: number = 0.01
): MarketSummary {
  const totalPool = market.yesPool + market.noPool;

  // Check if market is settled (resolved, cancelled, or noWinners)
  if (market.status === 'resolved' || market.status === 'cancelled' || market.status === 'noWinners') {
    let winnerSide: 'YES' | 'NO' | 'NONE' = 'NONE';
    let winningPool = BigInt(0);
    let losingPool = BigInt(0);
    let feeAmount = BigInt(0);

    if (market.status === 'resolved' && market.outcome !== undefined) {
      winnerSide = market.outcome ? 'YES' : 'NO';
      winningPool = market.outcome ? market.yesPool : market.noPool;
      losingPool = market.outcome ? market.noPool : market.yesPool;

      // Calculate fee from losing pool
      feeAmount = (losingPool * BigInt(Math.floor(feePercentage * 10000))) / BigInt(10000);
    } else if (market.status === 'cancelled' || market.status === 'noWinners') {
      // No winner, all funds refundable
      winnerSide = 'NONE';
    }

    const winningPoolPercentage = totalPool > 0
      ? Number((winningPool * BigInt(10000)) / totalPool) / 100
      : 0;

    const settled: SettledMarketSummary = {
      type: 'settled',
      market,
      totalPool,
      winningPool,
      losingPool,
      winnerSide,
      feeAmount,
      winningPoolPercentage
    };

    return settled;
  }

  // Market is live (open or closed)
  const now = Date.now() / 1000;
  const bettingDeadline = market.resolveTime - BETTING_CLOSE_BUFFER;
  const timeUntilClose = Math.max(0, bettingDeadline - now);
  const timeUntilResolve = Math.max(0, market.resolveTime - now);

  // Calculate implied probability and multipliers
  const yesAmount = Number(market.yesPool) / 1e18;
  const noAmount = Number(market.noPool) / 1e18;
  const total = yesAmount + noAmount;

  const impliedProbability = {
    yes: total > 0 ? Math.round((yesAmount / total) * 100) : 50,
    no: total > 0 ? Math.round((noAmount / total) * 100) : 50
  };

  const currentMultiplier = {
    yes: yesAmount > 0 ? total / yesAmount : 1,
    no: noAmount > 0 ? total / noAmount : 1
  };

  const live: LiveMarketSummary = {
    type: 'live',
    market,
    totalPool,
    bettingDeadline,
    timeUntilClose,
    timeUntilResolve,
    impliedProbability,
    currentMultiplier
  };

  return live;
}

export function formatTemperatureDisplay(tenths: number): string {
  const fahrenheit = Math.round(tenths / 10);
  return `${fahrenheit}°F`;
}

export function getMarketQuestion(cityName: string, thresholdTenths: number, resolveDate: Date): string {
  const threshold = Math.round(thresholdTenths / 10);
  const month = resolveDate.toLocaleDateString('en-US', { month: 'short' });
  const day = resolveDate.getDate();
  return `Will ${cityName} hit ≥${threshold}°F on ${month} ${day}?`;
}

export function getOutcomeMessage(status: Market['status'], outcome?: boolean): string {
  switch (status) {
    case 'resolved':
      return outcome ? 'YES Won' : 'NO Won';
    case 'cancelled':
      return 'Cancelled';
    case 'noWinners':
      return 'No Winners';
    case 'open':
      return 'Open for Betting';
    case 'closed':
      return 'Betting Closed';
    default:
      return 'Unknown';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test market-summary-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/market-summary-utils.ts apps/web/src/lib/__tests__/market-summary-utils.test.ts
git commit -m "feat: add market summary calculation utilities"
```

---

## Task 3: Create Market Summary Modal Component

**Files:**
- Create: `apps/web/src/components/markets/market-summary-modal.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/markets/__tests__/market-summary-modal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarketSummaryModal } from '../market-summary-modal';
import type { Market } from '@weatherb/shared/types/market';

describe('MarketSummaryModal', () => {
  const mockMarket: Market = {
    id: '1',
    cityId: 'seattle',
    cityName: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    resolveTime: 1735344000,
    thresholdF_tenths: 650,
    currency: 'FLR',
    status: 'resolved',
    yesPool: BigInt(100e18),
    noPool: BigInt(50e18),
    resolvedTempF_tenths: 680,
    observedTimestamp: 1735344100,
    outcome: true
  };

  it('should render modal when open', () => {
    const onClose = vi.fn();
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Market Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Seattle/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={false}
        onClose={onClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display settled market info', () => {
    render(
      <MarketSummaryModal
        market={mockMarket}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/YES Won/i)).toBeInTheDocument();
    expect(screen.getByText(/68°F/i)).toBeInTheDocument(); // Observed temp
    expect(screen.getByText(/≥65°F/i)).toBeInTheDocument(); // Threshold
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test market-summary-modal.test.tsx`
Expected: FAIL with "Cannot find module '../market-summary-modal'"

**Step 3: Write minimal implementation**

Create `apps/web/src/components/markets/market-summary-modal.tsx`:

```typescript
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Market } from '@weatherb/shared/types/market';
import type { UserPosition } from '@/types/positions';
import { calculateMarketSummary } from '@/lib/market-summary-utils';
import { SettledMarketSummaryView } from './settled-market-summary';
import { LiveMarketSummaryView } from './live-market-summary';
import { cn } from '@/lib/utils';

type MarketSummaryModalProps = {
  market: Market | null;
  isOpen: boolean;
  onClose: () => void;
  userPosition?: UserPosition;
  feePercentage?: number;
};

export function MarketSummaryModal({
  market,
  isOpen,
  onClose,
  userPosition,
  feePercentage = 0.01
}: MarketSummaryModalProps) {
  if (!isOpen || !market) return null;

  const summary = calculateMarketSummary(market, feePercentage);
  const summaryWithUser = {
    ...summary,
    userPosition
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className={cn(
            "px-6 py-4 border-b border-gray-100",
            "bg-gradient-to-r",
            summary.type === 'settled'
              ? summary.winnerSide === 'YES'
                ? "from-emerald-50 to-emerald-100"
                : summary.winnerSide === 'NO'
                ? "from-rose-50 to-rose-100"
                : "from-amber-50 to-amber-100"
              : "from-sky-50 to-sky-100"
          )}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Market Summary
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            {summary.type === 'settled' ? (
              <SettledMarketSummaryView summary={summaryWithUser as any} />
            ) : (
              <LiveMarketSummaryView summary={summaryWithUser as any} />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test market-summary-modal.test.tsx`
Expected: FAIL (missing sub-components, but main component exists)

**Step 5: Commit**

```bash
git add apps/web/src/components/markets/market-summary-modal.tsx apps/web/src/components/markets/__tests__/market-summary-modal.test.tsx
git commit -m "feat: add MarketSummaryModal base component"
```

---

## Task 4: Create Settled Market Summary View

**Files:**
- Create: `apps/web/src/components/markets/settled-market-summary.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/markets/__tests__/settled-market-summary.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettledMarketSummaryView } from '../settled-market-summary';
import type { SettledMarketSummary } from '@/types/market-summary';
import type { Market } from '@weatherb/shared/types/market';

describe('SettledMarketSummaryView', () => {
  const mockMarket: Market = {
    id: '1',
    cityId: 'seattle',
    cityName: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    resolveTime: 1735344000,
    thresholdF_tenths: 650,
    currency: 'FLR',
    status: 'resolved',
    yesPool: BigInt(100e18),
    noPool: BigInt(50e18),
    resolvedTempF_tenths: 680,
    observedTimestamp: 1735344100,
    outcome: true
  };

  const mockSummary: SettledMarketSummary = {
    type: 'settled',
    market: mockMarket,
    totalPool: BigInt(150e18),
    winningPool: BigInt(100e18),
    losingPool: BigInt(50e18),
    winnerSide: 'YES',
    feeAmount: BigInt(0.5e18),
    winningPoolPercentage: 66.67
  };

  it('should display market question', () => {
    render(<SettledMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/Will Seattle hit ≥65°F/i)).toBeInTheDocument();
  });

  it('should display outcome', () => {
    render(<SettledMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText('YES Won')).toBeInTheDocument();
  });

  it('should display temperature data', () => {
    render(<SettledMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText('65°F')).toBeInTheDocument(); // Threshold
    expect(screen.getByText('68°F')).toBeInTheDocument(); // Observed
  });

  it('should display pool statistics', () => {
    render(<SettledMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/100.*FLR/)).toBeInTheDocument(); // YES pool
    expect(screen.getByText(/50.*FLR/)).toBeInTheDocument(); // NO pool
    expect(screen.getByText(/150.*FLR/)).toBeInTheDocument(); // Total pool
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test settled-market-summary.test.tsx`
Expected: FAIL with "Cannot find module '../settled-market-summary'"

**Step 3: Write minimal implementation**

Create `apps/web/src/components/markets/settled-market-summary.tsx`:

```typescript
'use client';

import { formatEther } from 'viem';
import {
  Thermometer,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import type { SettledMarketSummary } from '@/types/market-summary';
import { formatTemperatureDisplay, getMarketQuestion, getOutcomeMessage } from '@/lib/market-summary-utils';
import { cn } from '@/lib/utils';

type SettledMarketSummaryViewProps = {
  summary: SettledMarketSummary;
};

export function SettledMarketSummaryView({ summary }: SettledMarketSummaryViewProps) {
  const { market, winningPool, losingPool, totalPool, winnerSide, feeAmount, winningPoolPercentage, userPosition } = summary;

  const question = getMarketQuestion(
    market.cityName,
    market.thresholdF_tenths,
    new Date(market.resolveTime * 1000)
  );

  const outcomeMessage = getOutcomeMessage(market.status, market.outcome);

  const formatPool = (amount: bigint) => {
    const value = Number(formatEther(amount));
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const outcomeIcon = winnerSide === 'YES'
    ? <CheckCircle className="w-5 h-5 text-emerald-600" />
    : winnerSide === 'NO'
    ? <XCircle className="w-5 h-5 text-rose-600" />
    : <AlertCircle className="w-5 h-5 text-amber-600" />;

  const outcomeColor = winnerSide === 'YES'
    ? 'text-emerald-600 bg-emerald-50'
    : winnerSide === 'NO'
    ? 'text-rose-600 bg-rose-50'
    : 'text-amber-600 bg-amber-50';

  return (
    <div className="p-6 space-y-6">
      {/* Market Question */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">{question}</h3>
        <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold", outcomeColor)}>
          {outcomeIcon}
          <span>{outcomeMessage}</span>
        </div>
      </div>

      {/* Temperature Data */}
      {market.status === 'resolved' || market.status === 'noWinners' ? (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-gray-600">
            <Thermometer className="w-4 h-4" />
            <span className="font-medium">Temperature Result</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Threshold</div>
              <div className="text-xl font-bold text-gray-800">
                ≥{formatTemperatureDisplay(market.thresholdF_tenths)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Observed</div>
              <div className="text-xl font-bold text-gray-800">
                {market.resolvedTempF_tenths
                  ? formatTemperatureDisplay(market.resolvedTempF_tenths)
                  : 'N/A'
                }
              </div>
            </div>
          </div>
          {market.observedTimestamp && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                <span>
                  Observed at {new Date(market.observedTimestamp * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Pool Statistics */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-600">
          <DollarSign className="w-4 h-4" />
          <span className="font-medium">Pool Distribution</span>
        </div>

        <div className="space-y-3">
          {/* YES Pool */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-gray-600">YES Pool</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">{formatPool(market.yesPool)} FLR</div>
              {winnerSide === 'YES' && (
                <div className="text-xs text-emerald-600">Won</div>
              )}
            </div>
          </div>

          {/* NO Pool */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-sm font-medium text-gray-600">NO Pool</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">{formatPool(market.noPool)} FLR</div>
              {winnerSide === 'NO' && (
                <div className="text-xs text-rose-600">Won</div>
              )}
            </div>
          </div>

          {/* Total Pool */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total Pool</span>
              <div className="font-bold text-gray-800">{formatPool(totalPool)} FLR</div>
            </div>
          </div>

          {/* Fee if applicable */}
          {feeAmount > BigInt(0) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Protocol Fee (1%)</span>
              <span className="text-gray-600">{formatPool(feeAmount)} FLR</span>
            </div>
          )}
        </div>

        {/* Winning percentage bar */}
        {winnerSide !== 'NONE' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>YES {Math.round(winnerSide === 'YES' ? winningPoolPercentage : 100 - winningPoolPercentage)}%</span>
              <span>NO {Math.round(winnerSide === 'NO' ? winningPoolPercentage : 100 - winningPoolPercentage)}%</span>
            </div>
            <div className="h-2 bg-rose-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${winnerSide === 'YES' ? winningPoolPercentage : 100 - winningPoolPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* User Position (if provided) */}
      {userPosition && (
        <div className="bg-sky-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sky-700">
            <Users className="w-4 h-4" />
            <span className="font-medium">Your Position</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Bet Side</div>
              <div className={cn(
                "font-bold text-lg",
                userPosition.betSide === 'YES' ? 'text-emerald-600' : 'text-rose-600'
              )}>
                {userPosition.betSide}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Bet Amount</div>
              <div className="font-bold text-lg text-gray-800">
                {formatPool(userPosition.betAmount)} FLR
              </div>
            </div>
          </div>

          {userPosition.claimableAmount && userPosition.claimableAmount > BigInt(0) && (
            <div className="mt-4 pt-4 border-t border-sky-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Claimable</span>
                <div className="text-right">
                  <div className="font-bold text-lg text-emerald-600">
                    {formatPool(userPosition.claimableAmount)} FLR
                  </div>
                  {userPosition.multiplier && (
                    <div className="text-xs text-gray-500">
                      {userPosition.multiplier.toFixed(2)}x multiplier
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status badge */}
          <div className="mt-3">
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              userPosition.status === 'won' ? 'bg-emerald-100 text-emerald-800' :
              userPosition.status === 'lost' ? 'bg-rose-100 text-rose-800' :
              userPosition.status === 'claimed' ? 'bg-gray-100 text-gray-800' :
              userPosition.status === 'claimable' ? 'bg-amber-100 text-amber-800' :
              userPosition.status === 'refundable' ? 'bg-sky-100 text-sky-800' :
              'bg-gray-100 text-gray-600'
            )}>
              {userPosition.status.charAt(0).toUpperCase() + userPosition.status.slice(1)}
            </span>
          </div>
        </div>
      )}

      {/* Transaction Hash (if available) */}
      {market.resolutionTxHash && (
        <div className="text-center">
          <a
            href={`https://flare-explorer.flare.network/tx/${market.resolutionTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 hover:underline"
          >
            View transaction
            <TrendingUp className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test settled-market-summary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/markets/settled-market-summary.tsx apps/web/src/components/markets/__tests__/settled-market-summary.test.tsx
git commit -m "feat: add SettledMarketSummaryView component"
```

---

## Task 5: Create Live Market Summary View

**Files:**
- Create: `apps/web/src/components/markets/live-market-summary.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/markets/__tests__/live-market-summary.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMarketSummaryView } from '../live-market-summary';
import type { LiveMarketSummary } from '@/types/market-summary';
import type { Market } from '@weatherb/shared/types/market';

describe('LiveMarketSummaryView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-27T12:00:00Z'));
  });

  const mockMarket: Market = {
    id: '2',
    cityId: 'miami',
    cityName: 'Miami',
    latitude: 25.7617,
    longitude: -80.1918,
    resolveTime: 1735390800, // Dec 28, 2024 13:00:00 UTC
    thresholdF_tenths: 850,
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt(200e18),
    noPool: BigInt(300e18)
  };

  const mockSummary: LiveMarketSummary = {
    type: 'live',
    market: mockMarket,
    totalPool: BigInt(500e18),
    bettingDeadline: 1735390200, // 10 min before resolve
    timeUntilClose: 86400, // 24 hours
    timeUntilResolve: 87000, // 24h 10min
    impliedProbability: { yes: 40, no: 60 },
    currentMultiplier: { yes: 2.5, no: 1.67 }
  };

  it('should display market question', () => {
    render(<LiveMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/Will Miami hit ≥85°F/i)).toBeInTheDocument();
  });

  it('should display current status', () => {
    render(<LiveMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/Open for Betting/i)).toBeInTheDocument();
  });

  it('should display current pools and odds', () => {
    render(<LiveMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/200.*FLR/)).toBeInTheDocument(); // YES pool
    expect(screen.getByText(/300.*FLR/)).toBeInTheDocument(); // NO pool
    expect(screen.getByText(/40%/)).toBeInTheDocument(); // YES probability
    expect(screen.getByText(/60%/)).toBeInTheDocument(); // NO probability
    expect(screen.getByText(/2.50x/)).toBeInTheDocument(); // YES multiplier
    expect(screen.getByText(/1.67x/)).toBeInTheDocument(); // NO multiplier
  });

  it('should display countdown timer', () => {
    render(<LiveMarketSummaryView summary={mockSummary} />);

    expect(screen.getByText(/Betting closes in/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolves at/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test live-market-summary.test.tsx`
Expected: FAIL with "Cannot find module '../live-market-summary'"

**Step 3: Write minimal implementation**

Create `apps/web/src/components/markets/live-market-summary.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import {
  Clock,
  TrendingUp,
  Activity,
  DollarSign,
  Users,
  Thermometer
} from 'lucide-react';
import type { LiveMarketSummary } from '@/types/market-summary';
import { formatTemperatureDisplay, getMarketQuestion } from '@/lib/market-summary-utils';
import { cn } from '@/lib/utils';

type LiveMarketSummaryViewProps = {
  summary: LiveMarketSummary;
};

export function LiveMarketSummaryView({ summary }: LiveMarketSummaryViewProps) {
  const { market, totalPool, bettingDeadline, timeUntilClose, timeUntilResolve, impliedProbability, currentMultiplier, userPosition } = summary;

  const [timeLeft, setTimeLeft] = useState({
    close: timeUntilClose,
    resolve: timeUntilResolve
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      const closeTime = Math.max(0, bettingDeadline - now);
      const resolveTime = Math.max(0, market.resolveTime - now);

      setTimeLeft({
        close: closeTime,
        resolve: resolveTime
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bettingDeadline, market.resolveTime]);

  const question = getMarketQuestion(
    market.cityName,
    market.thresholdF_tenths,
    new Date(market.resolveTime * 1000)
  );

  const formatPool = (amount: bigint) => {
    const value = Number(formatEther(amount));
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Closed';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const isOpen = market.status === 'open' && timeLeft.close > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Market Question */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">{question}</h3>
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium",
          isOpen ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        )}>
          <Activity className="w-4 h-4" />
          <span>{isOpen ? 'Open for Betting' : 'Betting Closed'}</span>
        </div>
      </div>

      {/* Countdown Timers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Betting Closes In</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {formatTime(timeLeft.close)}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Resolves At</span>
          </div>
          <div className="text-lg font-bold text-gray-800">
            {new Date(market.resolveTime * 1000).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>

      {/* Current Odds & Pools */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <TrendingUp className="w-4 h-4" />
          <span className="font-medium">Current Market Odds</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* YES Side */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-bold text-emerald-600">YES</span>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded">
                {currentMultiplier.yes.toFixed(2)}x
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Pool Size</div>
                <div className="font-bold text-gray-800">{formatPool(market.yesPool)} FLR</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Implied Probability</div>
                <div className="font-semibold text-gray-700">{impliedProbability.yes}%</div>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${impliedProbability.yes}%` }}
                />
              </div>
            </div>
          </div>

          {/* NO Side */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-bold text-rose-600">NO</span>
              <span className="px-2 py-1 bg-rose-50 text-rose-700 text-sm font-medium rounded">
                {currentMultiplier.no.toFixed(2)}x
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-gray-500">Pool Size</div>
                <div className="font-bold text-gray-800">{formatPool(market.noPool)} FLR</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Implied Probability</div>
                <div className="font-semibold text-gray-700">{impliedProbability.no}%</div>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${impliedProbability.no}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Total Pool */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Pool</span>
            <div className="font-bold text-xl text-gray-800">{formatPool(totalPool)} FLR</div>
          </div>
        </div>
      </div>

      {/* Market Details */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-600">
          <Thermometer className="w-4 h-4" />
          <span className="font-medium">Market Details</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Temperature Threshold</div>
            <div className="text-lg font-bold text-gray-800">
              ≥{formatTemperatureDisplay(market.thresholdF_tenths)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Location</div>
            <div className="text-lg font-bold text-gray-800">{market.cityName}</div>
            <div className="text-xs text-gray-500">
              {market.latitude.toFixed(2)}°, {market.longitude.toFixed(2)}°
            </div>
          </div>
        </div>
      </div>

      {/* User Position (if provided) */}
      {userPosition && (
        <div className="bg-sky-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sky-700">
            <Users className="w-4 h-4" />
            <span className="font-medium">Your Position</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Bet Side</div>
              <div className={cn(
                "font-bold text-lg",
                userPosition.betSide === 'YES' ? 'text-emerald-600' : 'text-rose-600'
              )}>
                {userPosition.betSide}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Bet Amount</div>
              <div className="font-bold text-lg text-gray-800">
                {formatPool(userPosition.betAmount)} FLR
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Est. Payout</div>
              <div className="font-bold text-lg text-gray-800">
                {formatPool(
                  BigInt(Math.floor(Number(userPosition.betAmount) * (userPosition.betSide === 'YES' ? currentMultiplier.yes : currentMultiplier.no)))
                )} FLR
              </div>
              <div className="text-xs text-gray-500">
                if you win
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test live-market-summary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/markets/live-market-summary.tsx apps/web/src/components/markets/__tests__/live-market-summary.test.tsx
git commit -m "feat: add LiveMarketSummaryView component"
```

---

## Task 6: Integrate Modal into Past Markets Dropdown

**Files:**
- Modify: `apps/web/src/components/home/home-client.tsx:200-350`

**Step 1: Write the failing test**

Create `apps/web/src/components/home/__tests__/past-markets-integration.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomeClient } from '../home-client';

vi.mock('@/lib/contract-data', () => ({
  getAllMarkets: vi.fn(() => Promise.resolve([]))
}));

describe('Past markets modal integration', () => {
  it('should open market summary modal when clicking on past market', async () => {
    const mockMarkets = [
      {
        id: '1',
        cityName: 'Seattle',
        thresholdF_tenths: 650,
        status: 'resolved',
        resolveTime: Date.now() / 1000 - 3600,
        outcome: true,
        yesPool: BigInt(100e18),
        noPool: BigInt(50e18)
      }
    ];

    const { getAllMarkets } = await import('@/lib/contract-data');
    vi.mocked(getAllMarkets).mockResolvedValue(mockMarkets as any);

    render(<HomeClient />);

    // Open past markets
    const showButton = screen.getByText(/Show Past Markets/i);
    fireEvent.click(showButton);

    await waitFor(() => {
      expect(screen.getByText(/Seattle/i)).toBeInTheDocument();
    });

    // Click on market
    const marketCard = screen.getByText(/Seattle/i).closest('div');
    fireEvent.click(marketCard!);

    // Check modal opened
    await waitFor(() => {
      expect(screen.getByText(/Market Summary/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test past-markets-integration.test.tsx`
Expected: FAIL (modal not integrated)

**Step 3: Modify home-client.tsx to add modal integration**

Edit `apps/web/src/components/home/home-client.tsx` (around lines 200-350):

```typescript
// Add these imports at the top
import { MarketSummaryModal } from '@/components/markets/market-summary-modal';

// In the HomeClient component, add state for modal (around line 80)
const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);

// Add click handler function (around line 150)
const handleMarketClick = (market: Market) => {
  setSelectedMarket(market);
  setIsModalOpen(true);
};

// Modify the past markets cards to be clickable (around line 280-300)
// Replace the existing market card div with:
<motion.div
  key={market.id}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }}
  className="p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-gray-200"
  onClick={() => handleMarketClick(market)}
>
  {/* Existing market card content */}
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <h4 className="font-semibold text-gray-800 mb-1">
        {market.cityName}
      </h4>
      <div className="text-sm text-gray-600 space-y-1">
        <div>Threshold: ≥{Math.round(market.thresholdF_tenths / 10)}°F</div>
        <div className={cn(
          "font-medium",
          market.status === 'resolved' ? (
            market.outcome ? "text-emerald-600" : "text-rose-600"
          ) : market.status === 'cancelled' ? "text-gray-500" : "text-amber-600"
        )}>
          {market.status === 'resolved' ? (
            market.outcome ? "YES Won" : "NO Won"
          ) : market.status === 'cancelled' ? "Cancelled" : "Settled (No Winners)"}
        </div>
      </div>
    </div>
    <div className="text-right text-sm text-gray-500">
      <div>{new Date(market.resolveTime * 1000).toLocaleDateString()}</div>
      {market.resolvedTempF_tenths && (
        <div className="mt-1 font-medium text-gray-700">
          {Math.round(market.resolvedTempF_tenths / 10)}°F observed
        </div>
      )}
    </div>
  </div>
</motion.div>

// Add the modal at the bottom of the component (before the closing fragment)
<MarketSummaryModal
  market={selectedMarket}
  isOpen={isModalOpen}
  onClose={() => {
    setIsModalOpen(false);
    setSelectedMarket(null);
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test past-markets-integration.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/home/home-client.tsx apps/web/src/components/home/__tests__/past-markets-integration.test.tsx
git commit -m "feat: integrate market summary modal into past markets dropdown"
```

---

## Task 7: Integrate Modal into Positions Page

**Files:**
- Modify: `apps/web/src/app/positions/page.tsx`
- Modify: `apps/web/src/components/positions/position-card.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/app/positions/__tests__/positions-modal-integration.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PositionsPage from '../page';

vi.mock('@/lib/positions', () => ({
  getUserPositions: vi.fn(),
  getUserStats: vi.fn()
}));

describe('Positions page modal integration', () => {
  it('should open market summary modal with user position data', async () => {
    const mockPosition = {
      marketId: '1',
      cityName: 'Seattle',
      thresholdTenths: 650,
      resolveTime: Date.now() / 1000 - 3600,
      betSide: 'YES',
      betAmount: BigInt(10e18),
      status: 'won',
      claimableAmount: BigInt(25e18)
    };

    const { getUserPositions, getUserStats } = await import('@/lib/positions');
    vi.mocked(getUserPositions).mockResolvedValue([mockPosition] as any);
    vi.mocked(getUserStats).mockResolvedValue({ totalBets: 1 } as any);

    render(<PositionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Seattle/i)).toBeInTheDocument();
    });

    // Click on position card
    const viewDetailsButton = screen.getByText(/View Details/i);
    fireEvent.click(viewDetailsButton);

    // Check modal opened with user data
    await waitFor(() => {
      expect(screen.getByText(/Market Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Your Position/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test positions-modal-integration.test.tsx`
Expected: FAIL (no View Details button)

**Step 3: Add View Details button to position-card.tsx**

Edit `apps/web/src/components/positions/position-card.tsx`:

```typescript
// Add prop for onViewDetails
type PositionCardProps = {
  position: SerializedUserPosition;
  onClaim: (position: SerializedUserPosition) => void;
  onViewDetails: (position: SerializedUserPosition) => void; // New prop
};

export function PositionCard({ position, onClaim, onViewDetails }: PositionCardProps) {
  // ... existing code ...

  // Add View Details button in the card actions area (around line 150-180)
  // After the existing Claim/Refund button, add:
  <button
    onClick={() => onViewDetails(position)}
    className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
  >
    View Details
  </button>
}
```

**Step 4: Integrate modal into positions page**

Edit `apps/web/src/app/positions/page.tsx`:

```typescript
// Add imports
import { MarketSummaryModal } from '@/components/markets/market-summary-modal';
import { getAllMarkets } from '@/lib/contract-data';

// Add state for modal (around line 50)
const [selectedPosition, setSelectedPosition] = useState<SerializedUserPosition | null>(null);
const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);

// Add handler for view details (around line 100)
const handleViewDetails = async (position: SerializedUserPosition) => {
  setSelectedPosition(position);

  // Fetch full market data
  const markets = await getAllMarkets();
  const market = markets.find(m => m.id === position.marketId);

  if (market) {
    setSelectedMarket(market);
    setIsModalOpen(true);
  }
};

// Update PositionCard usage (around line 250)
<PositionCard
  key={position.marketId}
  position={position}
  onClaim={handleClaim}
  onViewDetails={handleViewDetails}
/>

// Add modal at the bottom (before closing div)
<MarketSummaryModal
  market={selectedMarket}
  isOpen={isModalOpen}
  onClose={() => {
    setIsModalOpen(false);
    setSelectedMarket(null);
    setSelectedPosition(null);
  }}
  userPosition={selectedPosition ? {
    marketId: selectedPosition.marketId,
    cityName: selectedPosition.cityName,
    thresholdTenths: selectedPosition.thresholdTenths,
    resolveTime: selectedPosition.resolveTime,
    betSide: selectedPosition.betSide as 'YES' | 'NO',
    betAmount: BigInt(selectedPosition.betAmount),
    status: selectedPosition.status as any,
    claimableAmount: selectedPosition.claimableAmount ? BigInt(selectedPosition.claimableAmount) : undefined,
    multiplier: selectedPosition.multiplier
  } : undefined}
/>
```

**Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test positions-modal-integration.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/app/positions/page.tsx apps/web/src/components/positions/position-card.tsx apps/web/src/app/positions/__tests__/positions-modal-integration.test.tsx
git commit -m "feat: integrate market summary modal into positions page"
```

---

## Task 8: Integrate Modal into Admin Panel

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/app/admin/(dashboard)/markets/__tests__/admin-modal-integration.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketsClient } from '../markets-client';

describe('Admin panel modal integration', () => {
  it('should open market summary modal from admin panel', async () => {
    const mockMarkets = [
      {
        id: '1',
        cityName: 'Seattle',
        thresholdF_tenths: 650,
        status: 'resolved',
        resolveTime: Date.now() / 1000 - 3600,
        outcome: true,
        yesPool: BigInt(100e18),
        noPool: BigInt(50e18)
      }
    ];

    render(<MarketsClient initialMarkets={mockMarkets as any} />);

    // Click on view details button
    const viewButton = screen.getByText(/View Details/i);
    fireEvent.click(viewButton);

    // Check modal opened
    await waitFor(() => {
      expect(screen.getByText(/Market Summary/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test admin-modal-integration.test.tsx`
Expected: FAIL (no View Details button)

**Step 3: Add View Details to admin panel**

Edit `apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx`:

```typescript
// Add import
import { MarketSummaryModal } from '@/components/markets/market-summary-modal';

// Add state for modal (around line 30)
const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);

// Add handler (around line 60)
const handleViewDetails = (market: Market) => {
  setSelectedMarket(market);
  setIsModalOpen(true);
};

// Add View Details button to market cards (both active and past sections)
// In the active markets section (around line 180):
<button
  onClick={() => handleViewDetails(market)}
  className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
>
  View Details
</button>

// In the past markets section (around line 280):
<button
  onClick={() => handleViewDetails(market)}
  className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
>
  View Details
</button>

// Add modal at the bottom (before closing div)
<MarketSummaryModal
  market={selectedMarket}
  isOpen={isModalOpen}
  onClose={() => {
    setIsModalOpen(false);
    setSelectedMarket(null);
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test admin-modal-integration.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx apps/web/src/app/admin/(dashboard)/markets/__tests__/admin-modal-integration.test.tsx
git commit -m "feat: integrate market summary modal into admin panel"
```

---

## Task 9: Add Loading States and Error Handling

**Files:**
- Modify: `apps/web/src/components/markets/market-summary-modal.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/components/markets/__tests__/modal-loading-error.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketSummaryModal } from '../market-summary-modal';

describe('Modal loading and error states', () => {
  it('should show loading state when market data is loading', () => {
    render(
      <MarketSummaryModal
        market={null}
        isOpen={true}
        onClose={() => {}}
        isLoading={true}
      />
    );

    expect(screen.getByText(/Loading market data/i)).toBeInTheDocument();
  });

  it('should show error state when there is an error', () => {
    render(
      <MarketSummaryModal
        market={null}
        isOpen={true}
        onClose={() => {}}
        error="Failed to load market data"
      />
    );

    expect(screen.getByText(/Failed to load market data/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test modal-loading-error.test.tsx`
Expected: FAIL (no loading/error props)

**Step 3: Add loading and error states to modal**

Edit `apps/web/src/components/markets/market-summary-modal.tsx`:

```typescript
// Update props type
type MarketSummaryModalProps = {
  market: Market | null;
  isOpen: boolean;
  onClose: () => void;
  userPosition?: UserPosition;
  feePercentage?: number;
  isLoading?: boolean;
  error?: string;
};

// Update component
export function MarketSummaryModal({
  market,
  isOpen,
  onClose,
  userPosition,
  feePercentage = 0.01,
  isLoading = false,
  error
}: MarketSummaryModalProps) {
  if (!isOpen) return null;

  // Show loading state
  if (isLoading) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
              <p className="text-gray-600">Loading market data...</p>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Show error state
  if (error || !market) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white rounded-2xl p-8 shadow-2xl max-w-md"
          >
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="w-12 h-12 text-rose-500" />
              <p className="text-gray-800 font-semibold">Error Loading Market</p>
              <p className="text-gray-600 text-center">{error || 'Market data not available'}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Rest of the existing implementation...
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test modal-loading-error.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/markets/market-summary-modal.tsx apps/web/src/components/markets/__tests__/modal-loading-error.test.tsx
git commit -m "feat: add loading and error states to market summary modal"
```

---

## Task 10: Final Build Verification

**Step 1: Run all tests**

```bash
cd apps/web && pnpm test
```
Expected: All tests PASS

**Step 2: Build the project**

```bash
pnpm build
```
Expected: Build completes without errors

**Step 3: Run type check**

```bash
pnpm exec tsc --noEmit
```
Expected: No type errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete market summary modal implementation"
```

---

## Summary

This plan implements a comprehensive market summary modal system that:

1. **Creates reusable modal component** with Framer Motion animations
2. **Displays different views** for settled vs live markets
3. **Shows user-specific data** when viewing from positions page
4. **Integrates seamlessly** with existing UI in three locations:
   - Past markets dropdown (home page)
   - Positions page
   - Admin panel
5. **Handles loading and error states** gracefully
6. **Follows TDD principles** with tests written first
7. **Uses existing patterns** from the codebase
8. **Provides comprehensive market information** including pools, odds, outcomes, and user positions

The implementation follows WeatherB's existing design patterns, uses consistent styling, and integrates smoothly with the current data fetching architecture.

## Next Steps

After implementation, consider:
- Adding analytics to track modal views
- Implementing social sharing from modal
- Adding historical price charts for markets
- Including weather forecast confidence scores
- Adding export functionality for market data