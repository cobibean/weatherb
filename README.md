# WeatherB

A simple prediction market on **Flare** where users bet YES/NO on temperature outcomes.

> "Will it be ≥ 72°F in New York at 2pm?"

---

## Status

🚧 **Under Development** — Currently building Epic 0-3

---

## What This Is

- **Binary markets only**: Bet YES or NO on temperature thresholds
- **5 markets/day**: Limited supply, automated creation
- **Parimutuel payouts**: Winners split losers proportionally (1% fee)
- **Trustless settlement**: Uses Flare Data Connector (FDC) for verifiable weather data

---

## Tech Stack

| Layer        | Choice                     |
| ------------ | -------------------------- |
| Blockchain   | Flare (FLR)                |
| Contracts    | Foundry + Solidity 0.8.24+ |
| Frontend     | Next.js 14+ / Thirdweb     |
| Weather Data | MET Norway (primary)       |
| Database     | PostgreSQL + Prisma        |

---

## Project Structure

```
weatherb/
├── contracts/        # Foundry — Solidity smart contracts
├── apps/web/         # Next.js — User-facing betting app
├── services/
│   ├── scheduler/    # Market creation cron
│   └── settler/      # Settlement bot (FDC proofs)
├── packages/shared/  # Types, ABIs, utils
└── docs/epics/       # Build plans
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

- [`AGENTS.md`](./AGENTS.md) — Project rules and conventions
- [`PRD.md`](./PRD.md) — Product requirements
- [`docs/epics/`](./docs/epics/) — Detailed build plans

---

## Automation (Epic 4)

Market creation and settlement are handled by Vercel Cron jobs:

- **Schedule Daily** (`/api/cron/schedule-daily`) - Creates 5 markets at 6 AM UTC
- **Settle Markets** (`/api/cron/settle-markets`) - Settles eligible markets every 5 minutes

Required environment variables:
- `RPC_URL` - Flare RPC endpoint
- `NEXT_PUBLIC_CONTRACT_ADDRESS` - Deployed WeatherMarket address
- `SCHEDULER_PRIVATE_KEY` - Wallet key for market creation (must be contract owner)
- `SETTLER_PRIVATE_KEY` - Wallet key for settlement (must be contract settler)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - For city rotation state
- `CRON_SECRET` - Vercel Cron authentication

---

## License

MIT
