# Arc development database

Task 3 uses a local PostgreSQL database. Supabase provisioning was deferred by the
user on September 19, 2026 after the free-project limit blocked creation. There is
no new hosted project, subscription, or deployment.

## Start or rebuild the baseline

Use the pinned Node/npm toolchain (`nvm use`). PostgreSQL command-line tools must be
installed. Scripts detect Homebrew PostgreSQL 14 or Linux PostgreSQL 16; set
`WEATHERB_PG_BIN` to the directory containing your compatible `initdb`, `pg_ctl`,
`psql`, and `createdb` binaries if needed. The current Mac setup uses PostgreSQL 14.

```sh
npm run arc:setup
npm run arc:migrate
npm run arc:seed
npm run arc:check
npm run dev
```

For the existing initialized checkout, `npm run dev` starts the database if needed
and then serves the app on loopback. These commands never reset or drop a database.
To stop PostgreSQL after stopping the web server:

```sh
npm run arc:stop
```

Data survives restarts in ignored `.tools/arc-postgres/data`. The cluster has no TCP
listener; its private Unix socket uses port number 55439 to distinguish it from
other local instances. Ownership metadata binds it to this checkout. Setup refuses
an existing unrecognized directory/profile rather than adopting it. Moving the
checkout or changing PostgreSQL major versions requires deliberate data migration.

Setup generates separate local passwords into ignored, mode-0600 files:
`.env.arc-dev` for application/migration URLs and `.tools/arc-postgres/admin-password`
for local cluster administration. Never commit or paste these values. The legacy
root `.env` is preserved and is not loaded by `npm run dev` or the `arc:*` commands.

## Roles, schema, and seeds

- `weatherb_migrator`: owns the migrated application tables, can create schema
  objects in this development database, and applies the access profile. Its URL
  is provided only to the migration command, never to Next.
- `weatherb_app`: no schema creation, role management, database creation, or RLS
  bypass. It can read/write only City, Market, SystemConfig, AdminLog, AdminSession.
- Six existing Prisma migrations create 16 application tables. The access profile
  enables RLS on these tables and Prisma's migration table, revokes browser/Data API
  role grants when those roles exist, and grants the server role access to five
  active tables through explicit policies. Deferred tables and migration metadata
  remain inaccessible to the runtime role.
- `scripts/development/bootstrap-roles.sql` runs as the new database administrator.
  `arc:migrate` runs Prisma `migrate deploy`, then the repeatable `access.sql` profile
  as the migration owner. Both files are required when recreating the environment.
- The seed adds missing cities from `packages/shared/src/constants/cities.ts` and
  an explicit default configuration: test mode, five markets/day, 600-second betting
  buffer, creation paused, settlement paused. It preserves existing IDs, city edits,
  activation choices, configuration, and history. It never inserts markets or keys.

The profile deliberately omits RPC, contract, wallet, signing, Redis, QStash, and
weather credentials. Arc configuration comes later. Do not copy legacy credentials
into this file to make the homepage look healthy.

## Readiness and failure behavior

- `npm run arc:check` verifies canonical city slugs/configuration and reports market
  count and pause flags using the runtime role.
- `/api/health` checks the live database and seed, with `Cache-Control: no-store`.
  Ready database → HTTP 200; missing configuration, incomplete seed, or failed reads
  → HTTP 503. `scope: database` is explicit: this does not certify RPC, weather, or
  hosted scheduler health. Pause flags are reported separately.
- Market-history reads check readiness before cached results. Database failures
  return 503 rather than a misleading empty list or cached success.
- The homepage distinguishes unavailable services from a successful empty market
  read. The unconditional “All systems operational” footer was removed. With Arc
  RPC/contract intentionally unset, active markets show unavailable while history
  correctly shows empty. This is expected until Arc integration.
- Creation and both settlement endpoints check database readiness/pause flags before
  external work. Paused requests explicitly report `skipped`; DB failures return
  503. The scheduler no longer falls back to hardcoded cities during DB failure.

These new local checks do not alter the currently deployed legacy application.
Hosted jobs remain disabled; deployment and re-enabling automation are separate work.
Phase 4 adds post-transaction reconciliation, bounded weather timing, scheduled
creation limits, fixed settled fees, and refund corrections. Run `npm run arc:migrate`
to apply its additive migrations. Workers require a fresh version 2.2.0 deployment
and bind an empty database to its chain ID/address. Never reuse that database for a
different deployment or clear its binding to make mismatched history appear valid.
See [the phase 4 report](../plans/2026-09-19-phase-4-money-settlement.md).

## Verification and future Supabase move

`npm run verify` rebuilds a separate disposable database, migrates as the restricted
migration account, applies the access profile, and verifies seed idempotency,
runtime permissions, and actual API reads. It never uses `.env.arc-dev` or its data.

When hosted provisioning is authorized later:

1. Create a fresh project with an explicitly chosen organization and confirmed cost.
2. Apply `bootstrap-roles.sql` through the administrative connection; enable login
   with separate generated passwords using a secure setup process.
3. Populate the hosted template `.env.arc-dev.example` with verified connection
   hosts. Use session/direct connectivity for migration and transaction pooling for
   runtime, with verified TLS. The hosted connection profile is not yet exercised.
4. Run the same `arc:migrate`, `arc:seed`, and `arc:check` commands. Disable the unused
   Data API and run Supabase security advisors; verify runtime access and denied
   anonymous access before relying on hosted readiness.
5. Run live browser/database acceptance. Keep hosted automation disabled until its
   later lifecycle and retry gates pass.

References: [Supabase Prisma guidance](https://supabase.com/docs/guides/database/prisma),
[Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).
