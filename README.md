# weatherB

A prediction market on Flare where users bet YES/NO on temperature outcomes.

> "Will it be >= 72F in New York City at 2pm?"

---

## Status

Testnet (Coston2). Core product complete (Epics 0-7). Epic 8 in progress; Epics 9-10 planned.

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
| Contracts | Foundry + Solidity 0.8.24 (UUPS) |
| Frontend | Next.js 16.1, React 19, Tailwind, shadcn/ui |
| Wallet | Thirdweb + WalletConnect |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel + Upstash Redis |
| Weather | Tomorrow.io (single provider) |

---

## Project Structure

```
weatherb/
├── contracts/        # Foundry — WeatherMarketV2.sol (UUPS)
├── apps/web/         # Next.js 16.1 — app, admin, cron routes
├── packages/shared/  # Types, ABIs, constants, providers
├── docs/epics/       # Internal build plans
├── weatherbdocs/     # Public docs (GitBook-ready)
└── infra/            # Local Postgres/Redis
```

---

## Quick Start

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- pnpm 9+
- Foundry
- Docker (optional, for local Postgres + Redis)

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start local services:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

3. Environment:

   ```bash
   cp .env.example .env
   ```

   `FLARE_CONTRACT_REGISTRY_ADDRESS` (Coston2 + Flare mainnet): `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`

4. Build contracts:

   ```bash
   pnpm -C contracts build
   ```

5. Run dev server:

   ```bash
   pnpm dev
   ```

6. Run tests:

   ```bash
   pnpm test
   pnpm -C contracts test
   ```

See `.env.example` for required environment variables.

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
- `/api/cron/update-trending` - Updates suggestion trends
- `/api/cron/weekly-report` - Weekly reporting job

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
