# Phase 2: make verification safe and useful

Date: September 18, 2026
Branch: `codex/arc-phase-1-baseline`
Status: implementation and local verification complete; hosted CI execution pending a future push/PR

## Result

`npm run verify` is the local and CI verification command for active web/shared/contracts.
It removes inherited service credentials, separates database fixtures, and runs a
full production build. No hosted database, deployment, push, or on-chain action was
performed. Phase 3 has not started and hosted schedules have not been resumed.

## Changes

- Ordinary tests no longer load the root environment. Verification children receive
  only launch essentials and dummy settings. Unit-test config also protects direct
  Vitest invocation. Unexpected Node service connections are blocked; swallowed
  connection errors still fail tests.
- Database fixtures run only against a newly created, private PostgreSQL cluster.
  The runner validates its ownership marker and exact URL, applies all six migrations,
  runs the actual Prisma/API tests, then stops and removes the cluster. Hosted/shared
  targets and direct unowned integration execution fail before fixture imports.
- Preserved optional implementations and stale tests under `deferred/`, with a path
  manifest and explicit backlog. Former endpoints return 410, pages 404, and navigation
  no longer exposes them. Removed Sheets side effects from all three settlement/cancel
  paths. The standalone bot remains outside root build/typecheck/test commands.
- Active web/shared typechecking and lint now pass. Fixed return types, unused code,
  conditional hooks, and render/effect findings without turning checks off. Wallet
  changes remount wallet-specific view state; a shared clock updates countdowns;
  hydration checks and deterministic decorative particles avoid effect-only resets.
- Replaced copied/obsolete cron assertions with tests of actual handlers. Previously
  skipped settler tests run with correct city hashes, database mocks, and resettable
  provider mocks. Tests cover receipts before persistence, forecast rounding, hourly
  creation, city rotation, authentication, failures, and actual settlement arguments.
- A clock regression test exposed duplicated React copies: the app used 19.3.0 while
  hoisted Testing Library resolved 19.2.8. Root tooling now pins React/ReactDOM 19.3.0;
  the lockfile hoists a single matching pair. No broad peer suppression was added.
- Same Sora and Plus Jakarta Sans fonts now ship locally with licenses. Homepage
  live reads happen at request time rather than during a credential-free build.
- GitHub workflow uses the same `npm run verify` command and installs PostgreSQL 16
  tooling. Remote execution is unverified because this branch was not pushed.

## Evidence

- Lint with zero warnings; active shared/web typechecking with zero diagnostics.
- Eight safety checks, 41 shared tests, 94 web tests, seven isolated database tests,
  and 107 contract tests. Active tests have no skips.
- Full Next production build, shared/contract build, and compiled ABI match.
- Disposable database successfully rebuilt and tested repeatedly; no existing DB used. An intentional fixture failure returned nonzero while still stopping PostgreSQL and removing its temporary directory.
- Clean temporary-directory `npm ci` and full dependency tree check; one hoisted React pair.
- Browser smoke: desktop/mobile positions, mobile navigation, homepage empty state,
  explainer progression/close, styled docs, and `/admin` redirect to login. Mobile
  document width matched viewport width. No wallet was connected or transaction sent.
- The preview intentionally had no RPC service. Its empty market state is not evidence
  of healthy chain reads; existing stale health copy remains phase 3 work.

See [development verification](../testing/development-verification.md) for commands,
isolation guarantees, and limits. No full wallet-connected workflow or live service
acceptance is claimed.

## Dependency advisory disposition

Historical phase 2 snapshot below. The subsequent [dependency security cleanup](2026-09-18-dependency-security-cleanup.md) patched six underlying packages and reduced the audit to 27 entries (4 high, 23 moderate), with three remaining advisory-bearing packages and explicit review deadlines. Use that report for current disposition.

The refreshed npm audit reports 36 affected package entries (26 moderate, 10 high,
zero critical), including propagated parent entries. Package updates did not establish
security clearance. This pass identifies dependency paths; it is not an exploitability audit.

| Path / affected code | Disposition |
| --- | --- |
| Prisma CLI → `@prisma/config` → `deepmerge-ts`; Prisma → `mysql2` | Tooling path; verification uses committed local schema/config and PostgreSQL, not MySQL. Revisit fixed compatible tooling before launch. |
| AJV → `fast-uri` via web form resolver, Prisma streams, and x402 | Active dependency graph. URI normalization/SSRF advisories require reachability review before real-USDC deployment. |
| Thirdweb → wallet/connectors → `decode-uri-component`, `uuid`, `ws`; Porto → `hono` | Active wallet dependency graph. Input parsing, memory/DoS, and other upstream advisories remain a launch gate; no claim of safe reachability. |
| Hey API schema tooling → `js-yaml` | Transitive tooling path; keep input trusted and re-evaluate compatible patch availability. |
| Express/body-parser and Google API packages → `qs` | Deferred bot/reporting implementations are unreachable from the active web app; installed dependencies remain visible in audit. Reassess on restoration. |

Do not apply audit suggestions that downgrade Thirdweb to 0.x or Prisma to 6.x.
TypeScript 5.9 and ESLint 9 compatibility holds remain documented in phase 1.

## Remaining gates

- Hosted CI result after a separately scheduled push/PR.
- Phase 3: fresh development database, idempotent city/config seeds, service-health truthfulness.
- Phase 4: refund amount/method, settled-fee consistency, weather timing, daily-limit/
  duplicate prevention, chain-write/database reconciliation.
- Arc configuration, USDC precision, fresh testnet deployment, and complete wallet lifecycle.
- Deferred feature restoration requires its own implementation and verification.
