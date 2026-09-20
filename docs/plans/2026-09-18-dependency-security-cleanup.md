# Dependency security cleanup

Date: September 18, 2026
Scope: bounded follow-up between phases 2 and 3; local dependency changes only

## Result

The full npm audit decreased from 36 affected package entries (10 high, 26 moderate)
to 27 (4 high, 23 moderate), with no critical findings. Nine underlying advisory-bearing
packages decreased to three. Parent packages inherit findings, so these totals do not
mean 27 independent vulnerabilities. This is a triage and compatible-update pass,
not security clearance for public deployment.

## Applied updates

| Package | Before | After | Resolution |
| --- | --- | --- | --- |
| `fast-uri` | 3.1.5 | 3.1.8 | Refresh within existing AJV ranges |
| `hono` | 4.13.3 | 4.13.8 | Refresh within Porto's existing range |
| `qs` | 6.15.3 | 6.16.0 | Refresh within existing ranges |
| `ws` | Nested 8.18.0 / 8.18.2 / 8.18.3 | 8.21.3 | Override vulnerable 8.x versions; retain separate 7.x dependency |
| `js-yaml` | Nested 4.2.0 | 4.3.2 | Override vulnerable 4.x versions; reuse patched hoisted copy |
| `mysql2` | 3.15.3 | 3.24.4 | Override Prisma 7.10.0's exact dependency within MySQL2 major 3 |

Overrides are recorded in the root manifest. They should be removed when parent
releases select patched versions themselves. No direct application dependency was
downgraded or moved across a major version. The MySQL2 update replaces its `sqlstring`
and `seq-queue` dependencies with `sql-escaper`; weatherB still uses PostgreSQL.

## Latest stable wallet dependencies

The user reaffirmed a preference for current stable dependencies during this pass.
Live npm registry checks confirmed Thirdweb 5.121.4 and direct Viem 2.56.8 are already
their latest stable releases. Thirdweb itself pins WalletConnect sign-client and
universal-provider 2.21.8 and Viem 2.39.0. The registry has WalletConnect 2.25.0;
other installed paths also retain Reown 1.7.8 (latest 1.8.24) and MetaMask SDK 0.33.1
(latest 0.34.0). These are upstream transitive pins, not intentionally old direct
application dependencies.

Before Arc wallet integration, recheck parent releases and resolve this dependency
choice explicitly. Prefer current supported parent packages. If Thirdweb still pins
older versions, evaluate a coordinated wallet-package update with connected-wallet
verification or a separately scoped SDK replacement. Do not blanket-override these
coupled packages and infer compatibility from a build. This cleanup did not authorize
or perform a wallet-provider migration, nor did it establish that the older pins are
permanently acceptable.

## Remaining findings and decision

These are temporary development dispositions owned by weatherB's maintainer. Recheck
at the Arc contract/configuration phase, before any public deployment, or by October 2,
2026, whichever comes first. Reopen immediately if the affected inputs or dependencies
change. The date is a review deadline, not a scheduled automation.

| Advisory / path | Evidence and development disposition | Release follow-up |
| --- | --- | --- |
| [DeepmergeTS recursive graph exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), high; Prisma → `@prisma/config` → `deepmerge-ts@7.1.5` | The four remaining high package entries all trace here, including the Prisma client peer relationship. The observed invocation is Prisma CLI config loading (`@prisma/config/dist/index.js`), using the committed `apps/web/prisma.config.ts`; config objects are repository-controlled, not HTTP input. Local development can continue with trusted config. | Fixed in major 8; Prisma pins 7.1.5. Prefer a compatible Prisma release. If unresolved, explicitly re-review this trusted-tooling boundary before release; do not silently suppress the advisory or force a Prisma downgrade. |
| [UUID output-buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate; MetaMask packages → UUID 8/9 | Advisory concerns `v3`/`v5`/`v6` with caller-provided buffers. Inspected MetaMask SDK and communication-layer imports use `v4`/`validate`; inspected utils filesystem helpers use `v4()`. No affected invocation was found in those paths. This supports continued local development, not proof about every SDK branch. | Fixed starting at 11.1.1, outside parent ranges. Revisit compatible wallet SDK upgrades and connected-wallet acceptance; retain the exact input/method assessment if an exception is needed. |
| [URI decoding CPU exhaustion](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), moderate; WalletConnect utils → `query-string@7.1.3` → `decode-uri-component@0.2.2` | Old dependency remains installed through five WalletConnect utils copies. The inspected published URI implementations use `URLSearchParams`; this does not prove every wallet path excludes the vulnerable decoder. Do not claim reachable exploitation or complete unreachability. Local development may proceed. | Resolve before public wallet exposure through a compatible SDK update, or complete a targeted reachability/mitigation review. Patched decoder 0.5.0 is ESM while this query-string version uses a CommonJS function import, so a blind override is unsafe. |

No exploit payload was sent to a wallet, hosted service, or deployed app. No claim
of wallet-connected acceptance is made. These npm findings are separate from the
contract payout, refund, fee, and settlement correctness work in phase 4.

## Verification

- `npm run verify` passed: lint, active typechecking, 8 safety checks, 41 shared tests,
  94 web tests, 7 disposable PostgreSQL tests, 107 contract tests, full production
  builds, and compiled ABI consistency.
- `npm ls --all --json` passed with no invalid dependency/peer entries.
- Fresh `npm ci` completed in a temporary workspace containing manifests and Prisma
  schema/config, with service credentials stripped. Clean dependency-tree check
  and cleanup are recorded in the accompanying project memory.
- `npm audit --json` was rerun after updates. Its nonzero status is expected while
  these three underlying advisories remain; no audit exclusions were introduced.

Tests/builds establish compatibility for the checked paths, not absence of all
vulnerabilities. No production services, schedules, contract code, or deployments
changed. Phase 3 remains the next separately authorized implementation task.

## September 19 Arc integration checkpoint

Rechecked the registry: Thirdweb 5.121.4 and direct Viem 2.56.8 remain current stable.
The audit remains 27 entries, with the same three underlying advisories. Inspected
all five installed WalletConnect utils copies' published CJS, ESM and UMD bundles:
none imports query-string; the pairing URI parser uses URLSearchParams. The declared
query-string dependency remains installed. This is a narrower source-path assessment,
not a claim that the entire SDK is free of vulnerable call paths. Retained the current
supported parent release for local/testnet integration; no unsafe decoder/SDK major
overrides. Thirdweb's WalletConnect pairing UI loaded in the local browser. Actual
wallet signatures and public exposure remain acceptance gates in the
[Arc lifecycle report](../testing/arc-testnet-lifecycle-acceptance.md).
