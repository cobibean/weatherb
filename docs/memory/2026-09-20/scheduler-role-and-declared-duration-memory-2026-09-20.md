# Scheduler role (2.3.0) and declared duration (2.4.0) — memory (2026-09-20)

## Decisions
- Non-owner `scheduler` role may call `createMarket` **and** `createScheduledMarket`
  (user choice; accepted risk: a leaked key can spam markets, revoked by
  `setScheduler(0)`). Fresh key `0xe7B3B18BC2E34cCa2c4D40D88Ddfe2060D6f7cd7`, hosted
  only in `weatherb-arc-worker`, funded 2 USDC.
- Market duration is a per-call contract parameter (user choice):
  `createScheduledMarket(cityId, threshold, slot, durationSeconds)`. The contract no
  longer restricts slots to 12–16 UTC; it enforces one market per UTC hour slot,
  the betting buffer, and owner-set bounds (`setMarketDurationBounds`, now 900–604800).
  The daily rotation is worker policy: `schedule-daily` refuses non-24 h durations and
  hours outside 12–16 unless `test=1` (hidden `isTest` markets, any hour).
- AGENTS.md/CLAUDE.md rules 1–2 rewritten accordingly; "exactly 24 hours" is gone.
- Upgrade safety: `contracts/storage-layout/WeatherMarketV2-2.2.0.json` baseline +
  `check:storage-layout` in `npm run verify`; `arc:lifecycle upgrade` verifies deployed
  bytecode, snapshots state before/after, and journals per-version labels.
- Automation accepts contract versions 2.2.0/2.3.0/2.4.0 so app deploys precede upgrades.
- Nightly canary (`weatherb-arc-canary`, 02:30 UTC, 30-minute hidden market) exercises
  creation→settlement daily; the first canary (market 7) passed on 2026-09-20.

## Gotchas
- Solidity packs `minMarketDurationSeconds` into the tail of the `scheduler` slot
  (slot 10); `maxMarketDurationSeconds` is slot 11; gap now `uint256[41]` at slot 12.
- Struct type ids in the storage layout embed AST ids; the check normalizes them.
- Journal labels for upgrades must be versioned, otherwise `receipt()` replays the
  previous implementation deployment and the bytecode guard refuses the upgrade.
- `IWeatherMarket` additions need V1 `WeatherMarket` stubs (`revert NotOwner()`).

## State at handoff
Chain 2.4.0 at `0xf9d095bc66ab7d9ad6b5979e40d429caf799f863`; scheduler + settler hosted;
creation and settlement both enabled; three QStash schedules. Next: contract freeze,
then audit. Follow-ups in `docs/backlog-and-ideas.md`.
