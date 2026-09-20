# Declared Market Duration (2.4.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make market length a per-call contract parameter — `createScheduledMarket` takes `durationSeconds` — bounded by owner-set min/max, so the hosted worker can create short test markets any hour and prove creation→settlement in ~35 minutes, while the daily rotation keeps declaring 24 h.

**Architecture:** Upgrade 2.3.0 → 2.4.0 on the same proxy. `createScheduledMarket(cityId, thresholdTenths, slot, durationSeconds)` keeps one-market-per-UTC-hour-slot idempotency but drops the contract-level 12–16 UTC hour restriction (which hour the daily rotation uses is a worker schedule decision, enforced by the `schedule-daily` route unless the caller explicitly asks for a test market). `_createMarket` enforces `minMarketDurationSeconds ≤ duration ≤ maxMarketDurationSeconds` (owner-settable; zero = unbounded beyond the betting buffer). Two packed `uint64`s consume one more gap slot; the 2.2.0 layout baseline check guards the upgrade. The route gains `?duration=<s>&test=1`; the worker CLI gains `create-now [seconds]` and a daily canary schedule.

**Tech Stack:** unchanged (Foundry, viem, Next.js routes, Prisma, QStash, Vercel CLI, Vitest, node:test).

## Global Constraints

- Same proxy `0xd86e2774e4a9bf2e86199791068b9350b718b891`; no DB or journal reset. Chain is currently **2.3.0** (implementation `0x367142a371caff46d28cb8b9fcd6367bc9678bf0`).
- New version string `2.4.0`; `SUPPORTED_CONTRACT_VERSIONS` becomes `['2.2.0', '2.3.0', '2.4.0']`.
- **Product rule change (user decision):** market duration is declared per market at creation. Daily scheduled markets declare `86400`. The "exactly 24 hours" and "contract-enforced 5/day" rules leave `AGENTS.md`/`CLAUDE.md`; what remains contract-enforced is one market per UTC hour slot, betting closes `bettingBufferSeconds` before resolve, and owner-set duration bounds.
- Duration bounds after upgrade: `min = 900` (15 min; must exceed the 600 s betting buffer with room to bet), `max = 604800` (7 days). Set by owner via the new lifecycle command; until set, both are 0 = unbounded beyond the buffer.
- Test markets created through the worker (`test=1`) are `isTest = true` in the DB (hidden from public listings) and may occupy any hour slot; the daily route path (no `test`) still refuses hours outside 12–16 UTC so the five-per-day cadence is unchanged.
- Ordering: app code (2.4.0 ABI) deploys **before** the upgrade — creation is paused and settlement functions are unchanged, so nothing breaks in between; the 4-arg `createScheduledMarket` is only callable once the chain is 2.4.0.
- Secrets/ops rules identical to the previous two plans (owner key local; throwaway scripts in `/tmp/weatherb-ops/`; nothing secret in output or argv). Commit trailer as before. Preserve untracked docs.
- `npm run verify` (now including `check:storage-layout`) must stay green.

## Facts checked 2026-09-20 (20:45 UTC)

- 2.3.0 layout: slot 10 `scheduler`, slot 11.. `uint256[42] __gap`. Two `uint64`s pack into slot 11 → gap becomes `uint256[41]` at slot 12; `compareLayouts` accepts this (consumed = 2).
- `createScheduledMarket` callers: `contracts/test/Readiness.t.sol:83-103`, `contracts/test/SchedulerRole.t.sol` (7 calls), `apps/web/src/app/api/cron/schedule-daily/route.ts:83`, `apps/web/src/scripts/arc-lifecycle.ts:197-204` (`create()` scheduled path), `apps/web/src/test/lifecycle-mocks.ts:153`.
- `Readiness.t.sol:93-96` currently asserts hour 17 and misaligned slots revert; the misaligned-slot and time-window assertions stay, the hour-17 assertion inverts.
- `arc-lifecycle create()` refuses `start` outside 12–16 UTC at the app level (line 184) — keep that guard for `start`.
- The scheduler role is (being) assigned to `0xe7B3B18BC2E34cCa2c4D40D88Ddfe2060D6f7cd7`; hosted scheduler flag paused; QStash `weatherb-arc-schedule-daily` `5 12-16 * * *` (being) registered.

## File structure

```
contracts/src/WeatherMarketV2.sol                 duration param, bounds, 2.4.0
contracts/test/Readiness.t.sol, SchedulerRole.t.sol  call-site updates
contracts/test/MarketDuration.t.sol               create: bounds + declared duration tests
packages/shared/src/abi/weather-market.ts         regenerate
packages/shared/src/constants/contract.ts         add 2.4.0
apps/web/src/app/api/cron/schedule-daily/route.ts duration/test params
apps/web/src/app/api/cron/__tests__/schedule-daily.integration.test.ts
apps/web/src/test/lifecycle-mocks.ts              4-arg create, version 2.4.0
apps/web/src/scripts/arc-lifecycle.ts             start passes 86400; set-duration-bounds; status prints bounds
scripts/development/worker.mjs                    create-now [seconds]; canary schedule
AGENTS.md, CLAUDE.md, docs/testing/*.md, docs/backlog-and-ideas.md
```

---

### Task 1: Contract — declared duration with owner-set bounds (2.4.0)

**Files:**
- Modify: `contracts/src/WeatherMarketV2.sol`
- Modify: `contracts/test/Readiness.t.sol:83-103`, `contracts/test/SchedulerRole.t.sol`
- Create: `contracts/test/MarketDuration.t.sol`

**Interfaces (external ABI):**
- `createScheduledMarket(bytes32 cityId, uint256 thresholdTenths, uint64 slot, uint64 durationSeconds) returns (uint256)` — replaces the 3-arg form.
- `uint64 public minMarketDurationSeconds`, `uint64 public maxMarketDurationSeconds`, `setMarketDurationBounds(uint64 min, uint64 max) onlyOwner`, `event MarketDurationBoundsUpdated(uint64 min, uint64 max)`, `error DurationOutOfBounds()`. `version() == "2.4.0"`.

- [ ] **Step 1: Failing tests**

`contracts/test/MarketDuration.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MarketDurationTest is Test {
    WeatherMarketV2 market;
    address scheduler = address(0x5C4ED);
    bytes32 city = keccak256("austin");
    uint64 constant DAY = 1_800_000_000 - (1_800_000_000 % 1 days);

    function setUp() public {
        WeatherMarketV2 impl = new WeatherMarketV2();
        market = WeatherMarketV2(address(new ERC1967Proxy(address(impl),
            abi.encodeCall(WeatherMarketV2.initialize, (address(this), address(0xA11CE))))));
        market.setScheduler(scheduler);
    }
    function test_versionAndUnboundedDefaults() public view {
        assertEq(market.version(), "2.4.0");
        assertEq(market.minMarketDurationSeconds(), 0);
        assertEq(market.maxMarketDurationSeconds(), 0);
    }
    function test_declaredDurationSetsResolveTime() public {
        vm.warp(DAY + 20 hours + 7 minutes); // 20:07 UTC — outside the old 12–16 window, now allowed
        vm.prank(scheduler);
        uint256 id = market.createScheduledMarket(city, 850, DAY + 20 hours, 1800);
        assertEq(market.getMarket(id).resolveTime, uint64(block.timestamp + 1800));
        assertEq(market.getMarket(id).bettingDeadline, uint64(block.timestamp + 1800 - 600));
        assertEq(market.getScheduledMarket(DAY + 20 hours), id + 1);
    }
    function test_dailyMarketDeclaresOneDay() public {
        vm.warp(DAY + 13 hours + 5 minutes);
        uint256 id = market.createScheduledMarket(city, 850, DAY + 13 hours, 86400);
        assertEq(market.getMarket(id).resolveTime, uint64(block.timestamp + 1 days));
    }
    function test_slotIdempotencyIgnoresDuration() public {
        vm.warp(DAY + 13 hours + 5 minutes);
        uint256 id = market.createScheduledMarket(city, 850, DAY + 13 hours, 86400);
        assertEq(market.createScheduledMarket(city, 999, DAY + 13 hours, 1800), id);
        assertEq(market.getMarketCount(), 1);
    }
    function test_slotMustBeCurrentHourBoundary() public {
        vm.warp(DAY + 13 hours + 5 minutes);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, DAY + 13 hours + 1, 86400);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, DAY + 12 hours, 86400); // previous hour
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, DAY + 14 hours, 86400); // future hour
    }
    function test_durationMustExceedBettingBuffer() public {
        vm.warp(DAY + 13 hours + 5 minutes);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, DAY + 13 hours, 600);
    }
    function test_ownerSetsBoundsAndTheyApplyToBothCreatePaths() public {
        vm.expectEmit(false, false, false, true);
        emit WeatherMarketV2.MarketDurationBoundsUpdated(900, 7 days);
        market.setMarketDurationBounds(900, 7 days);
        vm.warp(DAY + 13 hours + 5 minutes);
        vm.expectRevert(WeatherMarketV2.DurationOutOfBounds.selector);
        market.createScheduledMarket(city, 850, DAY + 13 hours, 899);
        vm.expectRevert(WeatherMarketV2.DurationOutOfBounds.selector);
        market.createScheduledMarket(city, 850, DAY + 13 hours, 7 days + 1);
        vm.expectRevert(WeatherMarketV2.DurationOutOfBounds.selector);
        market.createMarket(city, uint64(block.timestamp + 899), 850, address(0));
        vm.expectRevert(WeatherMarketV2.DurationOutOfBounds.selector);
        market.createMarket(city, uint64(block.timestamp + 7 days + 1), 850, address(0));
        market.createScheduledMarket(city, 850, DAY + 13 hours, 900);
        market.createMarket(city, uint64(block.timestamp + 7 days), 850, address(0));
        assertEq(market.getMarketCount(), 2);
    }
    function test_boundsValidationAndAuthority() public {
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.setMarketDurationBounds(7 days, 900); // min > max
        vm.prank(scheduler); vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.setMarketDurationBounds(900, 7 days);
        market.setMarketDurationBounds(0, 0); // unbounded is allowed
    }
    uint256 constant BOUNDS_SLOT = 11; // Second slot of the 2.2.0 __gap.
    function test_boundsPackIntoOneGapSlot() public {
        market.setMarketDurationBounds(900, 7 days);
        uint256 word = uint256(vm.load(address(market), bytes32(BOUNDS_SLOT)));
        assertEq(uint64(word), 900);
        assertEq(uint64(word >> 64), 7 days);
        assertEq(address(uint160(uint256(vm.load(address(market), bytes32(uint256(10)))))), scheduler);
        assertEq(uint256(vm.load(address(market), bytes32(uint256(12)))), 0);
    }
}
```

Update call sites: every `createScheduledMarket(city, X, slot)` in `Readiness.t.sol` and `SchedulerRole.t.sol` becomes `createScheduledMarket(city, X, slot, 86400)`. In `Readiness.t.sol` lines 93–96: the `day + 17 hours` call must now **succeed** when warped into that hour (adjust the test to warp to `day + 17 hours + 5 minutes` and assert a market is created), while `day + 16 hours + 1` (misaligned) still reverts and the late replay assertion stays. In `SchedulerRole.t.sol::test_upgradePreservesStateAndAddsScheduler` also assert `minMarketDurationSeconds()==0` after the upgrade.

Run: `npm --workspace=@weatherb/contracts run test`
Expected: compile FAIL (4-arg signature, bounds symbols undefined).

- [ ] **Step 2: Implement**

`WeatherMarketV2.sol`:

Errors: add `error DurationOutOfBounds();`
Events: add `event MarketDurationBoundsUpdated(uint64 minSeconds, uint64 maxSeconds);`
Admin (after `setScheduler`):
```solidity
    /// @notice Bound the duration any market may declare. Zero disables that bound.
    function setMarketDurationBounds(uint64 minSeconds, uint64 maxSeconds) external onlyOwner {
        if (maxSeconds != 0 && minSeconds > maxSeconds) revert InvalidParams();
        minMarketDurationSeconds = minSeconds;
        maxMarketDurationSeconds = maxSeconds;
        emit MarketDurationBoundsUpdated(minSeconds, maxSeconds);
    }
```
`createScheduledMarket`:
```solidity
    /// @notice Create at most one market per UTC hour slot (owner or scheduler), declaring its duration.
    /// @dev Retries return the original ID regardless of the duration passed. Which hours the daily
    /// rotation uses is decided off-chain; the contract only enforces slot alignment and bounds.
    function createScheduledMarket(bytes32 cityId, uint256 thresholdTenths, uint64 slot, uint64 durationSeconds)
        external onlyOwnerOrScheduler returns (uint256 marketId)
    {
        uint256 existing = scheduledMarketIds[slot];
        if (existing != 0) return existing - 1;
        if (slot % 1 hours != 0) revert InvalidParams();
        if (block.timestamp < slot || block.timestamp >= uint256(slot) + 1 hours) revert InvalidParams();
        marketId = _createMarket(cityId, uint64(block.timestamp) + durationSeconds, thresholdTenths, address(0));
        scheduledMarketIds[slot] = marketId + 1;
    }
```
`_createMarket`, after the existing `resolveTime <= currentTime + bettingBufferSeconds` check:
```solidity
        uint64 duration = resolveTime - currentTime;
        if (duration < minMarketDurationSeconds) revert DurationOutOfBounds();
        if (maxMarketDurationSeconds != 0 && duration > maxMarketDurationSeconds) revert DurationOutOfBounds();
```
Version: `"2.4.0"`. Storage tail:
```solidity
    mapping(uint64 => uint256) private scheduledMarketIds;
    address public scheduler;
    uint64 public minMarketDurationSeconds; // Packed with max in one slot.
    uint64 public maxMarketDurationSeconds;
    uint256[41] private __gap;
```
`IWeatherMarket.sol`: change the interface's `createScheduledMarket` signature if declared there (grep; if absent, skip) and add `setMarketDurationBounds`.

- [ ] **Step 3: Build, test, layout**

Run: `npm --workspace=@weatherb/contracts run build && npm --workspace=@weatherb/contracts run test && npm run check:storage-layout`
Expected: 123 + 10 new = 133 pass (adjust if Readiness gained/lost an assertion); `Storage layout preserves the 2.2.0 baseline.`

- [ ] **Step 4: Commit**

```bash
git add contracts/src contracts/test
git commit -m "feat(contracts): declare market duration per creation with owner-set bounds (2.4.0)"
```

---

### Task 2: App — ABI, version, route params, tooling

**Files:**
- Regenerate: `packages/shared/src/abi/weather-market.ts` (`npm run generate:abi && npm run lint -- --fix && npm run check:abi`)
- Modify: `packages/shared/src/constants/contract.ts` (`['2.2.0','2.3.0','2.4.0']`, `CURRENT_CONTRACT_VERSION = '2.4.0'`)
- Modify: `apps/web/src/test/lifecycle-mocks.ts:145,153` (version `'2.4.0'`; the `createScheduledMarket` mock reads `args[3]` as duration when computing the fake market's `resolveTime`)
- Modify: `apps/web/src/app/api/cron/schedule-daily/route.ts`, its integration test
- Modify: `apps/web/src/scripts/arc-lifecycle.ts` (`create()` passes `86400n` as 4th arg; new `set-duration-bounds <min> <max>` command; `status` prints the bounds when version ≥ 2.4.0)
- Modify: `scripts/development/worker.mjs` (`create-now [seconds]`, canary schedule)
- Modify: `apps/web/src/lib/cron/__tests__/market-state.test.ts` (accepts 2.4.0)

**Interfaces:**
- Route: `GET /api/cron/schedule-daily?duration=<seconds>&test=1`. `duration` defaults to `86400`; must parse as a safe integer in `[900, 604800]` else `400 { error: 'Invalid duration' }`. `test=1` (a) allows any UTC hour, (b) sets `isTest = true` on the persisted row, (c) is recorded in the run summary as `test: true`. Without `test`, the 12–16 UTC hour check stays and `duration` other than `86400` is rejected with 400 (`'Daily markets declare 86400'`) — real markets cannot be shortened by a query string.
- `npm run arc:worker -- create-now [seconds]`: no arg → daily path; with seconds → `?duration=<s>&test=1`.
- `npm run arc:worker -- schedules` registers a third schedule `weatherb-arc-canary`: `30 2 * * *` → `/api/cron/schedule-daily?duration=1800&test=1`, `retries: 2` (daily creation→settlement canary, hidden from the public list).
- `npm run arc:lifecycle -- set-duration-bounds 900 604800` (owner tx `setMarketDurationBounds`, journal label `set-duration-bounds`, verifies by reading both getters).

- [ ] **Step 1: Failing route tests** (append to `schedule-daily.integration.test.ts`; `request(query?: string)` helper gains an optional query string)

```ts
  it('creates a short hidden test market at any hour when test=1', async () => {
    vi.setSystemTime(new Date('2026-09-20T20:07:00Z'));
    const response = await GET(request('?duration=1800&test=1'));
    expect(response.status).toBe(200);
    expect(mocks.simulate).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'createScheduledMarket', args: [expect.any(String), expect.any(BigInt), BigInt(Date.UTC(2026, 8, 20, 20) / 1000), 1800n] }));
    expect(rows.get(0)).toMatchObject({ isTest: true });
    expect(Number(chain[0]!.resolveTime) - Math.floor(Date.now() / 1000)).toBe(1800);
  });
  it('declares 86400 for daily markets and refuses other durations without test=1', async () => {
    expect((await GET(request('?duration=1800'))).status).toBe(400);
    await GET(request());
    expect(mocks.simulate).toHaveBeenCalledWith(expect.objectContaining({ args: expect.arrayContaining([86400n]) }));
    expect(rows.get(0)).toMatchObject({ isTest: false });
  });
  it('rejects out-of-range or malformed durations', async () => {
    for (const q of ['?duration=899&test=1', '?duration=604801&test=1', '?duration=abc&test=1'])
      expect((await GET(request(q))).status).toBe(400);
    expect(mocks.write).not.toHaveBeenCalled();
  });
```

Run → FAIL.

- [ ] **Step 2: Implement route changes**

At the top of `GET`, after readiness and config checks:
```ts
  const url = new URL(request.url);
  const test = url.searchParams.get('test') === '1';
  const rawDuration = url.searchParams.get('duration') ?? '86400';
  const durationSeconds = /^\d+$/.test(rawDuration) ? Number(rawDuration) : NaN;
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds < 900 || durationSeconds > 604800)
    return NextResponse.json({ success: false, error: 'Invalid duration' }, { status: 400 });
  if (!test && durationSeconds !== 86400)
    return NextResponse.json({ success: false, error: 'Daily markets declare 86400' }, { status: 400 });
```
Inside the lease body: replace the hour check with `if (!test && (hour < 12 || hour > 16)) return { slot, created: 0, skipped: true, reason: 'Outside creation hours' };`; pass `BigInt(durationSeconds)` as the 4th `createScheduledMarket` arg; forecast target becomes `now + durationSeconds`; after `persistMarket`, `if (test) await prisma.market.update({ where: { contractMarketId: Number(id) }, data: { isTest: true } });`; add `test` and `durationSeconds` to `ScheduleSummary` and the run summary.

- [ ] **Step 3: Lifecycle + worker CLI**

`arc-lifecycle.ts`: `create()` scheduled args → `[cityHash, BigInt(threshold), slot, 86400n]`; add `'setMarketDurationBounds'` to `send`'s union; new command:
```ts
  } else if (command === 'set-duration-bounds') {
    const [min, max] = [process.argv[3], process.argv[4]].map((v) => (v && /^\d+$/.test(v) ? BigInt(v) : null));
    if (min === null || max === null) throw new Error('Use set-duration-bounds <minSeconds> <maxSeconds>');
    const target = await requireDeployment();
    await send('set-duration-bounds', 'owner', 'setMarketDurationBounds', [min, max]);
    const [gotMin, gotMax] = await Promise.all((['minMarketDurationSeconds', 'maxMarketDurationSeconds'] as const).map((functionName) => publicClient.readContract({ address: target, abi, functionName })));
    if (gotMin !== min || gotMax !== max) throw new Error('Duration bounds not confirmed.');
    console.log(`market duration bounds: ${min}s – ${max}s`);
```
`status`: when `version` is not `2.2.0`/`2.3.0`, also read and print `minMarketDurationSeconds`/`maxMarketDurationSeconds`.

`worker.mjs`: `create-now` reads `process.argv[3]`; if present, `?duration=${Number(argv[3])}&test=1`. `schedules` gains `{ scheduleId: 'weatherb-arc-canary', cron: '30 2 * * *', path: '/api/cron/schedule-daily?duration=1800&test=1', retries: 2 }`.

- [ ] **Step 4: Verify and commit**

Run: `cd apps/web && npx vitest run src/app/api/cron src/lib/cron && cd ../.. && npm run typecheck && npm run lint && npm run test:safety && npm run check:abi`
Expected: pass.

```bash
git add packages/shared apps/web/src scripts/development/worker.mjs
git commit -m "feat(worker): declare market duration per creation; short hidden test markets on demand"
```

---

### Task 3: Rules and docs

- Modify `AGENTS.md`: banner version → 2.4.0 and "market duration is declared per market (daily rotation declares 24 h; owner-set bounds 15 min – 7 days)". Rolling Market System table: "Market duration | Declared at creation (daily rotation: 24 h)". Key Constraints: rule 1 → "Daily rotation creates 5 markets/day via the worker schedule (12–16 UTC); the contract enforces one market per UTC hour slot"; rule 2 → "Duration is declared per market and bounded on chain (owner-set min/max); daily markets declare 24 h". Same edits in `CLAUDE.md` tables.
- `docs/testing/arc-hosted-testnet.md`: `create-now [seconds]`, canary schedule, `set-duration-bounds`, the `test=1` semantics.
- `docs/backlog-and-ideas.md`: note "contract freeze after 2.4.0".
- Commit: `docs: declared market duration rules and runbook`.

Run `npm run verify` — must be green before Task 4.

---

### Task 4: Operator — deploy, upgrade to 2.4.0, set bounds, first canary tonight

Prerequisite: Task 7 Steps 5–6 of the scheduler plan done (scheduler assigned + funded, schedules registered, flag paused).

- [ ] **Step 1:** `npm run arc:worker -- deploy` and public `vercel deploy --prod --yes` (2.4.0 ABI; settlement unaffected; creation paused). Confirm sweeps still `succeeded`.
- [ ] **Step 2:** `npm --workspace=@weatherb/contracts run build && npm run check:storage-layout && npm run check:abi`, then `npm run arc:lifecycle -- upgrade` → `proxy … now runs 2.4.0`. Independent reads: version, owner, settler, scheduler (= hosted scheduler), bounds (0/0), `getMarketCount`, `getMarket(2)`/`(3)` unchanged. Sweep still `succeeded`.
- [ ] **Step 3:** `npm run arc:lifecycle -- set-duration-bounds 900 604800` → confirmed by reads.
- [ ] **Step 4:** `npm run arc:worker -- schedules` (adds `weatherb-arc-canary`; existing two upserted unchanged).
- [ ] **Step 5 — first canary (this is the "one manual creation" the user asked for):** `npm run arc:hosted -- scheduler enable`, then `npm run arc:worker -- create-now 1800` → `200 { created: 1, market: {...}, settlementSchedule: { scheduled: true } }`, run summary `test: true`. Verify: chain `getScheduledMarket(<current hour slot>) == id+1`, `resolveTime = block + 1800`, DB row `isTest = true`, **not** in public `/api/markets`, visible in `/admin/operations` as `(test)`. Run `create-now 1800` again → `created: 0`, same id. Then wait ~30 min: the sweep settles it (`RESOLVED`/`NO_WINNERS`, tx hash) — creation→settlement proven end to end tonight, by the scheduler and settler keys, no owner key involved.
- [ ] **Step 6:** Leave the scheduler flag **enabled**. Tomorrow 12:05 UTC the daily schedule creates slot 12's market automatically (24 h, public); 13:05–16:05 follow; 02:30 UTC daily canary runs from the next night. Record everything in the acceptance doc.

## Rollback

`arc:hosted -- scheduler disable` stops all worker-initiated creation instantly. `setScheduler(0)` revokes on chain. 2.4.0 preserves all 2.3.0 state (layout-checked + snapshot-checked); no downgrade planned.
