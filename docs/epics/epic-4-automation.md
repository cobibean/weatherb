# Epic 4 — Automation Services

> **Goal:** Build the scheduler (creates markets daily) and settler (resolves markets via FDC proofs) that run the platform autonomously.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deployment | **Railway** | Simple, supports cron, good DX |
| Queue | **BullMQ + Redis** | Mature, retries, job scheduling |
| Language | **TypeScript** | Consistent with rest of stack |
| Scheduling | **Cron + event-driven** | Cron for daily creation, events for settlement |
| Market creation time | **Midnight UTC (configurable)** | Default cadence; shiftable based on usage/oracle behavior |

---

## ✅ User Decisions Locked

- **Daily market creation:** Default midnight UTC. Make `schedule_time_utc` configurable to adjust without redeploy.
- **Operational logging:** Persist `create_time_utc` and `resolve_time_utc` per market for auditability.

> Still pending: retry/alerting decisions (leave configurable defaults until answered).

---

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │    │    Settler      │
│   (Cron Job)    │    │  (Event-driven) │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
    ┌─────────┐           ┌─────────┐
    │  Redis  │◄──────────│  Redis  │
    │ (Queue) │           │ (Queue) │
    └────┬────┘           └────┬────┘
         │                     │
         ▼                     ▼
    ┌─────────────────────────────────┐
    │        Flare Blockchain          │
    │    (WeatherMarket Contract)      │
    └─────────────────────────────────┘
```

---

## 4A) Market Scheduler Service

### Daily Flow

1. Run at configured time (e.g., 00:00 UTC)
2. Check provider health — abort if red
3. Select 5 market configurations for the day
4. For each market:
   - Get forecast temperature
   - Calculate threshold (round to whole °F)
   - Calculate resolve time based on cadence
   - Submit `createMarket()` transaction
5. Log success/failure for each

### Code Structure

```typescript
// services/scheduler/src/index.ts

import { CronJob } from 'cron';
import { Queue } from 'bullmq';
import { createMarket } from './create-market';
import { selectMarketsForDay } from './market-selector';
import { weatherProvider } from '@weatherb/shared/providers';

const marketQueue = new Queue('market-creation', { connection: redis });

// Daily job at configurable time (default: midnight UTC)
const dailyJob = new CronJob(process.env.SCHEDULE_TIME_CRON ?? '0 0 * * *', async () => {
  console.log('[Scheduler] Starting daily market creation');
  
  // Health check
  const health = await weatherProvider.healthCheck();
  if (health.status === 'red') {
    console.error('[Scheduler] Provider down, skipping market creation');
    await alertAdmin('Provider down - market creation skipped');
    return;
  }
  
  // Select markets for today
  const marketConfigs = await selectMarketsForDay();
  
  // Queue each market creation
  for (const config of marketConfigs) {
    await marketQueue.add('create', config, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
});

dailyJob.start();
```

### Market Selection Logic

```typescript
// services/scheduler/src/market-selector.ts

interface MarketConfig {
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: number;
  forecastTemp: number;
}

export async function selectMarketsForDay(): Promise<MarketConfig[]> {
  const cities = await getActiveCities(); // From DB/config
  const cadenceMinutes = await getCadenceConfig(); // Default: 5
  const marketsPerDay = 5;
  
  const configs: MarketConfig[] = [];
  const now = Date.now();
  const dayStart = startOfDay(now);
  
  // Distribute 5 markets across the day
  for (let i = 0; i < marketsPerDay; i++) {
    const city = cities[i % cities.length]; // Round-robin cities
    const resolveTime = dayStart + (i + 1) * (24 * 60 / marketsPerDay) * 60 * 1000;
    
    const forecast = await weatherProvider.getForecast(
      city.latitude,
      city.longitude,
      resolveTime
    );
    
    configs.push({
      cityId: city.id,
      cityName: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      resolveTime,
      forecastTemp: forecast,
    });
  }
  
  return configs;
}
```

---

## 4B) Settlement Bot Service

### Settlement Flow

1. Poll for markets past resolve time
2. For each unresolved market:
   - Fetch weather reading from provider
   - Request FDC attestation
   - Wait for proof
   - Call `resolveMarket()` on contract
3. Handle failures with retry/cancel logic

### Code Structure

```typescript
// services/settler/src/index.ts

import { Worker } from 'bullmq';
import { settlementQueue } from './queue';
import { resolveMarket } from './resolve';
import { fetchPendingMarkets } from './fetch-markets';

// Poll for markets needing settlement every minute
setInterval(async () => {
  const pendingMarkets = await fetchPendingMarkets();
  
  for (const market of pendingMarkets) {
    if (Date.now() >= market.resolveTime * 1000) {
      await settlementQueue.add('settle', { marketId: market.id }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        jobId: `settle-${market.id}`, // Prevent duplicates
      });
    }
  }
}, 60_000);

// Process settlement jobs
const worker = new Worker('settlement', async (job) => {
  const { marketId } = job.data;
  await resolveMarket(marketId);
}, {
  connection: redis,
  concurrency: 3,
});

worker.on('failed', async (job, error) => {
  console.error(`Settlement failed for market ${job?.data.marketId}:`, error);
  
  if (job?.attemptsMade >= 5) {
    // Max retries exceeded - cancel market
    await cancelMarketAndRefund(job.data.marketId);
    await alertAdmin(`Market ${job.data.marketId} cancelled after max retries`);
  }
});
```

---

## 4C) Outage Controller

### Health Check Loop

```typescript
// services/settler/src/outage-controller.ts

let isOutageMode = false;

async function runHealthCheck() {
  const health = await weatherProvider.healthCheck();
  
  if (health.status === 'red' && !isOutageMode) {
    // Enter outage mode
    isOutageMode = true;
    console.error('[Outage] Provider down, entering outage mode');
    
    await pauseMarketCreation();
    await broadcastOutageStatus();
    await cancelEligibleMarkets();
  }
  
  if (health.status === 'green' && isOutageMode) {
    // Exit outage mode
    isOutageMode = false;
    console.log('[Outage] Provider recovered, resuming operations');
    
    await resumeMarketCreation();
    await broadcastRecoveryStatus();
  }
}

// Run every 5 minutes
setInterval(runHealthCheck, 5 * 60 * 1000);
```

---

## Tasks

### 4.1 Set Up Service Infrastructure
- [ ] Create `services/scheduler/` with TypeScript config
- [ ] Create `services/settler/` with TypeScript config
- [ ] Add BullMQ and Redis dependencies
- [ ] Create shared queue configuration
- [ ] Add environment variable handling

### 4.2 Implement Scheduler
- [ ] Create daily cron job
- [ ] Implement market selection logic
- [ ] Implement threshold calculation (forecast → rounded whole °F → tenths)
- [ ] Integrate with contract `createMarket()`
- [ ] Add health check gate

### 4.3 Implement Settler
- [ ] Create market polling logic
- [ ] Implement settlement job queue
- [ ] Integrate FDC client (from Epic 3)
- [ ] Implement retry logic with exponential backoff
- [ ] Implement cancel/refund on max retries

### 4.4 Implement Outage Controller
- [ ] Create health check loop (5-min interval)
- [ ] Implement outage mode state machine
- [ ] Implement market cancellation for outages
- [ ] Implement status broadcast (update DB/API)

### 4.5 Add Monitoring & Alerts
- [ ] Log all operations with structured logging
- [ ] Add alerting on failures (webhook/email)
- [ ] Track metrics: markets created, settlements, failures

### 4.6 Test End-to-End
- [ ] Test scheduler creates markets correctly
- [ ] Test settler resolves markets via FDC
- [ ] Test retry logic on transient failures
- [ ] Test outage mode triggers correctly

---

## Environment Variables

```bash
# Scheduler
SCHEDULER_PRIVATE_KEY=0x...        # For createMarket() calls
DAILY_MARKET_COUNT=5
CADENCE_MINUTES=5
TESTING_MODE=true                   # Single city mode

# Settler  
SETTLER_PRIVATE_KEY=0x...          # For resolveMarket() calls
MAX_SETTLEMENT_RETRIES=5
SETTLEMENT_POLL_INTERVAL_MS=60000

# Shared
REDIS_URL=redis://localhost:6379
CONTRACT_ADDRESS=0x...
RPC_URL=https://coston2-api.flare.network/ext/C/rpc
```

---

## Acceptance Criteria

- [ ] Scheduler creates exactly 5 markets/day
- [ ] Scheduler respects outage mode (no creation when provider down)
- [ ] Settler resolves markets within minutes of resolve time
- [ ] Failed settlements retry with backoff
- [ ] Max retry exceeded → market cancelled + refund
- [ ] Health checks run every 5 minutes
- [ ] Outage mode pauses creation and cancels eligible markets
- [ ] All operations logged for debugging

---

## Dependencies

- **Epic 0:** Service scaffolding
- **Epic 1:** Weather provider adapter
- **Epic 2:** Contract deployed and callable
- **Epic 3:** FDC client for settlement proofs

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Service infrastructure | 3 hours |
| Scheduler implementation | 6 hours |
| Settler implementation | 8 hours |
| Outage controller | 4 hours |
| Monitoring & alerts | 3 hours |
| E2E testing | 4 hours |
| **Total** | **~28 hours** |

