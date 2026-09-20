# weatherB

A prediction market on Flare where users bet YES/NO on temperature outcomes.

> "Will it be >= 72F in New York City at 2pm?"

---

## Status

Arc/USDC restart in progress. Phases 1–3 establish a reproducible verification baseline and a fresh local development database. Supabase provisioning is deferred; Arc transactions and wallet configuration are later work. All hosted schedules remain paused.

---

## What This Is

- Binary temperature markets only (YES/NO on temp >= threshold at time T)
- 5 markets/day max (protocol rule)
- Parimutuel pools with fee from losing pool (1% default, 10% max)
- Trusted settler resolves markets using weather providers
- Betting closes 10 minutes before resolve time
- Multiple bets per wallet allowed; FLR only in V1

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Blockchain | Flare (Coston2 testnet / Flare mainnet) |
| Contracts | Foundry 1.8.3 + Solidity 0.8.37 (UUPS) |
| Frontend | Next.js 16.3, React 19, Tailwind, shadcn/ui |
| Wallet | Thirdweb + WalletConnect |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel + Upstash Redis |
| Weather | Tomorrow.io (single provider) |

---

## Project Structure

```
weatherb/
├── contracts/        # Foundry — WeatherMarketV2.sol (UUPS)
├── apps/web/         # Next.js 16.3 — app, admin, cron routes
├── packages/shared/  # Types, ABIs, constants, providers
├── deferred/         # Preserved optional features; outside the active app
├── docs/epics/       # Internal build plans
├── weatherbdocs/     # Public docs (GitBook-ready)
└── infra/            # Local Postgres/Redis
```

---

## Quick Start

### Prerequisites

- Node.js 24.21.0 (see `.nvmrc`)
- npm 12.0.2
- Foundry 1.8.3 (installed locally by `npm run setup:contracts`)
- PostgreSQL CLI tools for disposable database tests: Homebrew `postgresql@14` on macOS or `postgresql-16` on Ubuntu. Set `WEATHERB_PG_BIN` for a different installation.
- Docker (optional, for ordinary development Postgres + Redis)

### Setup

1. Install dependencies:

   ```bash
   nvm install
   nvm use
   npm install --global npm@12.0.2
   npm ci
   npm run setup:contracts
   ```

2. Create and seed the private local development database (PostgreSQL tools required):

   ```bash
   npm run arc:setup
   npm run arc:migrate
   npm run arc:seed
   npm run arc:check
   ```

3. Start the app on loopback with its separate development profile:

   ```bash
   npm run dev
   ```

4. Verify without credentials or live services:

   ```bash
   npm run verify
   ```

`npm run verify` runs lint, typechecking, safety/unit/contract tests, disposable
PostgreSQL integration tests, the full production build, and ABI consistency.
It does not require `.env`, Supabase, Redis, RPC access, or wallet keys. The database
runner creates its own private cluster and removes it on completion. It refuses
caller-supplied test targets. See [verification](docs/testing/development-verification.md)
for individual commands and the active/deferred boundary.

Development uses ignored `.env.arc-dev`; root `.env` remains legacy and is not loaded
by the `arc:*` commands. `npm run dev` starts the owned local cluster if needed.
Stop PostgreSQL with `npm run arc:stop`; data is preserved. Arc RPC/wallet configuration
is intentionally absent, so active markets show unavailable while database history
is empty. See [local database setup](docs/testing/arc-development-database.md).

The root `npm run build` is a credential-free **verification artifact** with dummy
public configuration. Deployments must use the web workspace's normal build with
explicit destination configuration; do not publish the verification artifact.

See the [readiness plan](docs/plans/2026-09-18-arc-usdc-readiness-plan.md),
[phase 1 baseline](docs/plans/2026-09-18-phase-1-development-baseline.md),
[phase 2 report](docs/plans/2026-09-18-phase-2-safe-verification.md), and
[phase 3 report](docs/plans/2026-09-19-phase-3-development-database.md).

---

## Documentation

- `weatherbdocs/` — Public docs (GitBook-ready)
- `docs/epics/` — Internal build plans
- `PRD.md` — Product requirements
- `AGENTS.md` — Project rules and conventions
- `QUICK_START.md` — Automation test guide

---

## Automation (Vercel Cron)

Market creation and settlement are handled by Vercel Cron jobs. Schedules are defined in `vercel.json`.

- `/api/cron/schedule-daily` - Creates markets based on daily configuration
- `/api/cron/settle-markets` - Settles eligible markets every 5 minutes
- `/api/cron/update-trending` - Deferred; returns HTTP 410
- `/api/cron/weekly-report` - Deferred; returns HTTP 410

Required environment variables:
- `RPC_URL` - Flare RPC endpoint
- `NEXT_PUBLIC_CONTRACT_ADDRESS` - Deployed WeatherMarket address
- `SCHEDULER_PRIVATE_KEY` - Wallet key for market creation (contract owner)
- `SETTLER_PRIVATE_KEY` - Wallet key for settlement (contract settler)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - City rotation state
- `CRON_SECRET` - Vercel Cron authentication

---

## License

MIT
