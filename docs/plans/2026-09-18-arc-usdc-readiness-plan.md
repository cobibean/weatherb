# weatherB: development readiness and Arc restart

Date: September 18, 2026
Status: operational shutdown, phases 1–4, and dependency security cleanup verified locally; Supabase provisioning deferred by user; hosted CI pending a future push/PR; Arc configuration and fresh deployment implemented; live refunds and manual weather settlement/winning test claim passed; exact 24-hour settlement, NoWinners and remaining browser wallet acceptance pending

## Agreed direction

- Restart weatherB on Arc using USDC for bets, payouts, and network fees.
- Keep the existing YES/NO temperature-market product and rules.
- Validate on Arc testnet before any public launch. A fresh local development database is provisioned. Hosted Supabase is deferred until the product takes shape.
- The weatherB token, token distribution, DEX pool, and embedded swaps are abandoned.
- This replaces the destination in `BASE_MIGRATION_IMPLEMENTATION_PLAN.md`. That file remains historical context, not the current execution checklist.

## Recommended restart scope and repository strategy

Keep this repository and preserve the current version before working on an isolated Arc restart branch. The audit found recoverable infrastructure and useful existing product logic, but it did not establish that the whole application is healthy. This is a focused restart, not a commitment to restore every subsystem or a guaranteed small repair.

The proposed first release covers viewing markets, wallet connection, USDC betting, weather settlement, claims/refunds, and the minimum administration needed to create, inspect, settle, and cancel markets. Preserve the existing market rules and interface direction unless a separate product decision changes them.

Defer bots, city auditions and test-wallet orchestration, city voting/suggestions, trending, email/weekly reports, and Google Sheets reporting. Keep their code and history recoverable; do not require them to be restored before proving the core flow. Explicitly disable or isolate deferred entry points and integrations in the restart so they cannot silently remain active dependencies. Keep deferred failures visible in the backlog rather than claiming the entire repository is healthy.

Do not migrate old testnet positions or build legacy compatibility into the new Arc experience. Preserve access to the existing Coston2 claims independently; do not alter or pause those contracts as part of the restart.

The first milestone is one complete Arc testnet lifecycle against a fresh database. If reaching it requires pervasive changes across deferred subsystems, document the specific coupling and reconsider a new repository before expanding the repair. A new repository is a fallback decision, not an implementation task in this plan.

## Completed shutdown

- Disabled all four Vercel cron jobs: market creation, settlement, trending, and weekly reports. Definitions remain saved; no application deployment was changed.
- Cancelled the five pending QStash settlement deliveries for markets 2566–2570. Verified each cancellation, zero recurring schedules/queues, and no remaining pending weatherB deliveries in retained logs.
- Cancelled all eight open markets on the active Coston2 contract: 1280, 1281, 1293, 2566, 2567, 2568, 2569, 2570. Receipts succeeded; subsequent reads confirmed Cancelled. These markets had no stakes.
- Left the active contract unpaused so existing claims/refunds remain available. Its balance stayed at 2091.059250937728548865 C2FLR.
- At the user's direction, retire the two older test deployments as-is. Their remaining on-chain states are not cleared: the first has 115 unresolved markets and the second has one. Existing refunds and 0.64 C2FLR of locked stakes remain there. No older-wallet recovery is planned.
- These are Coston2 testnet deployments, not real FLR or USDC balances. Existing positions do not move to Arc.

Contracts:

- [Active](https://coston2-explorer.flare.network/address/0x716186B29043840a165e1Faf49b85bc2101fAaC7)
- [Retired older deployment](https://coston2-explorer.flare.network/address/0xA56C89B892e7A1B84ee78d97c7543ce726aabBFc)
- [Retired second deployment](https://coston2-explorer.flare.network/address/0xbc9b62E78D9F4da71F8063566b1b753b9aB2809a)

## Database rebuild: verified

The repository has a complete Prisma schema and six migrations. All six applied successfully, in migration-name order, to an empty temporary PostgreSQL 14 database, creating 16 tables. Prisma's comparison to the current schema reported no difference. The temporary database was then stopped; no Supabase project was created or modified.

- Schema: `apps/web/prisma/schema.prisma`
- Migrations: `apps/web/prisma/migrations/`
- Saved city definitions, coordinates, slugs, and timezones: `packages/shared/src/constants/cities.ts`

Rebuilding structure is straightforward. It does not restore deleted votes, suggestions, custom cities, sessions, historical database metadata, or encrypted test-wallet keys. The schema does not describe all Supabase project settings. No committed RLS policies were found; configure the new database for the application's server-side Prisma access rather than assuming deleted access policies return automatically.

The original audit found no seed command and unsafe fallback/default behavior.
Phase 3 replaced these with explicit idempotent seeding and enforced pause/readiness
checks. Phase 4 adds deployment binding, unique market IDs, and recorded settlement
fees; the complete rebuild now applies eight migrations.

## Domain diagnosis

The audit connection is blocked by Avera Health Guest Internet. HTTP returns its block page; HTTPS resets before certificate exchange. Changing Vercel edge IPs did not change the hostname-based failure. Vercel reports verified domains, correct nameservers, no conflicts, and no misconfiguration; registration runs through December 31, 2026.

Verify apex and www HTTPS from a non-Avera connection. Global HTTPS health remains unverified; the external fetch and certificate-list results were inconclusive. If the domain works off-network, no DNS change is needed. Request network reclassification only if access on that network matters. If it fails off-network too, investigate Vercel SSL issuance before changing DNS. The broken database and stale application response are separate problems.

## Proposed work toward the first Arc testnet lifecycle

Do only the readiness work needed to make the core lifecycle reproducible and trustworthy. Carry the core path through these steps before broad cleanup or optional feature restoration.

### 1. Establish one reproducible development baseline

Completed on `codex/arc-phase-1-baseline`. Preserved local master and merged the upstream documentation change. Local/CI Node is pinned to 24.21.0, Vercel uses 24.x, and npm is pinned to 12.0.2. Direct packages were updated to stable releases across all workspaces, with documented compatibility exceptions for TypeScript, ESLint, and runtime-matched Node types. Vercel build/install settings now use npm; no deployment was made and automations remain disabled.

Pinned Foundry 1.8.3, Solidity 0.8.37 (Paris target), OpenZeppelin 5.7.0, and forge-std 1.16.2. Added reproducible setup and ABI drift checks. Regenerated the shared ABI from source version 2.1.0 while preserving all 25 existing function signatures. The legacy deployment is still 2.0.0; no contract was upgraded.

Exit verified: clean-directory installation, contract compilation, 107 contract tests, shared build and 41 tests, and exact compiled-ABI match. Prisma 7 migration/adapter checks also pass against a disposable local database. Web production compilation passes, while the original 231 test-file type errors and lint/test backlog remain phase 2 work. See the [phase 1 baseline report](2026-09-18-phase-1-development-baseline.md) for package pins, dependency advisories, and verification limits.

### 2. Make verification safe and useful

Implemented on `codex/arc-phase-1-baseline`. Ordinary tests no longer load the root `.env`; verification processes strip real-service credentials and block unexpected network connections. Database-writing fixtures use a separate command that creates, validates, migrates, tests, stops, and removes its own disposable PostgreSQL cluster. Unsafe/shared/hosted targets are rejected before fixture access.

The active boundary covers all web/shared/contracts source and dependencies. Deferred voting, auditions, magic links, reporting, and Sheets implementations/tests are preserved under `deferred/`, with a path manifest and explicit failures. Former endpoints return 410 and pages 404; navigation omits them. Settlement/cancellation no longer imports Sheets. The independent bot is excluded from ordinary verification and retains a separately reproducible declaration failure. The 231 old type diagnostics belonged to preserved deferred tests; those tests were not repaired or counted as passing.

Repaired active typing/lint and actual cron tests, including all previously skipped active cases. Added clock regression checks and aligned hoisted React/ReactDOM with the app's 19.3.0 pair after a test exposed duplicate runtime copies. Bundled the existing fonts for offline builds and moved homepage live reads to request time.

Local exit verified: `npm run verify` passes lint, typechecking, eight isolation/safety checks, 94 web tests, 41 shared tests, seven disposable database tests, 107 contract tests, full production builds, and ABI consistency. Clean installation and dependency-tree checks pass. Desktop/mobile browser smoke checks cover positions, navigation, empty homepage, explainer, docs, and admin login redirect. No wallet-connected lifecycle or live-service health is claimed.

CI is configured to run the same command; its hosted result is still unverified because nothing was pushed or deployed. The phase 4 money/settlement findings remain explicit release gates. See the [phase 2 report](2026-09-18-phase-2-safe-verification.md) and [verification guide](../testing/development-verification.md). Hosted schedules remain paused. Phase 3 was subsequently completed locally as described below.

### Dependency security cleanup between phases 2 and 3

Completed a compatible dependency update and triage pass. Six advisory-bearing packages were patched; npm audit decreased from 36 package entries (10 high) to 27 (4 high), representing three remaining underlying advisories. Full verification and clean installation pass. The remaining high entries trace to Prisma's trusted configuration tooling; UUID and URI-decoder findings remain in the wallet dependency graph with bounded evidence and explicit follow-ups.

See the [cleanup report](2026-09-18-dependency-security-cleanup.md) for exact versions, overrides, evidence, and temporary development dispositions. Recheck at the Arc contract/configuration phase, before public deployment, or by October 2, 2026, whichever comes first. Wallet URI decoding must be fixed or receive a targeted reachability/mitigation review before public wallet exposure. No blanket security clearance or permanent advisory waiver is granted.

### 3. Bootstrap a fresh development database

Completed locally on September 19. Supabase creation was blocked by the account's two-active-free-project limit; the user explicitly deferred hosted provisioning and any upgrade until the product takes shape. No hosted project or subscription was changed.

Created a private persistent PostgreSQL development cluster with separate migration/runtime roles. Applied all six migrations and a server-only RLS/access profile; seeded all eight canonical cities and explicit paused configuration without market history. Seed reruns preserve IDs, settings, and activation choices. `npm run dev` now starts the owned local database and uses an isolated `.env.arc-dev` profile, preserving the legacy `.env`.

Added live database/seed health checks, uncached HTTP 503 failures, truthful homepage/history error states, and preflight database/pause checks on creation and both settlement paths. Removed the scheduler's database-failure fallback and automatic configuration creation on admin reads. Post-transaction reconciliation and other phase 4 correctness work remain outstanding.

Exit verified locally: fresh migrations under the restricted migration role, idempotent seed, runtime role permissions, full verification/builds, and actual browser/HTTP outage-and-recovery checks. Eight active cities, zero markets, and both pause flags confirmed. Active on-chain markets remain unavailable until Arc RPC/contract configuration is supplied; database history correctly shows empty. Hosted connectivity/advisors and wallet acceptance remain future gates.

See the [phase 3 report](2026-09-19-phase-3-development-database.md) and [local database guide](../testing/arc-development-database.md). Hosted infrastructure can be added later using the same migrations, access profile, and seed.

### 4. Repair the money and settlement paths needed for USDC

Completed locally on September 19. Source contract version 2.2.0 freezes settled
payouts to recorded fees and returns complete refund amounts. Individual/bulk claims
use the supported claim method, including NoWinners and both-side stakes. Settled
summaries use recorded fees instead of a current/default percentage.

Settlement validates observations within the ten-minute target window, retries
transient failures within that window, then cancels overdue markets for refunds.
Exact-target caching prevents stale observations from crossing market boundaries.
Scheduled creation uses contract-enforced idempotent hourly slots, at most five per
UTC day, with resolution exactly 24 hours after the creation block. The manual
owner-only creation function remains available for deliberate test lifecycles.

Workers and admin cancellation reconcile confirmed chain state into unique database
records and return visible failures when persistence fails. Retries recover without
repeating successful transactions. Database binding to one chain/contract and a
2.2.0 version requirement protect legacy deployments from this restart workflow.

Exit verified: full local verification, regression/fuzz tests, actual PostgreSQL
concurrency and recovery, and persistent local migrations. No deployment, contract
upgrade, connected-wallet acceptance, or hosted schedule change occurred. See the
[phase 4 report](2026-09-19-phase-4-money-settlement.md) for evidence, operating rules,
and remaining Arc acceptance gates.
## First milestone and repository decision gate: one Arc testnet lifecycle

Replace hardcoded Coston2 transaction/read/explorer paths with consistent Arc configuration. Use native USDC throughout the existing payable-bet flow, validate the 18-decimal native representation, and update names, balances, fee estimates, minimum-bet handling, and displayed precision coherently. Do not apply six-decimal ERC-20 USDC parsing to native transaction values.

Deploy a fresh testnet contract and prove market creation/display → wallet connection → opposing bets → weather resolution → winning claim, plus cancellation/refund and one-sided-market behavior. Invoke creation and settlement deliberately while schedules remain disabled. Verify transaction receipts, displayed balances and amounts, and matching database records; a build or cached homepage alone is not acceptance evidence.

At this gate, assess whether the core flow can operate independently of deferred subsystems. If it can, continue in this repository. If it requires pervasive changes across those subsystems, document the blockers and propose a bounded rebuild using this repository as reference. Do not create a new repository automatically.

After the milestone, validate scheduled creation/settlement, retries, the five-market daily limit, and recovery from failed database writes in the isolated environment. Enable only the necessary schedules after those checks pass. Reporting and other deferred features remain separate follow-ups. Mainnet launch and its operating budget remain a separate decision.

## Recommended next implementation task

Authorized execution plan: [Arc configuration and testnet wallet lifecycle](2026-09-19-arc-testnet-lifecycle.md). Implementation/deployment, live cancellation/refunds, and manual weather settlement/winning test claim are verified. Remaining acceptance evidence is tracked in [the lifecycle report](../testing/arc-testnet-lifecycle-acceptance.md).

Phases 1–4 are implemented and locally verified. Arc/native-USDC configuration and the fresh 2.2.0 testnet deployment are implemented.
The next gate is the real 24-hour weather settlement, NoWinners refund, and user-signed
browser bet/claim. The September 19 manual market resolved NO at 95.8°F, with the user payout subsequently claimed and verified. Markets 2 and 3 were created September 20, with exact 24-hour core duration and required stakes verified. The same heartbeat next runs September 21 at 07:09:47 Central for settlement and generated-wallet claims.
Current stable Thirdweb/Viem versions and remaining advisory paths were rechecked.
Keep existing claims separate and hosted schedules disabled until live lifecycle,
retry, daily-limit, and reconciliation acceptance passes. Supabase remains deferred
by the user's decision; the owned local database is the development baseline.
Hosted CI still needs a run after a future push/PR.
## Cancellation evidence

All eight transactions succeeded on chain 114; contract market count remained 2571 and all targeted statuses were verified Cancelled.

| Market | Transaction |
|---|---|
| 1280 | [Receipt](https://coston2-explorer.flare.network/tx/0x907617ccb0448c361b5103f2d86404d3b5aa72f62ffd47885191ff0d29a5b310) |
| 1281 | [Receipt](https://coston2-explorer.flare.network/tx/0x6752f4c31c4a0423f9e94f2fcda076b59eb7c36ae1a34dbb2b6c96014d2875c5) |
| 1293 | [Receipt](https://coston2-explorer.flare.network/tx/0x3de6a3ae012241be4e9125952332e84f0627e2f90795404f71111cc68dcecbbd) |
| 2566 | [Receipt](https://coston2-explorer.flare.network/tx/0xfe53196cebf9d5fabd09a1c01c5f6a8df395fcdf39003427fb75a0a238f70d64) |
| 2567 | [Receipt](https://coston2-explorer.flare.network/tx/0xf0aa8f77dc63595678d6a7a7d2c435efdddf6f57df6716c8da5d696ee3e84cb7) |
| 2568 | [Receipt](https://coston2-explorer.flare.network/tx/0x2ee2e51b304e1ba31d23606ada72d91a2c8ff18085139be227deac165e47e8b7) |
| 2569 | [Receipt](https://coston2-explorer.flare.network/tx/0x4c3195208231b74da5499745b171e30181d8323b896d2a96809df0ec0c979d73) |
| 2570 | [Receipt](https://coston2-explorer.flare.network/tx/0xe6c003eddc81a6f8ca20da631620d0bd61ef3f05990af53e21f1238992f09e41) |

References: [Vercel Node runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Arc native USDC model](https://docs.arc.io/arc/concepts/stablecoin-native-model).
