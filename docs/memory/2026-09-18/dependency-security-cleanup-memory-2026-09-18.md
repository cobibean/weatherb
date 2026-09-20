# Dependency security cleanup — September 18, 2026

## Completed

- User authorized a small cleanup after phase 2, before phase 3, and reaffirmed
  current stable dependencies as a preference. No phase 3 infrastructure work began.
- Updated fast-uri 3.1.5→3.1.8, Hono 4.13.3→4.13.8, qs 6.15.3→6.16.0.
  Root overrides select patched ws 8.21.3 for vulnerable 8.x, js-yaml 4.3.2 for
  vulnerable 4.x, and mysql2 3.24.4 under Prisma 7.10.0. Existing ws 7.x retained.
- Audit: 36 entries (10 high/26 moderate) → 27 (4 high/23 moderate), zero critical.
  Nine advisory-bearing leaf packages → three: deepmerge-ts, uuid, decode-uri-component.
  Four high entries all trace to Prisma config tooling's deepmerge-ts dependency.
- Full `npm run verify` passed again: lint/types, 8 safety + 41 shared + 94 web +
  7 isolated DB + 107 contract tests, full builds, ABI match. No connected-wallet
  acceptance was performed. Workspace and clean-install `npm ls --all` passed.
- Fresh temporary-workspace `npm ci` passed with credentials stripped and Prisma
  generation enabled. Temporary workspace removed. No push/deploy/on-chain changes;
  hosted schedules remain untouched/paused. All prior uncommitted work preserved.

## Decisions and evidence

- Latest npm stable tags confirmed Thirdweb 5.121.4 and direct Viem 2.56.8 already
  current. Thirdweb pins WC 2.21.8 and Viem 2.39.0 internally despite newer versions.
  WC latest 2.25.0; Reown 1.8.24; MetaMask SDK 0.34.0. Do not conflate direct SDK
  currency with current transitive dependencies, or silently accept old pins forever.
- Prisma merges trusted committed config; recursive attacker-controlled graphs not
  identified in that path. Inspected MetaMask UUID uses were v4/validate, outside
  reported v3/v5/v6 buffer flaw. WalletConnect inspected URI code uses URLSearchParams,
  but vulnerable query-string/decoder still installed; full reachability not established.
- No breaking deepmerge/UUID/decoder overrides or npm force downgrades. Remaining
  items have review deadline October 2 or Arc contract/configuration phase or public
  deployment, whichever is first. Wallet decoder needs remediation or targeted
  reachability/mitigation review before public wallet exposure.
- Before Arc wallet work, explicitly assess current parent releases versus coordinated
  wallet upgrades with integration verification; replacing SDK is separate scope.

## Gotchas

- npm update/install retained a stale nested js-yaml despite a valid override. Removed
  only that lock entry and moved that generated package to a temporary backup, then
  npm install correctly reused hoisted patched js-yaml. Clean npm ci/tree passed,
  proving no reliance on a hand-edited node_modules patch. Backup removed afterward.
- Do not run npm audit fix --force: suggested Thirdweb 0.x / Prisma 6.x downgrades
  are not a supported remediation. Audit stays nonzero and is separate from verify.

## Source of truth

- `docs/plans/2026-09-18-dependency-security-cleanup.md`
- `docs/plans/2026-09-18-arc-usdc-readiness-plan.md`
- `docs/testing/development-verification.md`

Logs: `/tmp/weatherb-security-before.json`, `/tmp/weatherb-security-after.json`,
`/tmp/weatherb-security-verify.log`, `/tmp/weatherb-security-clean-install.log`,
`/tmp/weatherb-security-clean-tree.json`. Temporary logs contain no service credentials.
