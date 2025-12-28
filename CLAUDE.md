# CLAUDE.md - Project Context for Claude Code

## User Preferences

### Model Usage
- **Opus** for planning, architecture decisions, and complex reasoning
- **Sonnet 4.5** for implementation, coding, and execution

**Important:** Before starting implementation after a planning phase, always prompt the user to switch models:
> "Planning complete. Would you like to switch to Sonnet 4.5 for implementation? Use `/model sonnet` to switch."

---

## Project Overview

**WeatherB** is a prediction market on the Flare blockchain where users bet YES/NO on temperature outcomes:
> "Will the temperature be >= X degrees F at time T in City?"

### Tech Stack
| Layer | Technology |
|-------|------------|
| Contracts | Foundry + Solidity 0.8.24 |
| Frontend | Next.js 16.1 (App Router), React 19 |
| Wallet | Thirdweb + WalletConnect |
| Styling | TailwindCSS + shadcn/ui |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel (web + cron) |
| Weather | MET Norway (primary), NWS, Open-Meteo |

### Monorepo Structure
```
weatherb/
├── contracts/           # Foundry smart contracts
├── apps/web/            # Next.js app + admin panel + Vercel Cron routes
├── packages/shared/     # Types, ABIs, constants
├── docs/epics/          # Build plans per epic
├── infra/              # Docker compose (Postgres + Redis)
└── scripts/            # Build and deployment scripts
```

---

## Key Constraints (Never Violate)

1. **5 markets/day max**
2. **Multiple bets allowed** (users can bet YES, NO, or both, multiple times)
3. **Settlement precision: 0.1°F** (stored as tenths: 85.3°F → 853)
4. **Display precision: 1°F** (UI shows whole degrees)
5. **Threshold tie → YES wins** (`temp >= threshold`)
6. **FLR only in V1**
7. **Fee from losing pool** (default 1%, owner-mutable, max 10%)
8. **Betting closes 10 min before resolve time**
9. **Min bet: 0.01 FLR**

---

## Current State (Dec 2024)

### Completed Epics
- **Epic 0-2**: Foundations, weather providers, contracts
- **Epic 3**: ~~FDC~~ → Trusted settler pattern
- **Epic 4**: Vercel Cron automation
- **Epic 5**: Web app UI + Positions dashboard
- **Epic 6**: Admin panel with wallet auth
- **Contract V2**: UUPS upgradeable, multiple bets, mutable fees

### Pending Epics
- **Epic 7**: User voting/suggestions
- **Epic 8**: AI weekly reports
- **Epic 9**: Event indexing
- **Epic 10**: Security hardening

---

## Deployment & Automation

### Deployment
- **Platform**: Vercel (web app + serverless cron)
- **Database**: PostgreSQL (production)
- **State**: Upstash Redis (city rotation tracking)
- **Network**: Flare mainnet (production) / Coston2 testnet (development)

### Cron Schedule
- **Daily Scheduler** (`/api/cron/schedule-daily`)
  - **Current**: Every 30 minutes (test configuration in `vercel.json`)
  - **Production**: Intended to run at 6:00 AM UTC (see `PRD.md`)
  - Creates exactly 5 markets per run
  - Uses city rotation stored in Upstash Redis
  - Fetches weather forecasts and calculates thresholds
- **Market Settler** (`/api/cron/settle-markets`)
  - **Current**: Every 5 minutes (configured in `vercel.json`)
  - Checks for markets ready to resolve (past resolve time)
  - Fetches actual temperature from weather provider
  - Settles markets on-chain using trusted settler pattern

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| WeatherMarketV2 (UUPS) | Upgradeable without redeploy; multiple bets; mutable fees |
| Trusted settler | Simpler than FDC; can add proofs later |
| Vercel Cron | Serverless; no separate infra |

### Known Issues
- **UI**: Potential hydration errors from particle system
- **Testing**: Some provider tests incomplete

---

## Important Files

| Purpose | Path |
|---------|------|
| **Active contract** | `contracts/src/WeatherMarketV2.sol` (UUPS upgradeable) |
| Legacy contract | `contracts/src/WeatherMarket.sol` (reference only) |
| Contract ABI | `packages/shared/src/abi/weather-market.ts` |
| Error decoder | `apps/web/src/lib/contract-errors.ts` |
| Daily scheduler | `apps/web/src/app/api/cron/schedule-daily/route.ts` |
| Market settler | `apps/web/src/app/api/cron/settle-markets/route.ts` |
| Admin contract helper | `apps/web/src/lib/admin-contract.ts` |
| Database schema | `apps/web/prisma/schema.prisma` |
| Project rules | `AGENTS.md` |
| Requirements | `PRD.md` |

---

## Environment Variables

**IMPORTANT:** This project uses `.env` in the root directory, NOT `.env.local`.
- Always reference `.env` (not `.env.local`) when discussing environment setup
- The `.env` file is gitignored and contains all secrets
- Use `.env.example` as the template

Key variables needed for full functionality:
- `RPC_URL` - Flare RPC endpoint
- `NEXT_PUBLIC_CONTRACT_ADDRESS` - Deployed contract
- `SCHEDULER_PRIVATE_KEY` - For market creation
- `SETTLER_PRIVATE_KEY` - For settlement
- `ADMIN_PRIVATE_KEY` - For admin panel contract calls
- `UPSTASH_REDIS_REST_URL/TOKEN` - City rotation state
- `DATABASE_URL` - PostgreSQL connection

See `.env.example` for full list.

---

## Coding Conventions

- **TypeScript**: Strict mode, explicit return types, zod for validation
- **Solidity**: NatSpec comments, custom errors, CEI pattern
- **Naming**: kebab-case files, camelCase vars, PascalCase types
- **Testing**: Foundry for contracts, Vitest for services/frontend
