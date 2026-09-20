# Afterglow integration — September 19, 2026

User authorized integrating the prepared assets/styles and specifically required comparison with the original reference. Implementation is in the existing `codex/weatherb-premium-design` worktree. The parent checkout remains the separate Arc lifecycle workspace.

## Implemented

Homepage now uses the desktop/portrait WebPs, midnight palette, native sans typography, temperature-led hero, glass control shelf, compact funding link, restrained footer, dark cards and dark betting dialog. YES/NO have equal-width outlined resting states and blue/rose hover/focus. Homepage CSS is scoped; docs/positions/admin retain existing styles.

Manual carousel uses market IDs, persistent arrows/count, direct city+threshold selectors and disambiguating times. Selection survives reorder, falls back after removal, and scrolls its selector into view. Mobile swipe distinguishes horizontal gestures from vertical scrolling. Single market omits redundant grid/navigation; empty/error/closed states remain real.

Live `bettingDeadline` now travels from the on-chain market through serialization into the UI (milliseconds), with a ten-minute fallback for older data. Both outcome controls and the bet submit handler stop at that deadline. No contract configuration changed. The betting dialog now uses Radix focus management and Escape dismissal; pending transactions prevent dismissal. Compact cards no longer make unnecessary fee-setting reads.

## Verification

Root `design-qa.md` records source/implementation comparisons and fixed spacing, unequal button widths, wrapped-card alignment and dialog contrast issues. Desktop, tablet and 393px mobile viewed. 0/1/6/10 states exercised with a temporary server-page fixture, restored byte-for-byte afterward. Real loader currently shows no active markets; Past Markets loads real settled/cancelled entries. Wallet chooser opens; no connection, signature, bet or settlement performed.

Type checking and lint passed; full web suite passed 162 tests before the final stored-deadline addition. Focused final deadline/home tests and production build results are recorded in the task closeout. Physical-device swipe is unverified (component gesture tests pass; browser touch dispatch unavailable). Browser extension provider-conflict warnings remain external to the redesign.

## Working state

Dependencies installed from the unchanged npm lockfile with lifecycle scripts disabled; Prisma client generated separately without a DB migration. Session preview uses `/tmp/weatherb-design-dev.cjs`, port 3002, minimal public/RPC/DB environment from the parent profile, and PostgreSQL read-only connection options. No signer or worker secret is loaded. Preview process runs only the isolated app. Stop/restart via that session script; normal root `npm run dev` does extra Arc setup and should not be used casually alongside lifecycle work.

No commit/staging/merge/deployment. Baseline file hashes in `.git/worktrees/weatherb/weatherb-design-baseline.json` distinguish inherited Arc dirt from this task's changes. Final changed-inherited-file list is saved under the design verification directory. Do not stage the entire inherited tree. Owner visual approval remains separate from this implementation/QA pass.

Final closeout: stored-deadline serialization refinement passed typecheck, lint, 9 focused Afterglow/home tests, and a fresh production web build. `git diff --check` passed. Eleven inherited files differ from the saved baseline, all expected UI/serialization/type files; the real server page is restored exactly. Preview remains live on 3002 with no active markets and successful real Past Markets reads. No new route or fixture remains.
