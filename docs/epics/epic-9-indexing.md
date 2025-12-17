# Epic 9 — Indexing + Observability

> **Goal:** Index on-chain events for fast queries and set up monitoring to catch issues before users do.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Indexer approach | **Custom listener + Prisma** | Simple, full control, Flare-compatible |
| Database | **PostgreSQL** | Already using, reliable |
| Monitoring | **Structured logs + webhooks** | Simple for V1, Grafana later |
| Alternative | **Ponder/Envio** | Consider if custom is too slow |

---

## What We're Indexing

| Event | Data Stored | Purpose |
|-------|-------------|---------|
| `MarketCreated` | Market details | Show markets on frontend |
| `BetPlaced` | Bet details | Show positions, calculate pools |
| `MarketResolved` | Outcome, temp | Display results |
| `MarketCancelled` | Status update | Show refund availability |
| `WinningsClaimed` | Claim record | Track who claimed |

---

## Database Schema (Additions)

```prisma
// prisma/schema.prisma

model IndexedMarket {
  id                String        @id // On-chain market ID
  cityId            String
  cityName          String
  latitude          Float
  longitude         Float
  resolveTime       DateTime
  bettingDeadline   DateTime
  thresholdTenths   Int
  currency          String
  status            String        @default("open")
  yesPool           String        // Store as string (BigInt)
  noPool            String
  // Resolution
  resolvedTempTenths Int?
  observedTimestamp  DateTime?
  outcome           Boolean?
  resolutionTxHash  String?
  // Meta
  createdAt         DateTime      @default(now())
  createdTxHash     String
  createdBlock      Int
  updatedAt         DateTime      @updatedAt
  
  bets              IndexedBet[]
}

model IndexedBet {
  id          String        @id @default(cuid())
  marketId    String
  market      IndexedMarket @relation(fields: [marketId], references: [id])
  wallet      String
  side        String        // "yes" or "no"
  amount      String        // BigInt as string
  timestamp   DateTime
  txHash      String
  blockNumber Int
  claimed     Boolean       @default(false)
  claimTxHash String?
  
  @@unique([marketId, wallet]) // One bet per wallet per market
  @@index([wallet])
}

model IndexerState {
  id              String   @id @default("default")
  lastBlockNumber Int      @default(0)
  lastBlockHash   String?
  updatedAt       DateTime @updatedAt
}
```

---

## Indexer Service

```typescript
// services/indexer/src/index.ts

import { createPublicClient, http, parseAbiItem } from 'viem';
import { flareCoston2 } from 'viem/chains';
import { db } from './db';

const client = createPublicClient({
  chain: flareCoston2,
  transport: http(process.env.RPC_URL),
});

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;

async function indexFromBlock(fromBlock: bigint) {
  console.log(`[Indexer] Starting from block ${fromBlock}`);
  
  // Get all events from contract
  const logs = await client.getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock,
    toBlock: 'latest',
  });
  
  for (const log of logs) {
    await processLog(log);
  }
  
  // Update state
  const latestBlock = await client.getBlockNumber();
  await db.indexerState.upsert({
    where: { id: 'default' },
    update: { lastBlockNumber: Number(latestBlock) },
    create: { id: 'default', lastBlockNumber: Number(latestBlock) },
  });
}

async function processLog(log: Log) {
  const eventSignatures = {
    MarketCreated: '0x...', // keccak256 of event signature
    BetPlaced: '0x...',
    MarketResolved: '0x...',
    MarketCancelled: '0x...',
    WinningsClaimed: '0x...',
  };
  
  switch (log.topics[0]) {
    case eventSignatures.MarketCreated:
      await handleMarketCreated(log);
      break;
    case eventSignatures.BetPlaced:
      await handleBetPlaced(log);
      break;
    case eventSignatures.MarketResolved:
      await handleMarketResolved(log);
      break;
    case eventSignatures.MarketCancelled:
      await handleMarketCancelled(log);
      break;
    case eventSignatures.WinningsClaimed:
      await handleWinningsClaimed(log);
      break;
  }
}

async function handleMarketCreated(log: Log) {
  const decoded = decodeEventLog({
    abi: weatherMarketAbi,
    data: log.data,
    topics: log.topics,
  });
  
  await db.indexedMarket.create({
    data: {
      id: decoded.args.marketId.toString(),
      cityId: decoded.args.cityId,
      cityName: await getCityName(decoded.args.cityId),
      resolveTime: new Date(Number(decoded.args.resolveTime) * 1000),
      thresholdTenths: Number(decoded.args.thresholdTenths),
      currency: decoded.args.currency,
      yesPool: '0',
      noPool: '0',
      createdTxHash: log.transactionHash,
      createdBlock: Number(log.blockNumber),
      // ... other fields
    },
  });
}

async function handleBetPlaced(log: Log) {
  const decoded = decodeEventLog({ /* ... */ });
  
  await db.$transaction([
    // Create bet record
    db.indexedBet.create({
      data: {
        marketId: decoded.args.marketId.toString(),
        wallet: decoded.args.bettor.toLowerCase(),
        side: decoded.args.isYes ? 'yes' : 'no',
        amount: decoded.args.amount.toString(),
        timestamp: new Date(),
        txHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
      },
    }),
    // Update pool totals
    db.indexedMarket.update({
      where: { id: decoded.args.marketId.toString() },
      data: decoded.args.isYes
        ? { yesPool: { increment: decoded.args.amount.toString() } }
        : { noPool: { increment: decoded.args.amount.toString() } },
    }),
  ]);
}
```

---

## Real-time Updates

```typescript
// services/indexer/src/realtime.ts

// Watch for new blocks and index immediately
client.watchBlocks({
  onBlock: async (block) => {
    const state = await db.indexerState.findUnique({ where: { id: 'default' } });
    if (block.number > state.lastBlockNumber) {
      await indexFromBlock(BigInt(state.lastBlockNumber + 1));
    }
  },
});
```

---

## Monitoring & Observability

### Structured Logging

```typescript
// packages/shared/src/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

// Usage
logger.info({ marketId: '123', event: 'market_created' }, 'Market created');
logger.error({ error, marketId: '123' }, 'Settlement failed');
```

### Health Endpoints

```typescript
// services/indexer/src/health.ts

app.get('/health', async (req, res) => {
  const state = await db.indexerState.findUnique({ where: { id: 'default' } });
  const currentBlock = await client.getBlockNumber();
  const lag = Number(currentBlock) - state.lastBlockNumber;
  
  res.json({
    status: lag < 10 ? 'healthy' : 'lagging',
    lastIndexedBlock: state.lastBlockNumber,
    currentBlock: Number(currentBlock),
    lag,
  });
});
```

### Alert Webhooks

```typescript
// packages/shared/src/alerts.ts

export async function alertAdmin(message: string, severity: 'info' | 'warn' | 'error' = 'error') {
  // Discord webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `[${severity.toUpperCase()}] ${message}`,
      }),
    });
  }
  
  // Could add email, PagerDuty, etc.
}
```

### Key Metrics to Track

| Metric | Alert Threshold | Description |
|--------|-----------------|-------------|
| Indexer lag | > 10 blocks | Indexer falling behind |
| Settlement queue size | > 5 | Markets waiting too long |
| Failed settlements | Any | Needs investigation |
| Provider health | Red | Weather API down |
| Contract errors | Any | Reverted transactions |

---

## Tasks

### 9.1 Database Schema
- [ ] Add IndexedMarket, IndexedBet, IndexerState models
- [ ] Create migrations
- [ ] Add indexes for common queries

### 9.2 Indexer Service
- [ ] Create service structure
- [ ] Implement block/event polling
- [ ] Handle each event type
- [ ] Store indexer state for restart

### 9.3 Real-time Updates
- [ ] Add block watcher
- [ ] Minimize lag to < 10 blocks
- [ ] Handle reorgs (if relevant on Flare)

### 9.4 API Integration
- [ ] Update web app API routes to use indexed data
- [ ] Fall back to contract reads if indexer behind
- [ ] Add caching layer

### 9.5 Monitoring
- [ ] Add structured logging everywhere
- [ ] Create health endpoints
- [ ] Set up Discord webhook alerts
- [ ] Track key metrics

### 9.6 Dashboard (Optional)
- [ ] Simple stats page in admin
- [ ] Indexer status
- [ ] Settlement queue
- [ ] Error log

---

## Acceptance Criteria

- [ ] All contract events indexed to database
- [ ] Indexer lag < 10 blocks in normal operation
- [ ] Web app loads market data from indexed DB
- [ ] Health endpoint reports accurate status
- [ ] Alerts fire on failures
- [ ] Indexer resumes correctly after restart

---

## Dependencies

- **Epic 0:** Database setup
- **Epic 2:** Contract events defined
- **Needed by Epic 5:** Fast market data queries

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Database schema | 1 hour |
| Indexer service | 6 hours |
| Real-time updates | 2 hours |
| API integration | 2 hours |
| Monitoring | 3 hours |
| **Total** | **~14 hours** |

---

## Alternative: Ponder

If custom indexer is too slow or unreliable, consider [Ponder](https://ponder.sh/):

```typescript
// ponder.config.ts
export const config = {
  networks: { flare: { chainId: 14, transport: http(RPC_URL) } },
  contracts: {
    WeatherMarket: {
      network: 'flare',
      address: CONTRACT_ADDRESS,
      abi: weatherMarketAbi,
      startBlock: DEPLOY_BLOCK,
    },
  },
};
```

Ponder handles reorgs, provides GraphQL API, and scales well. Evaluate after custom solution if needed.

