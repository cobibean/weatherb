# Development verification

The active restart is the web app, shared package, contracts, and their imported
dependencies. All active source and active tests are typechecked and linted. No
`ignoreBuildErrors`, disabled lint rules, skipped active tests, or failing-source
exclusions are used to obtain the baseline.

## One command

After the phase 1 setup (`nvm use`, npm 12.0.2, `npm ci`, `npm run setup:contracts`):

```sh
npm run verify
```

This runs the same checks configured in `.github/workflows/ci.yml`. Hosted CI is
only exercised after a push/PR; a local run does not establish a GitHub result.

| Command | Boundary |
| --- | --- |
| `npm run lint` | Active web/shared source, verification scripts, contract setup/ABI tools; zero warnings |
| `npm run typecheck` | Active shared and web source plus their tests |
| `npm run test:unit` | Guard tests, shared tests, web tests; no live services |
| `npm test` | Unit checks plus all Foundry tests |
| `npm run test:db` | Fresh private PostgreSQL cluster, all committed migrations, actual Prisma/API fixtures, cleanup |
| `npm run build` | Shared declarations, full Next production build, contract compilation |
| `npm run check:abi` | Shared ABI compared with compiled contract artifact |
| `npm run check:deferred:bot` | Separate known-failing bot declaration check; never runs bot transactions |

## Credential and network isolation

Verification child processes receive only launch essentials and dummy app values.
Root `.env` is not loaded, Vite env-file loading is disabled, and the verification
build refuses app-local environment files. Prisma config skips dotenv in this mode.
Direct Vitest unit invocation also sanitizes its environment before test imports.

A preload guard blocks Node TCP/TLS/UDP, fetch, and WebSocket connections. Test
setup fails even when application code catches a blocked connection error. Service
boundaries are explicitly mocked. The only network exceptions are the disposable
PostgreSQL Unix socket and the exact loopback port assigned to a Turbopack build
worker for its internal IPC. This is protection against accidental service calls,
not a sandbox for malicious dependencies or arbitrary manual scripts.

The full verification build uses dummy public configuration. **Do not deploy its
artifact.** Vercel's web-workspace build remains the deployment command and requires
explicit destination configuration. Bundled licensed Sora/Jakarta fonts remove
Google Fonts requests during compilation.

## Disposable database

Install PostgreSQL tools locally (Homebrew `postgresql@14` or Ubuntu
`postgresql-16`). `WEATHERB_PG_BIN` can select another installation directory.
The runner creates a private mode-0700 directory and a new `weatherb_test` database,
with TCP disabled. No existing database is reused. A per-run marker and exact URL
check must pass before migrations or fixture imports. Caller-supplied
`TEST_DATABASE_URL`, shared targets, hosted targets, and direct unowned integration
config execution are rejected. Existing shell `DATABASE_URL` values are ignored.

Database tests use `*.db.test.ts`, a separate Vitest configuration, and sequential
files. Each file disconnects Prisma; the runner stops PostgreSQL and removes its
temporary directory on success or test failure. If stopping fails, the directory
is retained for recovery. A hard process kill or machine crash can leave a temporary
cluster; do not delete its directory until its PostgreSQL process has stopped.

For a local visual smoke check after `npm run build`:

```sh
node scripts/verification/database.mjs --serve
```

This serves port 3011 on loopback with an empty disposable database and blocked
external services. Stop with Ctrl-C to clean up. It has no real RPC or wallet
credentials: empty-state rendering is not proof of chain/service health. Browser
SDK behavior is outside the Node guard; do not connect a real wallet for this check.

## Deferred and still-open work

Run `npm audit` separately when dependencies change and before deployment. It is
not part of the offline `npm run verify` command and currently exits nonzero for
documented findings. See the [dependency security cleanup](../plans/2026-09-18-dependency-security-cleanup.md)
for remaining advisories, override rationale, and review deadlines. A green build
does not waive these findings; do not use `npm audit fix --force` to silence them.

`deferred/manifest.json` inventories preserved optional code. Its old routes are
410 stubs, pages are 404, navigation is removed, and active settlement/cancellation
has no Google Sheets dependency. `deferred/README.md` records the 231 old test type
errors and separate bot failure. These are not counted as passing tests. Historical
manual debug/transaction scripts are outside this verification command.

Phase 3 completed the [local database, seed, and health checks](arc-development-database.md).
Hosted Supabase provisioning was explicitly deferred. Tests still use a separate
disposable cluster and never touch the persistent development database.
Phase 4 locally verifies payout/refund/fee correctness and settlement/creation retries; see
[the phase 4 report](../plans/2026-09-19-phase-4-money-settlement.md).
The Arc testnet lifecycle and all wallet-connected acceptance remain later gates.
No verification command resumes hosted schedules, provisions Supabase, deploys,
or submits a blockchain transaction.
