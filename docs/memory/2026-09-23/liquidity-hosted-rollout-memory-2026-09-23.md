# Hosted market-liquidity rollout — 2026-09-23

## Result and authorization

The user explicitly requested deployment and activation for the next public markets, followed by a Codex check tomorrow. Feature commit `9fbb1de9d0aafb5c862457aa951e1c1ef4915c13` was deployed to both production Vercel projects. Seeding and claims are enabled. Actual new-market deposits and subsequent payouts remain to be observed.

## Deployment and activation evidence

- Public: `dpl_3VfnQHPv9U9FDCNZb2oE1YTKRtmB`, READY, https://weatherb-my5gbn2b1-cobi-beans-projects.vercel.app, aliased to https://weatherb.vercel.app.
- Worker: `dpl_DVEf4xoLFjsNmpJ6iDj1ExBoYcx3`, READY, https://weatherb-arc-worker-gk48bgrs4-cobi-beans-projects.vercel.app, aliased to https://weatherb-arc-worker.vercel.app.
- Applied `20260923120000_market_liquidity` with the existing migration role, then `scripts/development/access.sql`. Both operations succeeded. Existing market data was preserved.
- Verified runtime grants: `weatherb_app` can toggle liquidity settings but cannot read `LiquidityTransaction` or change the wallet binding; `weatherb_worker` can read its transaction journal and bind its wallet but cannot toggle seeding.
- The maker signer was added only to the worker's sensitive production environment. `LIQUIDITY_ADMIN_WRITES_ENABLED=true` was added to the public environment and protected local hosted profile. Public environment inventory contains no signer or migration-owner connection.
- Chain: Arc Testnet `5042002`; proxy `0xd86e2774e4a9bf2e86199791068b9350b718b891`; contract version `2.4.0`.
- Maker: `0x77a7b8856D90798eff57D4dbfe16a3D182F883EC`, distinct from on-chain owner, scheduler, and settler. The user manually topped it up; confirmed native balance was **120 USDC** at rollout.
- Activated at `2026-09-23T20:57:16.732Z` (3:57 PM Central). Config version **2**, amount **2.50 USDC per side**, maximum **5** held markets, seeding **on**, claims **on**.
- Immutable first-eligible market ID **26**, activation block **63652855**. Existing IDs 0–25 are excluded. TEST/canary and UNKNOWN classifications remain ineligible regardless of ID.
- Activation called the existing `saveLiquidityConfig` service under the restricted hosted app credentials, preserving its chain/version/minimum/readiness checks, compare-and-set version, immutable cutoff, and atomic audit. The audit actor is explicitly `operator:codex:user-authorized-rollout:2026-09-23`; no admin session was fabricated, admin allowlist changed, or human wallet impersonated. The local contract-owner and maker wallets are not dashboard admins. Future dashboard changes use the user's verified admin wallet session.

## Hosted checks

- Both health endpoints returned HTTP 200 and `ready`; scheduler and settler enabled; no overdue or due markets at rollout.
- A disabled maker tick returned HTTP 200, `disabled`, zero errors. After activation, a tick returned HTTP 200, `ready`, zero errors and no deposits into older markets.
- The existing QStash sweep independently produced a successful maker run at `20:58:02.442Z` and successful settlement sweep at `20:58:02.763Z`. Maker heartbeat/reconciliation refreshed at `20:58:03Z`, with no current failure or active incident. Zero positions/held slots is expected before the next eligible public creation.
- Anonymous maker POST returned 401 on both projects. Anonymous admin config GET/PATCH were intercepted by middleware with 307 redirects to admin login; no settings data or write access was exposed. A fetch following that redirect reports the login page's HTTP 200, not an authenticated API response.
- Existing QStash schedules were inspected and left unchanged: sweep `*/2 * * * *`; daily public creation `5 12-16 * * *`; TEST canary `30 2 * * *`. All are active and target the dedicated worker. No additional settlement writer or recurring QStash schedule was created.
- Prior local implementation verification passed 516 tests plus lint, typecheck, build, ABI, and storage checks. This rollout separately proved hosted migration, grants, deployment, configuration, wallet balance, and worker execution. It has not yet proved a new public market's seed/claim lifecycle.

## Scheduled acceptance check

Created a new, active, one-time Codex heartbeat **Check WeatherB market-maker launch**, ID `check-weatherb-market-maker-launch`, attached to this task. It is scheduled for **September 24, 2026 at 11:30 AM America/Chicago** (16:30 UTC), after the five public launches at 7:05, 8:05, 9:05, 10:05, and 11:05 AM Central.

The check is read-only: verify creation/classification, exactly 2.50 USDC YES and NO from the maker for each new public market, successful receipts/events and chain positions, no duplicates or unresolved nonces, five-slot capacity, worker health, incidents, and remaining balance. Report evidence or actionable failures. The 24-hour markets normally do not resolve until September 25, so claims still pending on September 24 are expected; do not claim payout acceptance without actual receipts. The old paused lifecycle automation remains paused.

## References and constraints

- Plan: `docs/plans/2026-09-23-automated-market-liquidity.md`.
- Operator runbook: `docs/testing/automated-market-liquidity.md`.
- Hosted roles/schedules: `docs/testing/arc-hosted-testnet.md`.
- Local protected `.env.arc-hosted` and `.env.arc-worker` profiles remain the operational entry points. Never print their values or copy secrets to notes.
- Local service invocation used pinned Node `24.21.0` with `TSX_TSCONFIG_PATH=tsconfig.json` from `apps/web`. In this environment, the tsx CLI's explicit `--tsconfig tsconfig.json -e` invocation exited successfully without executing the expression; a zero exit alone was insufficient evidence. Database readback confirmed the actual successful activation.
