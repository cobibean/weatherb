# Afterglow public interiors — September 19, 2026

User accepted the homepage and requested matching My Positions, How It Works,
other public sections, and integration back to the working branch.

## Changes

- Shared theme loaded at root; interiors use explicit navy surfaces and system typography.
- Positions: quiet aggregate stats, one claim-all action, accessible pressed filters,
  outlined actions, readable status badges, direct wallet entry, and responsive cards.
- Docs, market summaries, and public 404 now match. Guide retains five steps with
  direct navigation, Next/Back, Done, and reset on reopen; decorative motion removed.
- Claim/bulk dialogs use Radix focus handling and Escape, with pending dismissal guarded.
- No wallet transaction, deployment, migration, or lifecycle operation performed.

## Concurrent work

Parent `codex/arc-phase-1-baseline` acquired live-market polling, position-update
notifications, and claimed-payout accounting during the design work. Reconciled
eight overlapping files against the saved original baseline, preserving both
behaviors and styling. Updated parent-only dependencies were copied into the
isolated checkout for combined verification. Preserve the parent's uncommitted
Arc work and index; the requested return is a working-tree integration, without
committing the unrelated restart baseline.

## Verification

26 files / 175 tests passed after reconciliation; production build passed.
Final lint/typecheck run follows the narrowly scoped live-request lint annotation.
Browser evidence under `docs/design/afterglow/verification`: positions disconnected
and populated fixture, mobile guide, Docs, and real settled summary. Fixture route
removed before final build. Public preview remains on port 3002 with read-only DB
options and no worker/signer secrets. Actual wallet signing remains untested.

Final integration: 73 design files returned to the working checkout on `codex/arc-phase-1-baseline`. All unrelated parent file hashes and the existing index were verified unchanged. No commit or Git ancestry merge was created. Parent checkout typecheck, 175 tests, and diff whitespace check passed; isolated final lint and production build also passed.
