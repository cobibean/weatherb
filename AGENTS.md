# AGENTS.md — WeatherB Project Context

## What This Is

**WeatherB** is a simple, automated prediction market on **Flare** where users bet YES/NO on temperature outcomes:

> "Will the temperature be ≥ X°F at time T in City?"

That's it. No sports, no politics, no crypto prices — just weather.

---

## Architecture Overview

```
weatherb/
├── contracts/           # Foundry — Solidity smart contracts
├── apps/web/            # Next.js 16.1.0 — User-facing betting app + Admin panel
├── services/            # Legacy (migrated to Vercel Cron)
│   ├── scheduler/      # → /api/cron/schedule-daily
│   └── settler/        # → /api/cron/settle-markets
├── packages/shared/     # Types, ABIs, constants, utils
├── docs/epics/          # Detailed build plans per epic
└── infra/              # Docker, deployment configs
```

### Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Contracts | Foundry + Solidity 0.8.24+ | Faster tests, better DX |
| Frontend | Next.js 16.1.0 (App Router) | Latest stable, React 19 support |
| React | React 19.0 | Latest stable version |
| Wallet | Thirdweb + WalletConnect | Per PRD requirement |
| Styling | TailwindCSS + shadcn/ui | Fast, beautiful, customizable |
| Animations | Framer Motion | Smooth, performant micro-interactions |
| Database | PostgreSQL + Prisma | Reliable, good for indexing |
| Deployment | Vercel (web + cron) | Simple, scalable, serverless |
| Weather (Primary) | MET Norway (api.met.no) | Free, high-quality, ~5-min nowcast |
| Weather (Fallback) | NOAA/NWS (US-only) | Free, reliable for US markets |
| Weather (Dev/Test) | Open-Meteo | Free tier for local testing only |

---

## Key Constraints — NEVER Violate

These are **locked rules** from the PRD. Breaking them breaks the product.

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **5 markets/day max** | Scheduler config, not negotiable in V1 |
| 2 | **Multiple bets allowed per market** | V2 contract; users can bet YES, NO, or both multiple times |
| 3 | **Settlement precision: 0.1°F** | Store as `uint256` tenths (85.3°F → 853) |
| 4 | **Display precision: 1°F** | UI shows whole degrees only |
| 5 | **Threshold tie → YES wins** | `temp >= threshold` (not `>`) |
| 6 | **FLR only in V1** | Currency is variable for future |
| 7 | **Automation-only settlement** | No user can call `resolve()` |
| 8 | **Fee from losing pool** | Default 1% (`feeBps=100`), owner-mutable (max 10%) |
| 9 | **First reading at/after T** | Not "closest to T" or "average" |
| 10 | **Betting closes 10 min before T** | Configurable `bettingBuffer` (default 600s) |
| 11 | **Min bet: 0.01 FLR** | Spam prevention, admin-adjustable |

---

## Coding Conventions

### TypeScript
- **Strict mode** everywhere (`"strict": true`)
- Explicit return types on all exported functions
- Use `zod` for runtime validation at boundaries
- Prefer `const` over `let`, never `var`
- Use `type` for object shapes, `interface` for extendable contracts

### Solidity
- NatSpec comments on all public/external functions
- Use `custom errors` over `require` strings (gas efficient)
- Follow Checks-Effects-Interactions pattern
- Explicit visibility on all functions and state variables
- No floating pragma — lock to specific version

### Naming
- Files: `kebab-case.ts`, `PascalCase.tsx` for React components
- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`
- Contract events: `PascalCase` (e.g., `MarketCreated`)

### Testing
- Contracts: Foundry (`forge test`)
- Services: Vitest
- Frontend: Vitest + React Testing Library
- E2E: Playwright (later)
- **Write tests before or alongside implementation**

---

## Environment Variables

### Never Commit Secrets
- `.env` files are gitignored
- Use `.env.example` with placeholder values

### Variable Naming
```bash
# Public (safe for client)
NEXT_PUBLIC_CHAIN_ID=14        # Flare mainnet
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Private (server only)
DATABASE_URL=postgresql://...
SETTLER_PRIVATE_KEY=0x...      # NEVER expose
SCHEDULER_PRIVATE_KEY=0x...    # For market creation
ADMIN_REPORT_EMAIL=...         # Weekly AI reports destination
ADMIN_WALLETS=0x...,0x...      # Comma-separated admin allowlist
RPC_URL=...                    # Flare RPC endpoint
UPSTASH_REDIS_REST_URL=...     # For cron state management
UPSTASH_REDIS_REST_TOKEN=...   # Upstash Redis REST token
```

### Environments
| Env | Chain | Purpose |
|-----|-------|---------|
| `local` | Anvil fork | Dev testing |
| `testnet` | Flare Coston2 | Integration testing |
| `mainnet` | Flare | Production |

---

## When Adding a Feature

1. **Check PRD.md** — Does it violate locked rules?
2. **Check epic docs** — Is this in scope for current epic?
3. **Update `packages/shared/`** — Types first, always
4. **Write tests** — Before or with implementation
5. **Update epic doc** — Mark tasks complete, add learnings

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `PRD.md` | Source of truth for requirements |
| `buildplanoutline.md` | High-level epic overview |
| `docs/epics/*.md` | Detailed plans per epic |
| `contracts/src/WeatherMarketV2.sol` | **Active** betting contract (UUPS upgradeable) |
| `contracts/src/WeatherMarket.sol` | Legacy V1 contract (reference only) |
| `packages/shared/src/abi/` | Contract ABIs |
| `apps/web/src/lib/contract-errors.ts` | Custom error decoder for user-friendly messages |
| `apps/web/src/app/api/cron/` | Vercel Cron routes (scheduler/settler) |
| `apps/web/prisma/schema.prisma` | Database schema (admin panel) |
| `vercel.json` | Vercel deployment + cron config |

---

## Decision Log

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|-------------|
| 2024-12 | Single contract (not factory) | Simpler for V1, lower gas | Yes |
| 2024-12 | PostgreSQL over SQLite | Need concurrent access for indexer | Yes |
| 2024-12 | Foundry over Hardhat | Faster tests, better fuzzing | No |
| 2024-12 | MET Norway as primary provider | Free, high-quality, ~5-min nowcast | Yes |
| 2024-12 | 10-minute betting buffer | Reduces timing exploits; admin-adjustable | Yes |
| 2024-12 | No bug bounty in V1 | Keep scope tight; SECURITY.md inbox only | Yes |
| 2024-12 | Single admin wallet for V1 | Move to multi-sig when TVL justifies | Yes |
| 2024-12-20 | "Nostalgic Futurism" design system | Light, airy, minimal UI with sky gradients & textures | Yes |
| 2024-12-20 | Liquid Scale odds visualization | Dynamic balance display instead of % bars | Yes |
| 2024-12-20 | Custom "Log In" wallet button | More Web2-friendly than "Connect Wallet" | Yes |
| 2024-12-20 | Hero carousel + grid layout | Showcase markets in 2 formats on homepage | Yes |
| 2024-12-21 | Drop FDC for trusted settler | Simpler V1; FDC adds complexity without proportional benefit | Yes |
| 2024-12 | Vercel Cron over Railway | Serverless, simpler deployment, integrated with web app | Yes |
| 2024-12-27 | WeatherMarketV2 upgrade | UUPS upgradeable, multiple bets/wallet, mutable fees, gas optimizations | Yes |
| 2024-12-27 | Remove 1-bet-per-wallet limit | Better UX; users can DCA or hedge positions | No (contract change) |

---

## Common Pitfalls

### ❌ Don't
- Store temperatures as floats (precision loss)
- Let users call `resolveMarket()` directly
- Deploy without testnet validation
- Hardcode provider URLs (use adapter pattern)
- Forget to update ABI after contract changes
- Hardcode fee percentage (use `feeBps` from contract)

### ✅ Do
- Store temps as `uint256` tenths (853 = 85.3°F)
- Use `onlySettler` modifier for resolution
- Test full flow on Coston2 before mainnet
- Abstract weather provider behind interface
- Use `decodeContractError()` for user-friendly error messages
- Validate in UI AND contract (defense in depth)

---

## Epic Progress Status

### Epics 0-6: ✅ Complete
- **Epic 0:** Monorepo scaffolding, CI/CD, shared types
- **Epic 1:** Weather provider layer (MET Norway, NWS, Open-Meteo)
- **Epic 2:** Smart contracts → **Upgraded to WeatherMarketV2** (Dec 2024)
- **Epic 3:** ~~FDC verification~~ → Simplified to trusted settler
- **Epic 4:** Scheduler + Settler (Vercel Cron)
- **Epic 5:** Web App UI + Positions Dashboard
- **Epic 6:** Admin Panel (wallet auth, settings, city management)

### Contract Architecture (V2)
```
WeatherMarketV2.sol (UUPS Proxy)
├── Multiple bets per wallet per market
├── Mutable fee (feeBps, owner-only, max 10%)
├── Upgradeable via _authorizeUpgrade (owner-only)
├── Events for all config changes
└── Gas optimized (packed storage, internal helpers)
```

### Settlement Flow
```
Weather API → Settler Cron → resolveMarket() → on-chain
```

### Deployment
| Component | Platform |
|-----------|----------|
| Web App | Vercel (Next.js) |
| Cron Jobs | Vercel Cron |
| State | Upstash Redis |
| Database | PostgreSQL |
| Network | Flare Coston2 (testnet) |

---

## Getting Help

1. **PRD.md** — "What should we build?"
2. **docs/epics/** — "How do we build it?"
3. **AGENTS.md** — "What are the rules?"
4. **Code comments** — "Why was this done this way?"
