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
├── apps/
│   └── web/            # Next.js 14+ — User-facing betting app
├── services/
│   ├── scheduler/      # Market creation cron job
│   ├── settler/        # Settlement bot (FDC proofs)
│   └── admin/          # Admin API (optional, can be in web)
├── packages/
│   └── shared/         # Types, ABIs, constants, utils
├── docs/
│   └── epics/          # Detailed build plans per epic
└── infra/              # Docker, deployment configs
```

### Tech Stack (Decided)
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Contracts | Foundry + Solidity 0.8.24+ | Faster tests, better DX |
| Frontend | Next.js 14+ (App Router) | SSR, good Thirdweb support |
| Wallet | Thirdweb + WalletConnect | Per PRD requirement |
| Styling | TailwindCSS + shadcn/ui | Fast, beautiful, customizable |
| Database | PostgreSQL + Prisma | Reliable, good for indexing |
| Queue | BullMQ + Redis | Job scheduling, retries |
| Package Manager | pnpm | Fast, workspace support |
| Deployment | Vercel (web) + Railway (services) | Simple, scalable |

---

## Key Constraints — NEVER Violate

These are **locked rules** from the PRD. Breaking them breaks the product.

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **5 markets/day max** | Scheduler config, not negotiable in V1 |
| 2 | **1 bet per wallet per market** | Contract MUST reject second bet |
| 3 | **Settlement precision: 0.1°F** | Store as `uint256` tenths (85.3°F → 853) |
| 4 | **Display precision: 1°F** | UI shows whole degrees only |
| 5 | **Threshold tie → YES wins** | `temp >= threshold` (not `>`) |
| 6 | **FLR only in V1** | Currency is variable for future |
| 7 | **Automation-only settlement** | No user can call `resolve()` |
| 8 | **1% fee from losing pool** | Math: `fee = losingPool * 0.01` |
| 9 | **First reading at/after T** | Not "closest to T" or "average" |

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
WEATHER_API_KEY=...
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
| `contracts/src/WeatherMarket.sol` | Core betting contract |
| `packages/shared/src/types/` | Canonical TypeScript types |
| `packages/shared/src/abi/` | Contract ABIs (auto-generated) |

---

## Decision Log

When making architectural decisions, document them here:

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|-------------|
| TBD | Single contract (not factory) | Simpler for V1, lower gas | Yes |
| TBD | PostgreSQL over SQLite | Need concurrent access for indexer | Yes |
| TBD | Foundry over Hardhat | Faster tests, better fuzzing | No (migration painful) |

---

## Common Pitfalls

### ❌ Don't
- Store temperatures as floats (precision loss)
- Let users call `resolveMarket()` directly
- Deploy without testnet validation
- Hardcode provider URLs (use adapter pattern)
- Skip the 1-bet-per-wallet check in UI (contract must still enforce)

### ✅ Do
- Store temps as `uint256` tenths (853 = 85.3°F)
- Use `onlySettler` modifier for resolution
- Test full flow on Coston2 before mainnet
- Abstract weather provider behind interface
- Validate in UI AND contract (defense in depth)

---

## Getting Help

1. **PRD.md** — "What should we build?"
2. **docs/epics/** — "How do we build it?"
3. **AGENTS.md** — "What are the rules?"
4. **Code comments** — "Why was this done this way?"

