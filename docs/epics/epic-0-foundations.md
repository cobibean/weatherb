# Epic 0 — Repo + Dev Foundations

> **Goal:** Set up the monorepo, toolchain, CI, and local dev environment so the team can build efficiently.

---

## Status (Implemented)

As of 2025-12-18:

- Monorepo scaffolded with pnpm workspaces (`pnpm-workspace.yaml`, root `package.json`)
- CI workflow implemented as per spec (`.github/workflows/ci.yml`)
- Local infra added (`infra/docker-compose.yml`)
- Frontend/service/shared packages scaffolded (`apps/web`, `services/*`, `packages/shared`)
- Contracts + tests scaffolded (`contracts/*`)

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package manager | **pnpm** | Fast, great workspace support, strict by default |
| Contract framework | **Foundry** | Faster tests, better fuzzing, Solidity-native |
| Frontend framework | **Next.js 14+** | App Router, SSR, good Thirdweb integration |
| Database | **PostgreSQL** | Reliable, concurrent access for indexer |
| ORM | **Prisma** | Type-safe, good migrations, works with Postgres |
| Queue system | **BullMQ + Redis** | Mature, good for scheduled jobs |
| Node version | **20 LTS** | Stable, long-term support |

---

## Folder Structure

```
weatherb/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Lint, test, build checks
├── apps/
│   └── web/                       # Next.js frontend
│       ├── src/
│       │   ├── app/               # App Router pages
│       │   ├── components/        # React components
│       │   ├── hooks/             # Custom hooks
│       │   └── lib/               # Utilities
│       ├── public/
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── package.json
├── contracts/
│   ├── src/
│   │   └── WeatherMarket.sol
│   ├── test/
│   │   └── WeatherMarket.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   ├── foundry.toml
│   └── package.json               # For pnpm workspace
├── services/
│   ├── scheduler/                 # Market creation cron
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── settler/                   # Settlement bot
│       ├── src/
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                    # Shared types, ABIs, utils
│       ├── src/
│       │   ├── types/
│       │   │   ├── market.ts
│       │   │   ├── provider.ts
│       │   │   └── index.ts
│       │   ├── abi/               # Auto-generated from contracts
│       │   ├── constants/
│       │   │   ├── cities.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── infra/
│   ├── docker-compose.yml         # Local Postgres + Redis
│   └── .env.example
├── docs/
│   └── epics/                     # Detailed epic plans
├── .env.example
├── .gitignore
├── .nvmrc
├── pnpm-workspace.yaml
├── turbo.json                     # Optional: Turborepo for builds
├── AGENTS.md
├── PRD.md
├── buildplanoutline.md
└── README.md
```

---

## Tasks

### 0.1 Initialize Monorepo
- [x] Create `pnpm-workspace.yaml`
- [x] Create root `package.json` with workspace scripts
- [x] Add `.nvmrc` with `20`
- [x] Add comprehensive `.gitignore`

### 0.2 Set Up Contracts Package
- [x] Initialize Foundry project in `contracts/`
- [x] Configure `foundry.toml` (Flare chain settings, optimizer)
- [x] Add `WeatherMarket.sol`
- [x] Add Foundry test file
- [x] Add `package.json` for workspace inclusion

### 0.3 Set Up Frontend
- [x] Create Next.js 14+ app in `apps/web/`
- [x] Configure TypeScript strict mode
- [x] Add TailwindCSS + shadcn/ui
- [x] Add Thirdweb SDK
- [x] Configure for Flare network (chain ID: 14, testnet: 114)

### 0.4 Set Up Services
- [x] Create `services/scheduler/` with TypeScript config
- [x] Create `services/settler/` with TypeScript config
- [x] Add shared dev dependencies (tsx, vitest)

### 0.5 Set Up Shared Package
- [x] Create `packages/shared/` structure
- [x] Add base types for Market, Bet, Provider
- [x] Export from barrel file

### 0.6 Set Up Local Dev Environment
- [x] Create `infra/docker-compose.yml` with Postgres + Redis
- [x] Add `.env.example` with all required variables
- [x] Add README with setup instructions

### 0.7 Set Up CI Pipeline
- [x] Create `.github/workflows/ci.yml`
- [x] Jobs:
  - Lint (ESLint + Prettier check)
  - Typecheck (tsc --noEmit)
  - Contract tests (forge test)
  - Unit tests (vitest)
  - Build check (next build)

---

## Shared Types (Initial)

```typescript
// packages/shared/src/types/market.ts

export type MarketStatus = 'open' | 'resolved' | 'cancelled';
export type BetSide = 'yes' | 'no';

export interface Market {
  id: string;
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  resolveTime: number;          // Unix timestamp
  thresholdF_tenths: number;    // 853 = 85.3°F
  currency: string;             // 'FLR' or token address
  status: MarketStatus;
  yesPool: bigint;
  noPool: bigint;
  // Resolution (if resolved)
  resolvedTempF_tenths?: number;
  observedTimestamp?: number;
  outcome?: boolean;            // true = YES won
  resolutionTxHash?: string;
}

export interface Bet {
  marketId: string;
  wallet: string;
  side: BetSide;
  amount: bigint;
  timestamp: number;
}

export interface Position {
  market: Market;
  bet: Bet;
  claimable: boolean;
  winnings?: bigint;
}
```

```typescript
// packages/shared/src/types/provider.ts

export interface WeatherReading {
  tempF_tenths: number;
  observedTimestamp: number;
}

export interface ProviderHealth {
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  lastCheck: number;
}

export interface WeatherProvider {
  name: string;
  getForecast(cityId: string, timestamp: number): Promise<number>;
  getFirstReadingAtOrAfter(cityId: string, timestamp: number): Promise<WeatherReading>;
  healthCheck(): Promise<ProviderHealth>;
}
```

---

## Environment Variables

```bash
# .env.example

# ===== PUBLIC (safe for client) =====
NEXT_PUBLIC_CHAIN_ID=114                          # Coston2 testnet (14 for mainnet)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...                # WeatherMarket contract
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...               # Thirdweb project ID

# ===== DATABASE =====
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/weatherb

# ===== REDIS =====
REDIS_URL=redis://localhost:6379

# ===== PRIVATE KEYS (never commit!) =====
DEPLOYER_PRIVATE_KEY=0x...                        # Contract deployment
SETTLER_PRIVATE_KEY=0x...                         # Settlement bot
SCHEDULER_PRIVATE_KEY=0x...                       # Market creation

# ===== WEATHER PROVIDER =====
WEATHER_PROVIDER=open-meteo                       # or tomorrow-io
TOMORROW_IO_API_KEY=...                          # If using Tomorrow.io

# ===== ADMIN =====
ADMIN_WALLET_ADDRESS=0x...                        # Admin allowlist
```

---

## CI Workflow

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: foundry-rs/foundry-toolchain@v1
      - run: cd contracts && forge build
      - run: cd contracts && forge test

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, contracts, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

---

## Acceptance Criteria

- [ ] `pnpm install` works from repo root
- [ ] `pnpm dev` starts frontend on localhost:3000
- [ ] `docker-compose up` starts Postgres + Redis
- [ ] `forge build` compiles contracts
- [ ] `forge test` runs (even if just placeholder test)
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] CI pipeline is green on push

---

## Dependencies on Other Epics

- **None** — This is the foundation epic.

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Monorepo setup | 2 hours |
| Contracts scaffold | 1 hour |
| Frontend scaffold | 2 hours |
| Services scaffold | 1 hour |
| Shared package | 1 hour |
| Docker + env | 1 hour |
| CI pipeline | 2 hours |
| **Total** | **~10 hours** |

---

## Notes

- Keep dependencies minimal in V1
- Don't over-engineer the folder structure — can refactor later
- Foundry submodules can be tricky — document the setup clearly
