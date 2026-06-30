# WeatherB Base Migration Implementation Plan

Date: 2026-06-22
Status: Ready for implementation

## Locked Decisions

- Migration path: Base Sepolia first, then Base mainnet.
- Market history: start fresh on Base.
- Contract: deploy current repo `WeatherMarketV2` after contract tests, with an explicit version note that live Coston2 reports `2.0.0` while current repo returns `2.1.0`.
- Custody: admin, scheduler, and settler can be the same wallet for now.
- Database: provision a new production database.
- Current site: leave `weatherb.app` up during migration.
- Market-making bot: out of scope for this migration. Do not touch or migrate it in this work.

## External Network Facts Checked

Official Base docs list:

- Base mainnet: chain ID `8453`, native symbol `ETH`, public RPC `https://mainnet.base.org`, explorer `https://base.blockscout.com`.
- Base Sepolia: chain ID `84532`, native symbol `ETH`, public RPC `https://sepolia.base.org`, explorer `https://sepolia-explorer.base.org`.
- Coinbase CDP network identifiers: `base` / `base-mainnet` and `base-sepolia`.

Use a production-grade RPC provider for mainnet if available. The official public RPC is fine for early testing, but Base docs mark it as rate limited and not intended as the long-term production dependency.

## Goal

Ship WeatherB on Base with the smallest reliable migration:

1. Make active runtime code chain-configurable.
2. Deploy the current WeatherMarketV2 proxy to Base Sepolia.
3. Stand up a clean DB for Base.
4. Prove one full market lifecycle on Base Sepolia.
5. Deploy the same path to Base mainnet.
6. Keep the existing cron automation pattern.
7. Defer old Coston2 history and the market-making bot.

## Non-Goals

- No Coston2 market-history migration into the default UI.
- No multi-chain UI for launch.
- No market-making bot migration.
- No broad design refresh.
- No new oracle architecture.
- No product repositioning.
- No custody hardening beyond the agreed single-wallet model, unless a blocker appears.

## Current Important Facts

- Live Coston2 contract: `0x716186B29043840a165e1Faf49b85bc2101fAaC7`
- Live Coston2 `version()`: `2.0.0`
- Current repo `WeatherMarketV2.version()`: `2.1.0`
- Live Coston2 contract is unpaused and still creating markets.
- Production `DATABASE_URL` is unhealthy: Vercel logs show Prisma database tenant/user not found.
- `weatherb.app` currently serves stale cached HTML and API routes are unhealthy.
- Contract verification locally:
  - `pnpm -C contracts build` passes.
  - `pnpm -C contracts test` passes with 107 tests.
- Web verification locally:
  - `pnpm -C apps/web typecheck` currently fails from pre-existing test/type drift.
  - `pnpm -C apps/web test` currently fails from pre-existing test/env/mocking drift.

## Implementation Strategy

Use a PR stack or commit sequence that keeps risk contained:

1. Readiness and failing-gate triage.
2. Chain config and frontend transaction fix.
3. Contract deployment scripts and Base env docs.
4. DB replacement and bootstrap flow.
5. Base Sepolia preview deployment.
6. Base Sepolia market lifecycle validation.
7. Base mainnet deployment and production cutover.
8. Post-launch docs cleanup.

Do not mix market-making bot changes into any of these phases.

## Phase 0 - Readiness And Branch Setup

Risk: Medium

Purpose: make sure implementation starts from known repo and deployment state.

Tasks:

1. Create a working branch.
   - Suggested branch: `codex/base-migration`
2. Confirm clean worktree.
   - `git status --short`
3. Capture current remote hash.
   - `git rev-parse HEAD origin/master`
4. Run baseline checks and record results.
   - `pnpm -C contracts build`
   - `pnpm -C contracts test`
   - `pnpm -C apps/web typecheck`
   - `pnpm -C apps/web test`
5. Decide CI gate handling before code implementation:
   - Preferred: fix stale tests enough that typecheck/test can pass.
   - Acceptable for a migration PR if Cobi approves: split production typecheck from stale test typecheck and track test repair separately.
6. Do not edit secrets or print env values.

Likely files:

- `.github/workflows/ci.yml`
- `apps/web/tsconfig.json`
- `apps/web/vitest.config.ts`
- stale test files only if choosing to repair CI now.

Exit criteria:

- There is a branch.
- Baseline verification state is recorded in the PR/handoff.
- A clear decision exists for existing red web checks.

## Phase 1 - Chain Configuration Helper

Risk: Medium

Purpose: remove hardcoded Coston2 behavior from active app paths.

Add a small helper, likely:

- `apps/web/src/lib/chain-config.ts`

The helper should expose:

- `getAppChainId(): number`
- `getAppChainConfig()`
- `getExplorerTxUrl(txHash: string): string`
- `getExplorerAddressUrl(address: string): string`
- `getNativeTokenSymbol(): string`
- `getNativeTokenName(): string`
- `getIsTestnet(): boolean`

Supported launch chains:

```ts
Base Mainnet:
  chainId: 8453
  name: "Base"
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL only if a client-side RPC is intentionally needed
  explorerUrl: "https://base.blockscout.com" or "https://basescan.org", choose one and use consistently

Base Sepolia:
  chainId: 84532
  name: "Base Sepolia"
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }
  explorerUrl: "https://sepolia-explorer.base.org" or "https://sepolia.basescan.org", choose one and use consistently
```

Recommended explorer choice:

- Base Sepolia: `https://sepolia-explorer.base.org` to match official Base docs.
- Base mainnet: `https://base.blockscout.com` to match official Base docs.

If Basescan verification is easier, it is acceptable to choose `basescan.org` / `sepolia.basescan.org`, but do not mix explorers randomly across the UI.

Implementation details:

1. Default development chain may remain Coston2 only if explicitly needed, but launch paths must support Base Sepolia and Base.
2. Avoid `NEXT_PUBLIC_RPC_URL` unless Thirdweb requires a browser RPC override. Server RPC stays `RPC_URL`.
3. Use `NEXT_PUBLIC_CHAIN_ID` as the source of truth for the user-facing network.
4. Validate unknown chain IDs early with a useful error.

Files to update:

- `apps/web/src/components/layout/wallet-button.tsx`
- `apps/web/src/components/markets/bet-modal.tsx`
- `apps/web/src/components/positions/claim-modal.tsx`
- `apps/web/src/components/positions/bulk-claim-modal.tsx`
- `apps/web/src/lib/contract-data.ts`
- `apps/web/src/lib/positions.ts`
- `apps/web/src/lib/admin-data.ts`
- `apps/web/src/lib/contract-errors.ts`

Explicit removals:

- Remove hardcoded `coston2Chain` from bet/claim/bulk claim paths.
- Remove hardcoded `https://coston2-explorer.flare.network`.
- Remove active `flareTestnet` imports from app runtime paths.

Acceptance criteria:

- `NEXT_PUBLIC_CHAIN_ID=84532` produces Base Sepolia wallet metadata and transaction links.
- `NEXT_PUBLIC_CHAIN_ID=8453` produces Base wallet metadata and transaction links.
- Transaction calls use the configured app chain, not Coston2.
- User-facing token copy in active flows says ETH, not FLR.

Suggested focused tests:

- Unit test chain ID `84532` maps to Base Sepolia, ETH, and Sepolia explorer.
- Unit test chain ID `8453` maps to Base, ETH, and mainnet explorer.
- Unit test unknown chain ID throws or returns a safe unsupported state.

## Phase 2 - Native Token Naming Cleanup

Risk: Low to Medium

Purpose: make Base launch coherent without a broad refactor.

Do the minimum:

1. Keep on-chain native currency behavior as `address(0)`.
2. Rename display-only helpers where practical:
   - `formatFlr` can remain internally for now if changing it fans out too much, but active UI labels should not append `FLR`.
   - Better: add a neutral wrapper `formatNativeAmount` and use it in changed Base paths.
3. Update active public UI copy:
   - bet modal amount label
   - payout preview
   - claim/refund modal
   - positions stats
   - header claimable amount
   - footer "Built on Flare"
   - app metadata "Powered by Flare"
   - home modal "Flare-compatible wallet"
   - faucet banner should be removed or replaced for Base Sepolia only.

Files likely involved:

- `packages/shared/src/utils/payout.ts`
- `apps/web/src/components/markets/bet-modal.tsx`
- `apps/web/src/components/markets/hero-card.tsx`
- `apps/web/src/components/markets/market-summary-modal.tsx`
- `apps/web/src/components/positions/*`
- `apps/web/src/components/layout/header.tsx`
- `apps/web/src/components/layout/footer.tsx`
- `apps/web/src/components/home/faucet-banner.tsx`
- `apps/web/src/components/home/how-weatherb-works-modal.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/lib/contract-errors.ts`

Acceptance criteria:

- Active Base UI does not tell users they are betting FLR.
- Base Sepolia faucet, if shown, points to a Base Sepolia faucet, not Coston2.
- No scope creep into docs archive yet unless easy.

## Phase 3 - Contract Deployment Readiness

Risk: Medium

Purpose: make Foundry deployment repeatable on Base Sepolia and Base mainnet.

Decisions for this migration:

- Use current repo `WeatherMarketV2`.
- Same wallet may be admin, scheduler, and settler for now.
- Record version mismatch:
  - live Coston2: `2.0.0`
  - Base deployment target: current repo `2.1.0`

Tasks:

1. Update Foundry RPC aliases.

File:

- `contracts/foundry.toml`

Add:

```toml
[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
base = "${BASE_RPC_URL}"
```

Keep existing Coston2/Flare aliases if useful, but launch docs should use Base aliases.

2. Update deploy script so roles are intentional.

File:

- `contracts/script/DeployV2.s.sol`

Preferred env:

- `DEPLOYER_PRIVATE_KEY`
- `OWNER_ADDRESS`
- `SETTLER_ADDRESS`

For the agreed single-wallet model, `OWNER_ADDRESS` and `SETTLER_ADDRESS` can be the same address. The script should still make this explicit.

3. Add deployment runbook.

Suggested file:

- `contracts/DEPLOY_BASE.md`

Include:

```bash
cd contracts
forge build
forge test
forge script script/DeployV2.s.sol:DeployV2Script \
  --rpc-url base_sepolia \
  --broadcast \
  -vvvv
```

For mainnet:

```bash
forge script script/DeployV2.s.sol:DeployV2Script \
  --rpc-url base \
  --broadcast \
  -vvvv
```

4. Verify post-deploy values with `cast`.

```bash
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "version()(string)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "owner()(address)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "settler()(address)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "getMarketCount()(uint256)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "minBetWei()(uint256)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "feeBps()(uint256)"
cast call --rpc-url "$BASE_SEPOLIA_RPC_URL" "$CONTRACT" "bettingBufferSeconds()(uint64)"
```

5. Record deploy metadata.

For each deployed network:

- network
- chain ID
- proxy address
- implementation address
- deploy block
- owner
- settler
- version
- deployment tx hash
- verification URL if verified

Acceptance criteria:

- Base Sepolia WeatherMarketV2 proxy is deployed.
- `version()` returns current repo version.
- Owner and settler match the agreed wallet.
- Contract tests pass before deployment.

## Phase 4 - New Database Provisioning And Bootstrap

Risk: High

Purpose: replace broken production DB and start fresh for Base.

Decision:

- Provision a new DB.
- Do not migrate old Coston2 `Market` rows into the Base launch DB.

Tasks:

1. Provision new Postgres.
   - Any managed Postgres is fine if Vercel can reach it.
   - Capture connection strings in secure password manager or Vercel dashboard only.
   - Do not paste connection strings into chat, docs, or commits.

2. Add/update Vercel env for preview first:
   - `DATABASE_URL`
   - `DIRECT_URL`

3. Run migrations against the new DB.

```bash
pnpm -C apps/web prisma migrate deploy
pnpm -C apps/web prisma generate
```

4. Seed/ensure core app state.

Minimum data needed:

- `City` rows for the active rotation.
- `SystemConfig` default row, or let app create it.

Current scheduler can upsert cities when creating markets, but for predictable preview testing, add a small seed command or one-off script if needed.

5. Keep chain ID out of schema for launch only because DB is fresh.

Important:

- This is safe only because we are starting fresh on Base.
- If Coston2 history comes back later, add chain scoping before importing old rows.

6. Reset Redis state for Base.

Keys to consider:

- `weatherb:scheduler:cityIndex`
- `weatherb:markets:past:v1`
- `weatherb:sheets:logged`
- provider health key

Because we are starting fresh, clear or namespace these keys before Base Sepolia preview and again before Base mainnet production.

Acceptance criteria:

- New DB accepts migrations.
- `/api/markets?status=past` returns `{ markets: [], nextCursor: null }` or equivalent empty success, not 500.
- Scheduler can create a DB `Market` row.
- Single-settle route can find the market row by `contractMarketId`.

## Phase 5 - Base Sepolia Vercel Preview

Risk: Medium

Purpose: prove the app works end to end before mainnet.

Preview env values to configure in Vercel:

- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_CONTRACT_ADDRESS=<Base Sepolia proxy>`
- `RPC_URL=<Base Sepolia RPC>`
- `CONTRACT_DEPLOY_BLOCK=<Base Sepolia deploy block>`
- `DATABASE_URL=<new preview/staging DB>`
- `DIRECT_URL=<new preview/staging direct DB URL>`
- `SCHEDULER_PRIVATE_KEY=<Base Sepolia funded wallet>`
- `SETTLER_PRIVATE_KEY=<same wallet for now>`
- `ADMIN_PRIVATE_KEY=<same wallet for now>`
- `ADMIN_WALLETS=<admin wallet address>`
- `CRON_SECRET=<new secret or existing preview secret>`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`
- `NEXT_PUBLIC_APP_URL` or `APP_URL=<preview URL>`
- `TOMORROW_IO_API_KEY`
- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- Optional Sheets/report env if validating reports.

Do not configure market-making bot env.

Tasks:

1. Deploy preview from branch.
2. Confirm build completes.
3. Confirm app loads fresh HTML.
4. Confirm wallet prompts Base Sepolia.
5. Confirm `/api/markets`, `/api/markets?status=active`, and `/api/markets?status=past`.
6. Manually trigger `schedule-daily` with valid cron auth.
7. Verify:
   - on-chain market count increments
   - DB `Market` row exists
   - response includes created market
   - QStash settlement schedule is created or reports a clear missing-config reason
8. Place a small Base Sepolia ETH bet from UI.
9. Confirm tx link goes to Base Sepolia explorer.
10. Wait for settlement or use a short test-only route/contract script if approved.
11. Trigger single-market settle route at maturity.
12. Verify:
   - on-chain status changes
   - DB status updates
   - Sheets logging skips safely or writes once
   - claim/refund path works

Manual cron trigger shape:

```bash
curl -i "$PREVIEW_URL/api/cron/schedule-daily" \
  -H "Authorization: Bearer $CRON_SECRET"
```

For single settlement:

```bash
curl -i -X POST "$PREVIEW_URL/api/markets/$MARKET_ID/settle" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Acceptance criteria:

- One complete Base Sepolia market lifecycle works from creation to settlement to claim/refund.
- No Coston2 explorer or FLR copy appears in active transaction paths.
- Vercel logs show no Prisma tenant/user errors.
- Vercel logs do not print private keys or secret env values.

## Phase 6 - Mainnet Production Prep

Risk: High

Purpose: prepare Base mainnet without cutting over until checks pass.

Tasks:

1. Deploy WeatherMarketV2 to Base mainnet.
2. Verify contract values with `cast`.
3. Fund the agreed admin/scheduler/settler wallet with enough Base ETH for:
   - market creation
   - settlement
   - admin cancel/pause if needed
4. Provision production DB or promote the clean DB.
5. Run migrations on production DB.
6. Reset production Redis keys or use a fresh Upstash DB.
7. Update production Vercel env:
   - `NEXT_PUBLIC_CHAIN_ID=8453`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS=<Base mainnet proxy>`
   - `RPC_URL=<Base mainnet RPC>`
   - `CONTRACT_DEPLOY_BLOCK=<Base mainnet deploy block>`
   - new `DATABASE_URL`
   - new `DIRECT_URL`
   - Base-funded role keys
8. Confirm `vercel env ls` shows expected names. Do not print values.
9. Deploy production from the verified branch.
10. Inspect deployment before alias confidence.

Acceptance criteria:

- Production deployment is newer than the January 2026 deployment.
- Production build is ready.
- Env names are present.
- Contract responds on Base mainnet.
- Database routes work before scheduled cron creates live markets.

## Phase 7 - Mainnet Cutover

Risk: High

Decision:

- Leave current `weatherb.app` up during prep.
- Cut over once Base mainnet production deployment is ready.

Tasks:

1. Promote production deployment or let Vercel production build attach existing aliases.
2. Confirm aliases:
   - `https://weatherb.app`
   - `https://www.weatherb.app`
3. Confirm canonical redirect behavior is acceptable.
4. Confirm homepage is fresh, not stale May 29 cached HTML.
5. Confirm APIs:
   - `/api/markets`
   - `/api/markets?status=active`
   - `/api/markets?status=past`
6. Trigger one manual `schedule-daily` only if it will not conflict with the scheduled UTC window.
7. Otherwise wait for the next normal cron window.
8. Verify first Base mainnet market:
   - contract count increments
   - DB row exists
   - UI displays market
   - wallet bet uses Base
   - explorer link is Base
9. Monitor logs for at least one hour after first market creation.
10. Monitor settlement at maturity or QStash scheduled time.

Acceptance criteria:

- Production app is on Base mainnet.
- First market is created and visible.
- No DB 500s.
- No stale homepage.
- Crons are working.
- Coston2 remains untouched and available only as old deployed contract, not active app target.

## Phase 8 - Rollback Plan

Use this if mainnet cutover fails.

Fast rollback options:

1. Revert Vercel aliases to previous ready production deployment.
2. Restore previous production env values only if absolutely needed and known good.
3. Disable cron by rotating/removing `CRON_SECRET`, or pause Vercel crons.
4. Pause the Base contract if users might otherwise interact with broken markets.

If DB fails:

1. Stop/disable crons first.
2. Fix `DATABASE_URL` and `DIRECT_URL`.
3. Backfill any Base markets created while DB was down from `getMarket`.
4. Re-enable crons after `/api/markets` is healthy.

If QStash fails:

1. Keep five-minute fallback cron.
2. Do not widen settlement window without approval, because delayed settlement can use stale weather readings.
3. Manually invoke single-settle if DB row exists and market is mature.

If wallet role is wrong:

1. Use owner wallet to set settler if possible.
2. If owner is wrong and unrecoverable, redeploy before users bet.
3. Do not continue with markets that cannot settle.

## Phase 9 - Post-Launch Cleanup

Risk: Low

Tasks:

1. Update docs and public copy from Flare/Coston2 to Base.
2. Archive old Coston2 references clearly.
3. Update `AGENTS.md` project-specific section after launch is proven.
4. Update `.env.example`.
5. Add a deployment record with:
   - Base Sepolia proxy
   - Base mainnet proxy
   - deploy blocks
   - owner/settler/admin address
   - current DB provider
   - verification dates
6. Create a separate follow-up issue/plan for market-making bot migration.
7. Create a separate follow-up issue/plan for optional Coston2 history archive.

Files likely involved:

- `README.md`
- `AGENTS.md`
- `PRD.md`
- `.env.example`
- `weatherbdocs/*`
- `apps/web/src/content/docs/*`
- `docs/epics/*`
- `docs/plans/*` if force-adding ignored docs is acceptable.

Acceptance criteria:

- Public docs no longer tell active Base users to use Coston2 or FLR.
- Coston2 is framed as historical/testnet, not the active launch network.
- Bot migration is explicitly deferred.

## Exact File Checklist

High-priority runtime files:

- `apps/web/src/lib/chain-config.ts` - create.
- `apps/web/src/components/layout/wallet-button.tsx`
- `apps/web/src/components/markets/bet-modal.tsx`
- `apps/web/src/components/positions/claim-modal.tsx`
- `apps/web/src/components/positions/bulk-claim-modal.tsx`
- `apps/web/src/lib/contract-data.ts`
- `apps/web/src/lib/positions.ts`
- `apps/web/src/app/api/markets/route.ts`
- `apps/web/src/app/api/cron/schedule-daily/route.ts`
- `apps/web/src/app/api/cron/settle-markets/route.ts`
- `apps/web/src/app/api/markets/[marketId]/settle/route.ts`
- `apps/web/src/lib/admin-contract.ts`
- `apps/web/src/lib/admin-data.ts`
- `apps/web/src/lib/contract-errors.ts`

Contract/deploy files:

- `contracts/src/WeatherMarketV2.sol`
- `contracts/src/interfaces/IWeatherMarket.sol`
- `contracts/script/DeployV2.s.sol`
- `contracts/foundry.toml`
- `contracts/DEPLOY_BASE.md` - create.

Config/docs:

- `.env.example`
- `vercel.json`
- `README.md`
- `BASE_MIGRATION_IMPLEMENTATION_PLAN.md`

Do not touch for this migration unless needed to keep builds green:

- `apps/market-bot/*`

## Environment Variable Plan

Keep env values secret. Only names and intended values belong in docs.

Base Sepolia preview:

```bash
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_CONTRACT_ADDRESS=<base-sepolia-proxy>
RPC_URL=<base-sepolia-rpc>
CONTRACT_DEPLOY_BLOCK=<base-sepolia-deploy-block>
DATABASE_URL=<new-preview-db-pool-url>
DIRECT_URL=<new-preview-db-direct-url>
SCHEDULER_PRIVATE_KEY=<same-funded-base-sepolia-wallet>
SETTLER_PRIVATE_KEY=<same-funded-base-sepolia-wallet>
ADMIN_PRIVATE_KEY=<same-funded-base-sepolia-wallet>
ADMIN_WALLETS=<wallet-address>
```

Base mainnet production:

```bash
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_CONTRACT_ADDRESS=<base-mainnet-proxy>
RPC_URL=<base-mainnet-rpc>
CONTRACT_DEPLOY_BLOCK=<base-mainnet-deploy-block>
DATABASE_URL=<new-production-db-pool-url>
DIRECT_URL=<new-production-db-direct-url>
SCHEDULER_PRIVATE_KEY=<same-funded-base-wallet>
SETTLER_PRIVATE_KEY=<same-funded-base-wallet>
ADMIN_PRIVATE_KEY=<same-funded-base-wallet>
ADMIN_WALLETS=<wallet-address>
```

Shared required env:

```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<existing-or-new>
CRON_SECRET=<secret>
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
QSTASH_TOKEN=<token>
NEXT_PUBLIC_APP_URL=<deployment-url>
APP_URL=<deployment-url>
TOMORROW_IO_API_KEY=<key>
```

Optional for launch:

```bash
GOOGLE_SHEETS_SERVICE_ACCOUNT=<service-account-json-or-base64>
GOOGLE_SHEETS_SPREADSHEET_ID=<sheet-id>
RESEND_API_KEY=<key>
ADMIN_EMAIL=<email>
AI_PROVIDER_1_KEY=<key>
```

## Verification Matrix

Before Base Sepolia deployment:

- Contract build passes.
- Contract tests pass.
- Chain config tests pass.
- Active frontend no longer hardcodes Coston2 transaction chain.

Before Base mainnet deployment:

- Base Sepolia deploy works.
- Base Sepolia preview app works.
- Base Sepolia market create works.
- Base Sepolia DB write works.
- Base Sepolia bet works.
- Base Sepolia settlement works.
- Base Sepolia claim/refund works.
- Logs are clean.

Before production alias confidence:

- New production DB is migrated.
- Base mainnet contract deployed and verified by calls.
- Production env points to Base mainnet.
- `/api/markets` returns healthy JSON.
- Homepage is fresh.
- Wallet prompts Base mainnet.

After first production market:

- Market is visible in UI.
- Market is visible on Base explorer.
- DB row exists.
- Scheduled settlement is queued or fallback cron is ready.
- Settlement succeeds at maturity.

## Known Risks And Mitigations

### Current Web CI Is Red

Risk: High for deployment discipline.

Mitigation:

- Fix or quarantine stale test/typecheck issues before production deploy.
- Do not use "contracts pass" as a substitute for web app verification.

### Production DB Is Broken

Risk: High.

Mitigation:

- New DB is mandatory.
- Treat old DB as unavailable unless recovered separately.
- Start fresh on Base to avoid chain-scoping migration for launch.

### Hardcoded Coston2 Transaction Paths

Risk: High.

Mitigation:

- Phase 1 blocks launch until all active transaction paths use chain config.

### Current Repo Contract Version Differs From Live

Risk: Medium.

Mitigation:

- Explicitly record Base launches as `WeatherMarketV2` current repo version.
- If exact Coston2 parity later matters, recover the `2.0.0` source separately.

### Same Wallet For Admin/Scheduler/Settler

Risk: Medium.

Mitigation:

- Accept for launch per decision.
- Keep wallet funded.
- Record address.
- Plan later separation after Base is stable.

### Public RPC Rate Limits

Risk: Medium.

Mitigation:

- Use official public RPC only for early Sepolia validation.
- Use a production RPC provider for Base mainnet if possible.

### Event-Driven Settlement Depends On DB Row

Risk: Medium.

Mitigation:

- Ensure scheduler DB write succeeds before relying on QStash.
- Keep fallback cron.
- Add operational backfill command if any market is created on-chain without a DB row.

## First Implementation Task

Start with Phase 1 in a focused PR:

Title:

`Base readiness: chain config and Coston2 transaction removal`

Scope:

- Create chain config helper.
- Update wallet, bet, claim, bulk claim, contract-data, and positions.
- Update active ETH labels in those touched flows.
- Add focused chain config tests.
- Do not deploy.
- Do not touch market-making bot.
- Do not change DB schema yet.

Acceptance criteria:

- `NEXT_PUBLIC_CHAIN_ID=84532` maps to Base Sepolia.
- `NEXT_PUBLIC_CHAIN_ID=8453` maps to Base mainnet.
- No active transaction path references `coston2Chain`.
- No active server read path imports `flareTestnet`.
- Active transaction links use Base explorer URLs.
- Contract build/tests still pass.
- Existing web CI debt is either fixed or explicitly carried as a separate blocker before production.

## Suggested Implementation Order

1. `BASE_MIGRATION_IMPLEMENTATION_PLAN.md`
2. Chain config helper and tests.
3. Replace transaction chain/explorer hardcoding.
4. Replace active FLR labels with configured native token symbol.
5. Contract deploy script role params.
6. Foundry Base RPC aliases.
7. Base deploy runbook.
8. New DB provisioning and migration.
9. Base Sepolia contract deployment.
10. Base Sepolia Vercel preview.
11. Base Sepolia lifecycle validation.
12. Base mainnet contract deployment.
13. Production env swap.
14. Production deployment and monitoring.
15. Docs cleanup and deferred bot/history follow-ups.
