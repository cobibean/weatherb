# Epic 8 Future Enhancements

**Status**: Backlog
**Epic**: Epic 8 - AI-Powered City Approval Workflow

---

## Overview

This document tracks future improvements to Epic 8 that were identified during or after initial implementation but deferred to keep V1 scope manageable.

---

## Enhancement 1: Smart Test Market Scheduling

**Problem**: Currently test markets use fixed offsets (+30m, +1h, +2h, +3h, +4h) which could overlap with production markets in the same city, causing user confusion or data noise.

**Solution**: Intelligent scheduling that avoids conflicts with production markets.

### Implementation Approach

**Option A: Time-based Avoidance**
```typescript
// In createTestMarkets()
async function calculateTestMarketTimes(cityId: string): Promise<Date[]> {
  // Get existing production markets for this city
  const productionMarkets = await db.market.findMany({
    where: {
      cityId,
      isTest: false,
      resolveTime: {
        gte: new Date(),
        lte: new Date(Date.now() + 4 * 60 * 60 * 1000) // Next 4 hours
      }
    },
    select: { resolveTime: true }
  });

  // Generate test times that avoid production market windows
  const testTimes: Date[] = [];
  const baseTime = new Date();
  const intervals = [30, 60, 120, 180, 240]; // minutes

  for (const minutes of intervals) {
    let proposedTime = new Date(baseTime.getTime() + minutes * 60 * 1000);

    // Check if too close to any production market (within 15min buffer)
    const hasConflict = productionMarkets.some(pm =>
      Math.abs(proposedTime.getTime() - pm.resolveTime.getTime()) < 15 * 60 * 1000
    );

    if (hasConflict) {
      // Shift forward by 20 minutes
      proposedTime = new Date(proposedTime.getTime() + 20 * 60 * 1000);
    }

    testTimes.push(proposedTime);
  }

  return testTimes;
}
```

**Option B: Off-peak Scheduling**
```typescript
// Schedule test markets during low-traffic hours
function getOffPeakTestTimes(): Date[] {
  const now = new Date();
  const currentHour = now.getUTCHours();

  // If current time is peak (9am-5pm UTC), schedule for late night
  if (currentHour >= 9 && currentHour <= 17) {
    const tonight = new Date(now);
    tonight.setUTCHours(2, 0, 0, 0); // 2am UTC
    tonight.setDate(tonight.getDate() + 1); // Tomorrow

    return [
      new Date(tonight.getTime() + 0 * 60 * 60 * 1000),   // 2am
      new Date(tonight.getTime() + 1 * 60 * 60 * 1000),   // 3am
      new Date(tonight.getTime() + 2 * 60 * 60 * 1000),   // 4am
      new Date(tonight.getTime() + 3 * 60 * 60 * 1000),   // 5am
      new Date(tonight.getTime() + 4 * 60 * 60 * 1000),   // 6am
    ];
  }

  // Off-peak already, use current flow
  return generateStandardTestTimes();
}
```

**Recommendation**: Start with **Option A** (conflict avoidance) for V2, then add **Option B** (off-peak preference) for V3.

### Files to Modify
- `apps/web/src/lib/test-markets.ts` - Update `createTestMarkets()` function
- `apps/web/src/lib/test-runner.ts` - Pass city context to market creation

### Acceptance Criteria
- [ ] Test markets avoid production markets by ≥15min buffer
- [ ] If conflicts detected, test times shift automatically
- [ ] Logs indicate when scheduling adjustments occur
- [ ] Test window still completes within 4-6 hours max

### Estimated Effort
**3-4 hours** (low complexity, mostly query logic)

---

## Enhancement 2: Live Test Monitoring Dashboard

**Problem**: Admin must wait for email to see test results. No visibility into in-progress tests.

**Solution**: Real-time dashboard in admin panel showing test progress.

### Implementation Approach

**UI Location**: Add 5th tab to `/admin/suggestions` page

**Tab: "Testing (Live)"**

Shows active test runs with real-time updates:

```
┌──────────────────────────────────────────────────────┐
│ Testing: Miami, FL                                   │
│ Started: 2:34 PM (1h 23m ago)                       │
│                                                      │
│ Progress: ████████░░ 3/5 markets settled (60%)      │
│                                                      │
│ Market #1 (+30m) ✅ Settled - YES wins              │
│   Forecast: 72°F | Actual: 74°F                     │
│   Payout: 2.673 FLR ✅ Verified                     │
│                                                      │
│ Market #2 (+1h) ✅ Settled - YES wins (tie)         │
│   Forecast: 73°F | Actual: 73°F                     │
│   Payout: 5.544 FLR ✅ Verified                     │
│                                                      │
│ Market #3 (+2h) ✅ Settled - NO wins                │
│   Forecast: 76°F | Actual: 74°F                     │
│   Payout: 10.089 FLR ✅ Verified                    │
│                                                      │
│ Market #4 (+3h) ⏳ Pending (resolves in 37m)        │
│   Forecast: 77°F                                     │
│                                                      │
│ Market #5 (+4h) ⏳ Pending (resolves in 1h 37m)     │
│   Forecast: 78°F                                     │
│                                                      │
│ Funds: 24.87 FLR recovered / 25.00 FLR total       │
│                                                      │
│ [VIEW FULL DETAILS] [CANCEL TEST RUN]               │
└──────────────────────────────────────────────────────┘
```

### Technical Implementation

**Backend: Server-Sent Events (SSE)**
```typescript
// apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Poll test run status every 10 seconds
      const interval = setInterval(async () => {
        const testRun = await db.testRun.findUnique({
          where: { id: params.id },
          include: { markets: true }
        });

        if (!testRun) {
          controller.close();
          clearInterval(interval);
          return;
        }

        // Send update
        const data = `data: ${JSON.stringify(testRun)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Close stream if test complete
        if (testRun.status !== 'RUNNING') {
          controller.close();
          clearInterval(interval);
        }
      }, 10000); // 10s polling
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Frontend: React Hook**
```typescript
// apps/web/src/hooks/useTestRunStream.ts
export function useTestRunStream(testRunId: string) {
  const [testRun, setTestRun] = useState<TestRun | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/admin/test-runs/${testRunId}/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTestRun(data);
    };

    return () => eventSource.close();
  }, [testRunId]);

  return testRun;
}
```

**UI Component**
```typescript
// apps/web/src/components/admin/TestRunMonitor.tsx
export function TestRunMonitor({ testRunId }: { testRunId: string }) {
  const testRun = useTestRunStream(testRunId);

  if (!testRun) return <div>Loading...</div>;

  const settledCount = testRun.markets.filter(m => m.isSettled).length;
  const progress = (settledCount / testRun.marketsCreated) * 100;

  return (
    <div className="space-y-4">
      <h3>Testing: {testRun.suggestion.cityName}</h3>

      <Progress value={progress} />
      <p>{settledCount}/{testRun.marketsCreated} markets settled</p>

      {testRun.markets.map((market, i) => (
        <MarketStatusCard key={market.id} market={market} index={i} />
      ))}

      <FundRecoveryStatus testRun={testRun} />
    </div>
  );
}
```

### Files to Create
- `apps/web/src/app/api/admin/test-runs/[id]/stream/route.ts` - SSE endpoint
- `apps/web/src/hooks/useTestRunStream.ts` - React hook for live updates
- `apps/web/src/components/admin/TestRunMonitor.tsx` - Dashboard UI
- `apps/web/src/components/admin/MarketStatusCard.tsx` - Individual market display

### Files to Modify
- `apps/web/src/app/admin/suggestions/page.tsx` - Add "Testing (Live)" tab

### Acceptance Criteria
- [ ] Live updates every 10 seconds while test running
- [ ] Shows per-market status (pending/settled/verified)
- [ ] Displays payout verification results
- [ ] Fund recovery progress visible
- [ ] Auto-refreshes when new markets settle
- [ ] Connection gracefully closes when test completes

### Estimated Effort
**6-8 hours** (moderate complexity, SSE setup + UI)

---

## Enhancement 3: AI Provider Fallback Chain

**Problem**: Single dependency on one AI provider (risk of downtime).

**Solution**: Fallback chain across multiple providers.

### Implementation
```typescript
// lib/ai-analysis.ts
async function generateCityAnalysis(data: AnalysisData): Promise<string> {
  const providers = [
    { name: 'Claude', fn: analyzeWithClaude },
    { name: 'GPT-4', fn: analyzeWithOpenAI },
    { name: 'Gemini', fn: analyzeWithGemini },
  ];

  for (const provider of providers) {
    try {
      return await provider.fn(data);
    } catch (error) {
      console.warn(`${provider.name} failed, trying next provider`);
    }
  }

  // All failed, use generic fallback
  return generateGenericAnalysis(data);
}
```

### Estimated Effort
**4-5 hours**

---

## Enhancement 4: A/B Testing (Soft Launch)

**Problem**: New cities go straight to 100% of users (risky).

**Solution**: Gradual rollout with feature flags.

### Implementation
```typescript
// Promote city to 10% of users first
await db.suggestion.update({
  where: { id },
  data: {
    status: 'LIVE',
    rolloutPercentage: 10 // Start at 10%
  }
});

// After 1 week, admin can increase to 50%, then 100%
```

### Estimated Effort
**8-10 hours** (requires feature flag system)

---

## Enhancement 5: Cancel Test Run Action

**Problem**: Can't stop a test run once started.

**Solution**: Add cancel button that:
- Marks test as CANCELLED
- Sweeps remaining funds immediately
- Deletes test markets
- Sends cancellation email

### Estimated Effort
**3-4 hours**

---

## Prioritization

**High Priority** (Ship in V2):
1. Live Test Monitoring Dashboard - **High value, moderate effort**
2. Smart Test Market Scheduling - **Prevents user confusion**

**Medium Priority** (Ship in V3):
3. AI Provider Fallback Chain - **Reliability improvement**
4. Cancel Test Run Action - **Admin QoL improvement**

**Low Priority** (Future):
5. A/B Testing - **Advanced feature, requires more infrastructure**

---

## Notes

These enhancements were identified during Epic 8 implementation but intentionally deferred to keep V1 scope focused on core functionality. All are valuable but not blockers for initial launch.
