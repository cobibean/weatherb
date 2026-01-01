# AGENTS.md — WeatherB Project Rules

## What Is This?
**WeatherB**: Prediction market on Flare. Users bet YES/NO on temperature.
> "Will temp be ≥ X°F at time T in City?"

---

## Architecture
```
contracts/        # Foundry — WeatherMarketV2.sol (UUPS upgradeable)
apps/web/         # Next.js 16.1 — App + Admin + Cron routes
packages/shared/  # Types, ABIs, constants
docs/             # Epics, reference, testing
```

| Layer | Choice |
|-------|--------|
| Contracts | Foundry + Solidity 0.8.24 |
| Frontend | Next.js 16.1, React 19, Tailwind, shadcn/ui |
| Wallet | Thirdweb + WalletConnect |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel (web + cron), Upstash Redis |
| Weather | MET Norway (primary), NWS (fallback) |

---

## Key Constraints — NEVER Violate

| # | Rule |
|---|------|
| 1 | 5 markets/day max |
| 2 | Multiple bets allowed per wallet |
| 3 | Store temps as tenths: 85.3°F → 853 |
| 4 | Display as whole degrees |
| 5 | Threshold tie → YES wins (`>=`) |
| 6 | FLR only in V1 |
| 7 | Only settler can resolve markets |
| 8 | Fee from losing pool (1% default, 10% max) |
| 9 | Betting closes 10 min before resolve |
| 10 | Min bet: 0.01 FLR |

---

## Coding Conventions
- **TypeScript**: Strict mode, explicit returns, zod validation
- **Solidity**: NatSpec, custom errors, CEI pattern
- **Naming**: `kebab-case.ts`, `PascalCase.tsx`, `camelCase` vars
- **Testing**: Foundry (contracts), Vitest (frontend)

---

## Environment Variables
Uses `.env` (not `.env.local`). Key vars:
- `RPC_URL`, `DATABASE_URL`, `UPSTASH_REDIS_REST_*`
- `SETTLER_PRIVATE_KEY`, `SCHEDULER_PRIVATE_KEY`, `ADMIN_PRIVATE_KEY`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`

See `.env.example` for full list.

---

## Essential Files
| File | Purpose |
|------|---------|
| `contracts/src/WeatherMarketV2.sol` | Active contract (UUPS) |
| `packages/shared/src/abi/` | Contract ABIs |
| `apps/web/src/app/api/cron/` | Scheduler + settler |
| `apps/web/prisma/schema.prisma` | Database models |
| `PRD.md` | Product requirements |
| `docs/epics/*.md` | Build plans |

---

## Epic Status
| Epic | Status |
|------|--------|
| 0-7 | ✅ Complete (contracts, UI, admin, voting) |
| 8 | 🔄 Test automation done, weekly reports pending |
| 9-10 | ⏳ Indexing, security |

---

## Quick Reference
- **Deployment**: Vercel + Flare Coston2 (testnet) / Flare mainnet (prod)
- **Cron**: `/api/cron/schedule-daily` (every 30m), `/api/cron/settle-markets` (every 5m)
- **Settlement**: Weather API → Settler Cron → `resolveMarket()` → on-chain
