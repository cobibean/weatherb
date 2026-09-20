# weatherB phase 1 baseline — September 18, 2026

## Completed scope

- User authorized phase 1 only, plus updating all packages to stable releases.
- Work is on `codex/arc-phase-1-baseline`; local master was preserved at `a003419`, and upstream `b1a0a98` was merged. Implementation changes are local; no push or deployment.
- Node 24.21.0, npm 12.0.2, Foundry 1.8.3, Solidity 0.8.37 (Paris), OpenZeppelin 5.7.0, and forge-std 1.16.2 are pinned. Foundry is installed locally with committed release checksums; OpenZeppelin uses npm; forge-std has an actual Git submodule pin.
- Vercel project install/build commands now use npm, with Node 24.x. Cron disable state was preserved. No QStash or on-chain changes this phase.

## Compatibility findings

- Prisma's latest tag points to an RC; stable 7.10.0 was selected. Runtime clients now need the PostgreSQL adapter, and migration URLs live in `apps/web/prisma.config.ts`.
- TypeScript stays at stable 5.9.3 because wallet/Solana dependency peers require version 5. ESLint stays at 9.39.5 because Next's React plugin does not support 10. Node types match Node 24.
- Valtio 1.13.2 pins a React-18-era external-store shim. A scoped override to stable 1.7.0 clears its React 19 peer conflict; explicit AJV 8 clears the form resolver peer conflict. Full dependency tree now passes.
- Tailwind's official migrator omitted the animation plugin and incorrectly renamed two non-CSS `outline` variant strings; both were corrected. Theme is now in globals.css.
- New Prisma adapter exposed browser imports of database modules. Position serialization and test-progress calculation now live in browser-safe modules.
- Vitest 5 needs explicit JSX transformation and Matchers augmentation. Register jest-dom matchers from the web workspace instead of its `/vitest` entry, which could not resolve the nested Vitest installation.
- Next 16.3 automatically generated agent instruction files during development; disabled `agentRules` and removed only those newly generated files.

## Evidence and limits

- Final fresh-directory `npm ci` and `npm ls --all` passed.
- Contract build, all 107 contract tests, shared build, and all 41 shared tests passed.
- Shared ABI regenerated from source 2.1.0, preserving all 25 existing function signatures; compiler comparison passes. Legacy deployed contract remains 2.0.0.
- Prisma 7 applied all six migrations to an empty local PostgreSQL 14 instance; 16 tables and no schema drift. Driver create/read/delete and Date conversion passed. Temporary server stopped; no Supabase project created.
- Next production compile mode passed. This is not a full green production build.
- Web typing remains at the original 231 diagnostics in test files, with no application-source errors. Bot declaration portability errors remain. Lint backlog remains.
- Network-denied web smoke check: six market-summary tests pass; three admin-page tests retain the known cookies/request-context failure. Full web suite was not run.
- Local docs and logged-out positions page rendered in Chrome. Wallet flows and comprehensive responsive acceptance were not tested.
- Audit still reports 36 upstream advisories: 26 moderate, 10 high, zero critical. Do not treat package updates as a security clearance.

## Next boundary

Phase 2 requires a separate user go-ahead. It owns database-test isolation and the narrowed core verification backlog. Existing full web tests load the root environment and can delete whole tables; do not run them with real credentials. Optional product features remain deferred and hosted jobs remain disabled.

Sources of truth: `docs/plans/2026-09-18-phase-1-development-baseline.md`, `docs/plans/2026-09-18-arc-usdc-readiness-plan.md`, manifests/lockfile, `.nvmrc`, `.foundry-version`, `contracts/foundry.toml`.
