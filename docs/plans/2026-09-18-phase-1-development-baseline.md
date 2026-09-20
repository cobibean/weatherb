# Phase 1: reproducible development baseline

Date: September 18, 2026
Branch: `codex/arc-phase-1-baseline`
Status: phase 1 complete

## Scope

Preserved local `master` at `a003419`, created the restart branch, and merged upstream `b1a0a98` without discarding the local npm conversion or upstream documentation redaction. Unrelated untracked research and notes remain untouched. No branch was pushed, no deployment was created, and no contract was upgraded.

Updated direct dependencies across all workspaces, including the deferred bot's manifest. This does not restore optional product features or implement Arc transaction configuration. Solidity market behavior is unchanged.

## Toolchain and setup

- Local/CI Node: 24.21.0 in `.nvmrc`; Vercel uses its supported 24.x runtime.
- npm: 12.0.2, including CI and Vercel install commands. Its new install-script policy explicitly allows the eight required packages at pinned versions.
- Foundry: 1.8.3 in `.foundry-version`, downloaded into ignored `.tools/` and checked against committed SHA-256 release checksums. The wrapper rejects a different installed version.
- Solidity compiler: 0.8.37, optimizer 200 runs, explicit Paris EVM target to avoid changing target-opcode requirements during the dependency upgrade. Arc-specific execution checks remain later work.
- OpenZeppelin contracts and upgradeable contracts: 5.7.0, installed through the npm lockfile.
- forge-std: v1.16.2, pinned as a real Git submodule. The dangling OpenZeppelin submodule entry was removed.
- CI checkout/setup-node actions: v7.0.1/v7.0.0.

```sh
nvm install
nvm use
npm install --global npm@12.0.2
npm ci
npm run setup:contracts
npm --workspace=@weatherb/contracts run build
npm --workspace=@weatherb/contracts run test
npm run check:abi
```

The Vercel project settings now match npm and Node 24. The existing deployment is unchanged, and the recorded cron disable timestamp remains unchanged.

## Stable-version exceptions and compatibility work

Registry versions were checked live on September 18. Direct dependencies use exact versions and the lockfile pins the resolved tree. Excluded prereleases, including Prisma's `latest` tag pointing at 8.0.0-rc.15; selected stable Prisma 7.10.0.

- TypeScript 5.9.3: newest stable release satisfying the wallet SDK's Solana dependency peers (`^5.0.0`). TypeScript ESLint also does not yet support TypeScript 7. Do not force incompatible peers to claim a latest-version upgrade.
- ESLint 9.39.5: Next's React lint plugin does not yet declare ESLint 10 support. ESLint 9 is deprecated upstream; revisit when the plugin supports 10.
- Node 24 and matching `@types/node` 24.13.5 follow the deployment runtime, rather than using Node 26 types for unavailable APIs.
- Explicit AJV 8.20.0 satisfies the form resolver's optional peer without incorrectly resolving ESLint's AJV 6.
- Scoped override: Valtio 1.13.2's old, exact `use-sync-external-store` 1.2.0 pin is replaced with stable 1.7.0, which declares React 19 support. No broad peer-dependency suppression is enabled.
- `@react-email/components` 1.0.12 is the latest stable published release but is deprecated. Email remains deferred; replacing that subsystem is not phase 1 work.

Prisma now has a CLI config for schema/migrations/direct URL and PostgreSQL driver adapters for runtime access. Missing DATABASE_URL fails explicitly instead of node-postgres silently selecting a local default database. Generation remains database-independent. Kept the supported `prisma-client-js` generator to preserve imports; generator modernization is not required for this restart.

Tailwind's official migration tool moved the existing theme to CSS and translated v3 utility names. Restored its omitted animation plugin and corrected two component variant strings the tool mistakenly treated as CSS. Preserved the existing interface direction. PostCSS and shadcn configuration now match Tailwind 4.

Separated browser-safe position serialization and test-progress calculation from database modules so the new PostgreSQL driver cannot enter the browser bundle. ESLint now uses flat configuration. Vitest 5 has explicit JSX transformation and the current matcher-type augmentation; existing stale test fixtures remain phase 2 work. Disabled Next's new automatic agent-rule generation to keep project instructions maintained by the repository.

Generated the shared ABI from compiled WeatherMarketV2 source version 2.1.0 and added a drift check. All 25 existing function signatures are preserved. Additional functions, events, and errors reflect the source; this does not make the legacy deployed contract version 2.1.0 or change its claim behavior.

## Verification

- Fresh temporary source directory: `npm ci` and Prisma generation pass without database credentials.
- Complete dependency tree passes `npm ls --all`, both locally and after the final clean install.
- Foundry build passes; 107/107 existing contract tests pass on the pinned compiler and libraries.
- Shared package build and 41/41 tests pass.
- Shared ABI exactly matches the compiler artifact.
- Prisma 7 applies all six migrations to an empty temporary PostgreSQL 14 database; schema diff reports no difference. Driver create/read/delete and Date round-trip pass across the 16-table schema. Temporary server stopped; no Supabase project created.
- Next production **compile mode** passes for the application. This deliberately does not claim a complete production build: normal typechecking still sees the pre-existing test-fixture failures.
- Web typechecking: 231 diagnostics, all in the same pre-existing test files; no application-source diagnostics after upgrade compatibility fixes.
- Browser: local docs and logged-out positions page render. Wallet-connected betting/claims, live services, and a full responsive regression pass remain unverified. Browser MetaMask extension session restoration emitted an error; no wallet transaction was attempted.
- Network-denied web smoke check: six market-summary tests pass; three admin-page tests retain the known Next cookies/request-context failure. Used a dummy database URL and denied all network access; no database fixtures were run.
- Lint command runs with the new configuration, but the existing lint backlog and additional current-rule findings remain for phase 2. Newly added setup/config/helper files pass their focused lint check.

## Remaining boundaries

The latest package audit still reports 36 advisories (26 moderate, 10 high; zero critical), including transitive dependencies of Prisma tooling and the wallet SDK. This is not a security clearance. Do not apply `npm audit fix --force` suggestions that downgrade those SDKs to unrelated major versions. Triage before any real-USDC launch.

The optional bot still has its existing inferred wallet-client declaration portability problem, with additional diagnostic variants from current viem types. No bot integration scripts were run.

Phase 2 owns safe database-test isolation, stale fixtures/mocks, the remaining lint/typecheck backlog, and a full green build for the narrowed restart scope. The ordinary full web test command is still unsafe with real credentials because existing fixtures load the root environment and delete tables. Do not run it until isolation is implemented.

Phase 3 owns fresh hosted database provisioning and idempotent seed data. Phase 4 owns payout/refund/fee/retry correctness changes. All scheduled production jobs remain disabled. Nothing in phase 1 authorizes their resumption or a mainnet launch.

## Direct dependency inventory

| Package | Selected stable version |
| --- | --- |
| @anthropic-ai/sdk | 0.127.0 |
| @hookform/resolvers | 5.9.1 |
| @openzeppelin/contracts | 5.7.0 |
| @openzeppelin/contracts-upgradeable | 5.7.0 |
| @prisma/adapter-pg | 7.10.0 |
| @prisma/client | 7.10.0 |
| @radix-ui/react-dialog | 1.1.23 |
| @radix-ui/react-label | 2.1.15 |
| @radix-ui/react-select | 2.3.7 |
| @radix-ui/react-slot | 1.3.3 |
| @radix-ui/react-tabs | 1.1.21 |
| @radix-ui/react-toast | 1.2.23 |
| @react-email/components | 1.0.12 |
| @react-email/render | 2.1.0 |
| @tailwindcss/postcss | 4.3.3 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/react | 16.3.3 |
| @types/express | 5.0.6 |
| @types/node | 24.13.5 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| @upstash/qstash | 2.11.3 |
| @upstash/redis | 1.38.4 |
| @x402/core | 2.26.0 |
| @x402/evm | 2.26.0 |
| @x402/extensions | 2.26.0 |
| @x402/svm | 2.26.0 |
| ajv | 8.20.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| dotenv | 18.0.0 |
| dotenv-cli | 11.0.0 |
| eslint | 9.39.5 |
| eslint-config-next | 16.3.5 |
| eslint-config-prettier | 10.1.8 |
| express | 5.2.1 |
| framer-motion | 13.4.0 |
| googleapis | 181.0.0 |
| ioredis | 6.0.0 |
| jsdom | 30.1.0 |
| lucide-react | 1.47.0 |
| next | 16.3.5 |
| openai | 7.18.0 |
| postcss | 8.5.28 |
| prettier | 3.9.8 |
| prisma | 7.10.0 |
| react | 19.3.0 |
| react-dom | 19.3.0 |
| react-hook-form | 7.88.0 |
| resend | 6.28.1 |
| tailwind-merge | 3.7.0 |
| tailwindcss | 4.3.3 |
| tailwindcss-animate | 1.0.7 |
| thirdweb | 5.121.4 |
| tsx | 4.23.13 |
| typescript | 5.9.3 |
| typescript-eslint | 8.70.0 |
| viem | 2.56.8 |
| vitest | 5.0.1 |
| zod | 4.6.5 |

Sources: [Node releases](https://nodejs.org/dist/index.json), [Vercel Node support](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Foundry release](https://github.com/foundry-rs/foundry/releases/tag/v1.8.3), [OpenZeppelin release](https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.7.0), [Prisma 7 upgrade](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7), [Tailwind upgrade](https://tailwindcss.com/docs/upgrade-guide), [Vitest matcher migration](https://main.vitest.dev/guide/extending-matchers).
