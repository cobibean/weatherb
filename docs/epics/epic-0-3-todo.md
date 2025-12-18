# Epic 0–3 — Consolidated TODO (WeatherB)

This file is a generated checklist derived from:

- `docs/epics/epic-0-foundations.md`
- `docs/epics/epic-1-provider.md`
- `docs/epics/epic-2-contracts.md`
- `docs/epics/epic-3-fdc.md`

## Epic 0 — Foundations

- [x] Create `pnpm-workspace.yaml`
- [x] Create root `package.json` (workspace scripts)
- [x] Add `.nvmrc` (Node 20)
- [x] Add comprehensive `.gitignore`
- [x] Initialize Foundry project in `contracts/`
- [x] Configure `contracts/foundry.toml` (optimizer + chain settings)
- [x] Add `contracts/src/WeatherMarket.sol`
- [x] Add `contracts/test/WeatherMarket.t.sol`
- [x] Add `contracts/package.json` (workspace inclusion)
- [x] Create Next.js 14+ app in `apps/web/`
- [x] Configure strict TypeScript
- [x] Add TailwindCSS + shadcn/ui baseline config
- [x] Add Thirdweb SDK and Flare chain config
- [x] Create `services/scheduler/` (TypeScript)
- [x] Create `services/settler/` (TypeScript)
- [x] Add shared dev deps (tsx, vitest)
- [x] Create `packages/shared/` structure
- [x] Add base types (Market, Bet, Provider)
- [x] Export from barrel files
- [x] Create `infra/docker-compose.yml` (Postgres + Redis)
- [x] Keep root `.env.example` in sync with required vars
- [x] Add `README.md` (setup instructions)
- [x] Add `.github/workflows/ci.yml` (lint, typecheck, forge test, vitest, next build)

## Epic 1 — Provider Layer

- [x] Define provider interface types in `packages/shared/src/providers/interface.ts`
- [x] Implement MET Norway adapter (required `User-Agent`)
- [x] Unit test MET adapter (mocked fetch)
- [x] Implement NOAA/NWS adapter (US-only fallback)
- [ ] Unit test NOAA/NWS adapter
- [x] Implement Open-Meteo adapter (dev/test only; hourly limitation documented)
- [ ] Unit test Open-Meteo adapter
- [x] Implement Redis caching wrapper (forecasts 60–300s, readings 24h)
- [x] Implement fallback provider wrapper (priority + health-based)
- [x] Add comparison script for provider behavior/latency
- [x] Integrate provider factory for services (env-configured)

## Epic 2 — Contracts

- [x] Implement `WeatherMarket.sol` (create, bet, resolve, cancel, claim, refund)
- [x] Enforce: 1 bet/wallet/market
- [x] Enforce: betting closes `resolveTime - bettingBuffer` (default 600s)
- [x] Enforce: `tempTenths >= thresholdTenths` => YES wins
- [x] Store temps in tenths (`uint256`)
- [x] Fee: 1% from losing pool
- [x] Automation-only settlement (`onlySettler` for `resolveMarket`)
- [x] Add `IWeatherMarket.sol` interface
- [x] Add `PayoutMath.sol` library
- [x] Add Foundry tests for full flow (happy path + reverts)
- [x] Add deploy script and Coston2 config

## Epic 3 — FDC Integration

- [x] Research Flare FDC Web2Json + addresses (Coston2 + mainnet)
- [x] Implement on-chain proof verification module (`FDCVerifier.sol`)
- [x] Add registry + verification interfaces
- [x] Integrate proof verification into `WeatherMarket.resolveMarket()`
- [x] Add Foundry tests with mock registry/verifier
- [x] Implement settler-side FDC client (`services/settler/src/fdc.ts`)
- [x] Implement attestation request builder (URL + jq + ABI signature)
- [x] Implement polling + retry/backoff + timeout handling
- [ ] Define/validate attestation payload and decoding assumptions
- [ ] Document/handle FDC failure modes (retry vs. alert vs. defer)
