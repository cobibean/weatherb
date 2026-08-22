# WeatherB npm and Node 26 workspace memory - 2026-08-21

## Session summary

- Converted the active development, CI, and Vercel package workflow from pnpm
  to npm.
- Pinned local and CI Node to `26.7.0` and npm to `11.19.0`.
- Added an npm workspace lockfile and removed the pnpm lockfile and workspace
  configuration.

## Decisions made

- Root `package.json` is the npm workspace source of truth for `apps/*`,
  `packages/*`, and `contracts`.
- npm 11.19.0 rejects pnpm's `workspace:*` protocol. `@weatherb/web` and
  `@weatherb/market-bot` now link `@weatherb/shared` with
  `file:../../packages/shared`.
- Coinbase's SDK exposes `@x402/*` as optional peers, while Thirdweb imports
  them during homepage compilation. The web workspace declares the four
  required `@x402` packages explicitly.
- Historical planning and handoff documents retain their original pnpm command
  history. Active developer-facing commands use npm.

## Files changed

- Root package scripts, Node pin, npm workspace metadata, and npm lockfile.
- `apps/web/package.json` and `apps/market-bot/package.json` workspace links.
- GitHub Actions, Vercel settings, README, and active helper-script usage
  guidance.
- Removed `pnpm-lock.yaml` and `pnpm-workspace.yaml`.

## Commands and verification

- `node --version` returned `v26.7.0`; `npm --version` returned `11.19.0`.
- `npm ci` completed from the generated lockfile.
- `npm run dev` started Next.js successfully and loaded `next.config.mjs`; the
  prior missing-`dotenv` startup error is resolved.
- Requesting `/` compiles the page successfully. It returns HTTP 500 in this
  checkout because `.env` is absent and `RPC_URL` plus `DATABASE_URL` are not
  configured.

## Gotchas and constraints

- npm reported 40 dependency advisories during install. No audit fix was run.
- `npm run lint` reaches the web package's existing unsupported `next lint`
  command. Direct ESLint reports 251 existing errors and one warning. This was
  left outside the npm switchover scope.

## Recommended next work

- Create a local `.env` from `.env.example` and supply valid development
  `RPC_URL` and `DATABASE_URL` values before expecting the homepage to load.
- Treat the web lint migration and its existing findings as a separate cleanup
  task.
