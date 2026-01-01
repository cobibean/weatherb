# CLAUDE.md - Quick Context for Claude Code

## Model Preferences
- **Opus**: Planning, architecture, complex reasoning
- **Sonnet**: Implementation, coding, execution

After planning: _"Would you like to switch to Sonnet for implementation?"_

---

## What Is WeatherB?
Prediction market on Flare: users bet YES/NO on temperature outcomes.
> "Will temp be ≥ X°F at time T in City?"

## Tech Stack
| Layer | Tech |
|-------|------|
| Contracts | Foundry + Solidity 0.8.24 |
| Frontend | Next.js 16.1, React 19 |
| Wallet | Thirdweb + WalletConnect |
| Database | PostgreSQL + Prisma |
| Deployment | Vercel (web + cron) |
| Weather | MET Norway (primary) |

## Monorepo
```
contracts/        # Foundry smart contracts
apps/web/         # Next.js + admin + cron routes
packages/shared/  # Types, ABIs, constants
docs/             # Epics, testing, reference
```

---

## Key Constraints (Never Violate)
| Rule | Value |
|------|-------|
| Markets/day | 5 max |
| Bets per wallet | Multiple allowed |
| Storage precision | 0.1°F (tenths: 853 = 85.3°F) |
| Display precision | Whole degrees |
| Threshold tie | YES wins (`>=`) |
| Fee | 1% from losing pool (max 10%) |
| Betting buffer | 10 min before resolve |
| Min bet | 0.01 FLR |

---

## Essential Files
| Purpose | Path |
|---------|------|
| Active contract | `contracts/src/WeatherMarketV2.sol` |
| Contract ABI | `packages/shared/src/abi/weather-market.ts` |
| Daily scheduler | `apps/web/src/app/api/cron/schedule-daily/route.ts` |
| Market settler | `apps/web/src/app/api/cron/settle-markets/route.ts` |
| Database schema | `apps/web/prisma/schema.prisma` |
| Requirements | `PRD.md` |

## Environment
Uses `.env` in root (NOT `.env.local`). See `.env.example` for all vars.

---

## Epic Status
- **Epics 0-7**: ✅ Complete (contracts, UI, admin, voting)
- **Epic 8**: 🔄 Test automation done, weekly reports pending
- **Epic 9-10**: ⏳ Indexing, security hardening
