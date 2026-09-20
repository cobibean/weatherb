# Scheduler Role Upgrade (2.3.0) and Automated Market Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-owner `scheduler` role to `WeatherMarketV2` (2.2.0 → 2.3.0 via UUPS upgrade on the existing Arc Testnet proxy) and run the five daily market creations from the hosted worker with a fresh scheduler key, so creation no longer needs the owner key or a human.

**Architecture:** One storage slot is taken from the reserved gap for `address public scheduler`; `createMarket` and `createScheduledMarket` become `onlyOwnerOrScheduler`, everything else stays owner/settler-only. A committed storage-layout baseline plus a check script guarantee the upgrade cannot move existing state. The existing `schedule-daily` route is hardened the same way `settle-markets` was (worker role gate, per-signer lease, run log, bounded reconciliation, shared per-market QStash scheduling) and driven by a QStash cron at `5 12-16 * * *`. Operator commands in `arc-lifecycle` perform the upgrade with pre/post state snapshots, set the scheduler, and fund it. Go-live is staged: deploy code that accepts both versions → upgrade → set scheduler → one manual creation inside a 12–16 UTC window → enable the daily schedule.

**Tech Stack:** Solidity 0.8.24 / Foundry (forge 1.x via `scripts/run-forge.mjs`), OpenZeppelin UUPS, viem, Next.js 16 route handlers, Prisma/Neon, Upstash QStash, Vercel CLI, Vitest, node:test.

## Global Constraints

- Arc Testnet chain ID `5042002`; proxy `0xd86e2774e4a9bf2e86199791068b9350b718b891` is upgraded in place — **no new proxy, no database reset, no journal reset**.
- Native USDC, 18 decimals. Scheduled markets: exactly 24 h, one per UTC slot 12–16, five per day, betting closes 10 min before resolve, 0.01 USDC min bet, 1% default fee. None of these rules change.
- New contract version string: `2.3.0`. Automation must accept `2.2.0` **and** `2.3.0` before the upgrade and keep accepting both afterwards (no flag day).
- Scheduler scope (user decision): may call `createMarket` **and** `createScheduledMarket`; nothing else. Tradeoff accepted: a leaked scheduler key could create arbitrary markets (each of which the settler would then spend gas settling). Mitigation is `setScheduler(address(0))` by the owner.
- City rotation (user decision): every `City` with `isActive = true` in the hosted database, in `createdAt, slug` order, selected by `marketCount % activeCities` — cities added later join automatically.
- Go-live (user decision): keep the hosted scheduler flag paused after deployment; perform **one manual creation** inside a 12:00–16:59 UTC window and inspect it; only then leave the flag enabled with the daily QStash schedule active.
- Secrets: the scheduler key exists only in `.tools/arc-hosted/scheduler.json` (0600) and the worker project's production env. Never in the public project, chat, logs, or command arguments.
- Owner key stays local. The upgrade, `setScheduler`, and funding are owner transactions performed from the Mac through `arc-lifecycle`, journaled like every other owner action.
- Existing hosted settlement (settler `0xa7640379553b124be096CdFC8D9AF820C624C219`, QStash sweep) keeps running throughout; Markets 2/3 settle 2026-09-21 12:08 UTC regardless of this work.
- Preserve untracked unrelated files (`docs/memory/2026-08-21/*`, `docs/research/`, `docs/plans/*.md`, `docs/visuals/*`). Do not stage them.
- Commit trailer for every commit:
  ```
  Generated with [Devin](https://devin.ai)

  Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
  ```
- Verification baseline: `npm run verify` (lint, typecheck, safety, shared, web, Foundry, DB, build, ABI) must stay green; this plan adds `check:storage-layout` to it.

## Facts checked 2026-09-20

- `WeatherMarketV2.sol` storage per `forge inspect WeatherMarketV2 storage-layout` (the in-source comment "Slot 0: packed addresses" is wrong — two addresses cannot share a slot): 0 `owner`, 1 `settler`, 2 `isPaused`+`bettingBufferSeconds`+`__gap_slot1`, 3 `minBetWei`, 4 `feeBps`, 5 `_status`, 6 `markets`, 7 `positions`, 8 `accruedFees`, 9 `scheduledMarketIds` (already consumed one gap slot), 10–52 `uint256[43] __gap`. New `scheduler` goes to **slot 10**; gap becomes `uint256[42]` (slots 11–52). Total layout size unchanged.
- `createScheduledMarket` enforces `slot % 1h == 0`, hour 12–16, `slot <= block.timestamp < slot + 1h`, 24 h duration, idempotent per slot. `createMarket` allows any `resolveTime > now + buffer`.
- Version is hard-coded in: `contracts/src/WeatherMarketV2.sol:519`, `apps/web/src/lib/cron/market-state.ts:19`, `apps/web/src/lib/arc-wallet.ts:47`, `apps/web/src/test/lifecycle-mocks.ts:145`, `packages/shared/src/abi/weather-market.ts:2` (comment).
- `bindDeployment` keys the DB on `chainId:proxy` — unaffected by an implementation upgrade.
- `scripts/check-contract-abi.mjs` compares `packages/shared/src/abi/weather-market.ts` to `contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json`; the ABI file is generated from the artifact (header comment says so) but there is no generator script yet.
- `foundry.toml` has no `extra_output`; artifacts therefore lack `storageLayout`.
- `arc-lifecycle deploy` already verifies deployed implementation bytecode against the local artifact, patching the three UUPS `__self` immutables. `journal.build` is a sha256 of the artifact and `deploy` refuses if it changes.
- `schedule-daily` route today: `verifyCronRequest`, `automationReadinessResponse('scheduler')`, `SCHEDULER_PRIVATE_KEY`, full `reconcileMarkets`, its own `scheduleMarketSettlement` (duplicates `ensureSettlementScheduled`), no lease, no run log, no `maxDuration`.
- Hosted `SystemConfig.isPaused` is the scheduler pause flag (`readiness.ts` kind `'scheduler'`); `arc:hosted -- settler enable|disable` exists, no `scheduler` equivalent.
- Worker project `weatherb-arc-worker` (`prj_MYJO5DUwUjXXBCP40yBWmdIIiLt3`) production env has 13 keys, no `SCHEDULER_PRIVATE_KEY`. `workerEnvironment()` in `scripts/development/worker-profile.mjs` builds that env from `.env.arc-worker`.
- QStash: schedule `weatherb-arc-settle-sweep` exists (`*/2 * * * *`). Free tier allows 10 schedules.
- Owner `0x528CbD73E836723B987c20eB8185678b2477C292` balance ≈ 11.9 USDC.

## File structure

```
contracts/
  foundry.toml                                  modify: extra_output storageLayout
  storage-layout/WeatherMarketV2-2.2.0.json     create: frozen baseline (from the 2.2.0 build)
  src/WeatherMarketV2.sol                       modify: scheduler role, 2.3.0
  src/interfaces/IWeatherMarket.sol             modify: setScheduler in interface
  test/SchedulerRole.t.sol                      create: role, revocation, negative tests, slot, upgrade
scripts/
  check-storage-layout.mjs                      create: baseline vs current layout
  generate-contract-abi.mjs                     create: regenerate shared ABI from artifact
  development/setup-hosted-key.mjs              create: replaces setup-hosted-settler.mjs (role arg)
  development/worker-profile.mjs                modify: SCHEDULER_PRIVATE_KEY
  development/worker.mjs                        modify: second schedule, create-now
  development/hosted.mjs                        modify: scheduler enable|disable
  verification/worker-profile.test.mjs          modify: scheduler key rules
  verification/storage-layout.test.mjs          create: check script unit test
packages/shared/src/abi/weather-market.ts       regenerate (2.3.0)
packages/shared/src/constants/contract.ts       create: SUPPORTED_CONTRACT_VERSIONS
apps/web/src/
  lib/cron/market-state.ts                      modify: version set
  lib/arc-wallet.ts                             modify: version set
  lib/cron/worker-run.ts                        modify: kind 'schedule-daily'
  lib/worker-status.ts                          modify: schedule fields
  lib/admin-operations.ts                       modify: scheduler alerts + card data
  app/admin/(dashboard)/operations/operations-client.tsx   modify: Creation card
  app/api/cron/schedule-daily/route.ts          rewrite: worker gate, lease, run log, shared scheduling
  app/api/cron/__tests__/schedule-daily.integration.test.ts modify/add tests
  lib/__tests__/worker-status.test.ts, admin-operations.test.ts, arc-wallet.test.ts modify
  test/lifecycle-mocks.ts                       modify: version 2.3.0 + scheduler read
  scripts/arc-lifecycle.ts                      modify: upgrade, set-scheduler, fund-hosted-scheduler
  scripts/development-database.ts               modify: scheduler command
package.json                                    modify: scripts
.env.arc-worker.example                         modify: SCHEDULER_PRIVATE_KEY
docs/testing/arc-hosted-testnet.md, arc-testnet-lifecycle-acceptance.md, AGENTS.md, docs/backlog-and-ideas.md
```

---

### Task 1: Freeze the 2.2.0 storage layout and add the layout check

Do this **before** touching the contract. The baseline is the layout of the code currently deployed.

**Files:**
- Modify: `contracts/foundry.toml`
- Create: `contracts/storage-layout/WeatherMarketV2-2.2.0.json`
- Create: `scripts/check-storage-layout.mjs`
- Create: `scripts/verification/storage-layout.test.mjs`
- Modify: `package.json` (scripts `check:storage-layout`, `verify`, `lint`, `test:safety` globs if needed)

**Interfaces:**
- Produces: `node scripts/check-storage-layout.mjs` exits 0 when the current artifact preserves every baseline entry and only consumes gap slots; exports `compareLayouts(baseline, current)` returning `{ ok: boolean; problems: string[] }` for tests.

- [ ] **Step 1: Emit storage layout in artifacts**

In `contracts/foundry.toml` under `[profile.default]` add:

```toml
extra_output = ["storageLayout"]
```

Run: `npm --workspace=@weatherb/contracts run build`
Expected: builds; `node -e "const a=require('./contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json');console.log(a.storageLayout.storage.length)"` prints `13` (owner, settler, isPaused, bettingBufferSeconds, __gap_slot1, minBetWei, feeBps, _status, markets, positions, accruedFees, scheduledMarketIds, __gap).

- [ ] **Step 2: Freeze the baseline**

```sh
mkdir -p contracts/storage-layout
node -e "const a=require('./contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json');require('fs').writeFileSync('contracts/storage-layout/WeatherMarketV2-2.2.0.json',JSON.stringify({version:'2.2.0',storage:a.storageLayout.storage.map(({label,slot,offset,type})=>({label,slot,offset,type}))},null,2)+'\n')"
cat contracts/storage-layout/WeatherMarketV2-2.2.0.json
```

Expected: entries include `{"label":"settler","slot":"1",...}`, `{"label":"scheduledMarketIds","slot":"9",...}` and `{"label":"__gap","slot":"10","type":"t_array(t_uint256)43_storage"}`.

- [ ] **Step 3: Write the failing check test**

`scripts/verification/storage-layout.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLayouts } from '../check-storage-layout.mjs';

const base = {
  storage: [
    { label: 'owner', slot: '0', offset: 0, type: 't_address' },
    { label: 'scheduledMarketIds', slot: '9', offset: 0, type: 't_mapping(t_uint64,t_uint256)' },
    { label: '__gap', slot: '10', offset: 0, type: 't_array(t_uint256)43_storage' },
  ],
};
const ok = {
  storage: [
    { label: 'owner', slot: '0', offset: 0, type: 't_address' },
    { label: 'scheduledMarketIds', slot: '9', offset: 0, type: 't_mapping(t_uint64,t_uint256)' },
    { label: 'scheduler', slot: '10', offset: 0, type: 't_address' },
    { label: '__gap', slot: '11', offset: 0, type: 't_array(t_uint256)42_storage' },
  ],
};

test('accepts new variables that only consume gap slots', () => {
  assert.deepEqual(compareLayouts(base, ok), { ok: true, problems: [] });
});
test('rejects a moved or retyped existing variable', () => {
  const moved = structuredClone(ok);
  moved.storage[1].slot = '10';
  moved.storage[2].slot = '9';
  assert.equal(compareLayouts(base, moved).ok, false);
  const retyped = structuredClone(ok);
  retyped.storage[0].type = 't_uint256';
  assert.equal(compareLayouts(base, retyped).ok, false);
});
test('rejects a gap that shrank by more than the slots consumed', () => {
  const bad = structuredClone(ok);
  bad.storage[3].type = 't_array(t_uint256)41_storage';
  assert.match(compareLayouts(base, bad).problems.join('\n'), /gap/);
});
test('rejects a new variable outside the reserved gap', () => {
  const bad = structuredClone(ok);
  bad.storage.push({ label: 'late', slot: '53', offset: 0, type: 't_uint256' });
  assert.equal(compareLayouts(base, bad).ok, false);
});
```

Run: `node --test scripts/verification/storage-layout.test.mjs`
Expected: FAIL — cannot find module `../check-storage-layout.mjs`.

- [ ] **Step 4: Implement the check**

`scripts/check-storage-layout.mjs`:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const gapLength = (type) => Number(/t_array\(t_uint256\)(\d+)_storage/.exec(type)?.[1] ?? NaN);

/** Every baseline variable must be identical; new variables may only occupy former gap slots. */
export function compareLayouts(baseline, current) {
  const problems = [];
  const byLabel = new Map(current.storage.map((e) => [e.label, e]));
  const baseGap = baseline.storage.find((e) => e.label === '__gap');
  const curGap = byLabel.get('__gap');
  if (!baseGap || !curGap) return { ok: false, problems: ['__gap missing from baseline or current layout'] };
  for (const entry of baseline.storage) {
    if (entry.label === '__gap') continue;
    const cur = byLabel.get(entry.label);
    if (!cur) { problems.push(`removed: ${entry.label}`); continue; }
    for (const key of ['slot', 'offset', 'type'])
      if (String(cur[key]) !== String(entry[key]))
        problems.push(`${entry.label}.${key} changed ${entry[key]} -> ${cur[key]}`);
  }
  const gapStart = Number(baseGap.slot);
  const gapEnd = gapStart + gapLength(baseGap.type); // exclusive
  const baseLabels = new Set(baseline.storage.map((e) => e.label));
  let consumed = 0;
  for (const entry of current.storage) {
    if (baseLabels.has(entry.label)) continue;
    const slot = Number(entry.slot);
    if (slot < gapStart || slot >= gapEnd) problems.push(`new variable outside reserved gap: ${entry.label} @ ${slot}`);
    consumed = Math.max(consumed, slot - gapStart + 1);
  }
  const expectedGapSlot = gapStart + consumed;
  const expectedGapLength = gapLength(baseGap.type) - consumed;
  if (Number(curGap.slot) !== expectedGapSlot || gapLength(curGap.type) !== expectedGapLength)
    problems.push(`gap must start at ${expectedGapSlot} with length ${expectedGapLength}; found slot ${curGap.slot} ${curGap.type}`);
  return { ok: problems.length === 0, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const baseline = JSON.parse(readFileSync(new URL('contracts/storage-layout/WeatherMarketV2-2.2.0.json', root), 'utf8'));
  const artifact = JSON.parse(readFileSync(new URL('contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json', root), 'utf8'));
  if (!artifact.storageLayout) { console.error('Artifact lacks storageLayout; add extra_output = ["storageLayout"] to foundry.toml and rebuild.'); process.exit(1); }
  const result = compareLayouts(baseline, artifact.storageLayout);
  if (!result.ok) { console.error('Storage layout is NOT upgrade-safe:\n' + result.problems.join('\n')); process.exit(1); }
  console.log(`Storage layout preserves the ${baseline.version} baseline.`);
}
```

- [ ] **Step 5: Run tests and the check against the unchanged contract**

Run: `node --test scripts/verification/storage-layout.test.mjs`
Expected: 4 pass.

Run: `node scripts/check-storage-layout.mjs`
Expected: `Storage layout preserves the 2.2.0 baseline.`

- [ ] **Step 6: Wire into package.json**

In root `package.json`:
- add `"check:storage-layout": "node scripts/check-storage-layout.mjs"`;
- change `verify` to `"npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run check:abi && npm run check:storage-layout"`;
- append `scripts/check-storage-layout.mjs` to the `lint` file list;
- confirm `test:safety` already globs `scripts/verification/*.test.mjs` (it picked up `worker-profile.test.mjs` automatically); if it lists files explicitly, add the new one.

Run: `npm run lint && npm run test:safety && npm run check:storage-layout`
Expected: clean; safety count increases by 4.

- [ ] **Step 7: Commit**

```bash
git add contracts/foundry.toml contracts/storage-layout scripts/check-storage-layout.mjs scripts/verification/storage-layout.test.mjs package.json
git commit -m "chore(contracts): freeze 2.2.0 storage layout and add upgrade-safety check"
```

---

### Task 2: Scheduler role in `WeatherMarketV2` (2.3.0)

**Files:**
- Modify: `contracts/src/WeatherMarketV2.sol`
- Modify: `contracts/src/interfaces/IWeatherMarket.sol`
- Create: `contracts/test/SchedulerRole.t.sol`

**Interfaces:**
- Produces (external ABI additions): `address public scheduler`, `function setScheduler(address newScheduler) external onlyOwner` (zero address allowed = revoke), `event SchedulerUpdated(address indexed previousScheduler, address indexed newScheduler)`, `error NotOwnerOrScheduler()`, `version() == "2.3.0"`. `createMarket` and `createScheduledMarket` are callable by owner **or** scheduler.

- [ ] **Step 1: Write the failing tests**

`contracts/test/SchedulerRole.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract SchedulerRoleTest is Test {
    WeatherMarketV2 market;
    address settler = address(0xA11CE);
    address scheduler = address(0x5C4ED);
    address stranger = address(0xBAD);
    bytes32 city = keccak256("austin");
    uint64 constant SLOT = 1_800_000_000 - (1_800_000_000 % 1 days) + 13 hours; // a 13:00 UTC slot

    function setUp() public {
        WeatherMarketV2 impl = new WeatherMarketV2();
        market = WeatherMarketV2(address(new ERC1967Proxy(address(impl),
            abi.encodeCall(WeatherMarketV2.initialize, (address(this), settler)))));
        vm.warp(SLOT + 5 minutes);
    }
    function test_versionAndDefaultScheduler() public view {
        assertEq(market.version(), "2.3.0");
        assertEq(market.scheduler(), address(0));
    }
    function test_onlyOwnerSetsSchedulerAndEmits() public {
        vm.expectEmit(true, true, false, false);
        emit WeatherMarketV2.SchedulerUpdated(address(0), scheduler);
        market.setScheduler(scheduler);
        assertEq(market.scheduler(), scheduler);
        vm.prank(scheduler); vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setScheduler(stranger);
        vm.prank(stranger); vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setScheduler(stranger);
    }
    function test_schedulerCreatesScheduledAndArbitraryMarkets() public {
        market.setScheduler(scheduler);
        vm.prank(scheduler);
        uint256 a = market.createScheduledMarket(city, 850, SLOT);
        assertEq(market.getScheduledMarket(SLOT), a + 1);
        assertEq(market.getMarket(a).resolveTime, uint64(block.timestamp + 1 days));
        vm.prank(scheduler);
        uint256 b = market.createMarket(city, uint64(block.timestamp + 2 hours), 900, address(0));
        assertEq(b, a + 1);
        // Idempotent slot reuse also works for the scheduler.
        vm.prank(scheduler);
        assertEq(market.createScheduledMarket(city, 999, SLOT), a);
    }
    function test_ownerStillCreates() public {
        market.setScheduler(scheduler);
        market.createScheduledMarket(city, 850, SLOT);
        market.createMarket(city, uint64(block.timestamp + 2 hours), 900, address(0));
    }
    function test_strangerAndUnsetSchedulerCannotCreate() public {
        vm.prank(stranger); vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector);
        market.createScheduledMarket(city, 850, SLOT);
        vm.prank(stranger); vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector);
        market.createMarket(city, uint64(block.timestamp + 2 hours), 900, address(0));
        vm.prank(scheduler); vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector); // not set yet
        market.createScheduledMarket(city, 850, SLOT);
    }
    function test_revocationStopsScheduler() public {
        market.setScheduler(scheduler);
        market.setScheduler(address(0));
        vm.prank(scheduler); vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector);
        market.createScheduledMarket(city, 850, SLOT);
    }
    function test_schedulerHasNoOtherAuthority() public {
        market.setScheduler(scheduler);
        uint256 id = market.createMarket(city, uint64(block.timestamp + 2 hours), 900, address(0));
        vm.startPrank(scheduler);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setSettler(scheduler);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setFeeBps(500);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setMinBet(1);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.setBettingBuffer(1);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.pause();
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.unpause();
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.cancelMarket(id);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.withdrawFees(address(0), scheduler);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.transferOwnership(scheduler);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector); market.upgradeToAndCall(address(new WeatherMarketV2()), "");
        vm.expectRevert(WeatherMarketV2.NotSettler.selector); market.resolveMarket(id, 900, uint64(block.timestamp));
        vm.expectRevert(WeatherMarketV2.NotSettler.selector); market.cancelMarketBySettler(id);
        vm.stopPrank();
    }
    uint256 constant SCHEDULER_SLOT = 10; // First slot of the 2.2.0 __gap (see contracts/storage-layout/WeatherMarketV2-2.2.0.json).
    function test_schedulerOccupiesFirstGapSlotOnly() public {
        market.setScheduler(scheduler);
        assertEq(address(uint160(uint256(vm.load(address(market), bytes32(SCHEDULER_SLOT))))), scheduler);
        assertEq(address(uint160(uint256(vm.load(address(market), bytes32(uint256(0)))))), address(this)); // owner
        assertEq(address(uint160(uint256(vm.load(address(market), bytes32(uint256(1)))))), settler);       // settler
        assertEq(uint256(vm.load(address(market), bytes32(SCHEDULER_SLOT + 1))), 0);                       // gap untouched
    }
    function test_upgradePreservesStateAndAddsScheduler() public {
        uint256 id = market.createScheduledMarket(city, 850, SLOT);
        market.setFeeBps(250);
        vm.deal(stranger, 1 ether); vm.prank(stranger); market.placeBet{value: 0.5 ether}(id, true);
        WeatherMarketV2 next = new WeatherMarketV2();
        market.upgradeToAndCall(address(next), "");
        assertEq(market.version(), "2.3.0");
        assertEq(market.owner(), address(this));
        assertEq(market.settler(), settler);
        assertEq(market.feeBps(), 250);
        assertEq(market.getMarketCount(), 1);
        assertEq(market.getMarket(id).yesPool, 0.5 ether);
        assertEq(market.getScheduledMarket(SLOT), id + 1);
        assertEq(market.scheduler(), address(0));
        market.setScheduler(scheduler);
        assertEq(market.scheduler(), scheduler);
    }
}
```

Note: the in-source comments "Slot 0: Packed addresses" / "Slot 1: Packed config" are wrong (`owner` is slot 0, `settler` slot 1, config slot 2 — see the Task 1 baseline). Fix those two comments in Step 2 so they match the baseline; this is a comment-only change.

Run: `npm --workspace=@weatherb/contracts run test -- --match-contract SchedulerRoleTest`
Expected: compile FAIL — `scheduler`, `setScheduler`, `SchedulerUpdated`, `NotOwnerOrScheduler` undefined.

- [ ] **Step 2: Implement the role**

In `contracts/src/WeatherMarketV2.sol`:

Errors (after `error NotSettler();`):
```solidity
    error NotOwnerOrScheduler();
```
Events (after `SettlerUpdated`):
```solidity
    event SchedulerUpdated(address indexed previousScheduler, address indexed newScheduler);
```
Modifiers (after `onlySettler`):
```solidity
    modifier onlyOwnerOrScheduler() {
        if (msg.sender != owner && msg.sender != scheduler) revert NotOwnerOrScheduler();
        _;
    }
```
Admin function (after `setSettler`):
```solidity
    /// @notice Set the scheduler address. Zero revokes the role.
    /// @param newScheduler Address allowed to create markets alongside the owner
    function setScheduler(address newScheduler) external onlyOwner {
        address oldScheduler = scheduler;
        scheduler = newScheduler;
        emit SchedulerUpdated(oldScheduler, newScheduler);
    }
```
Change `createMarket(...) external onlyOwner` → `external onlyOwnerOrScheduler` and `createScheduledMarket(...) external onlyOwner` → `external onlyOwnerOrScheduler`; update their NatSpec `@notice` to say "owner or scheduler".

Version: `return "2.3.0";`

Storage (bottom of contract, replace the two lines):
```solidity
    // ============ Gap for Future Storage ============
    // Each addition consumes one reserved slot without moving any existing storage.
    mapping(uint64 => uint256) private scheduledMarketIds;
    address public scheduler;
    uint256[42] private __gap;
```

`contracts/src/interfaces/IWeatherMarket.sol`: after `function setSettler(address settler) external;` add `function setScheduler(address scheduler) external;`.

- [ ] **Step 3: Build, run all contract tests, and the layout check**

Run: `npm --workspace=@weatherb/contracts run build && npm --workspace=@weatherb/contracts run test`
Expected: all previous 114 tests plus 9 new pass (123).

Run: `npm run check:storage-layout`
Expected: `Storage layout preserves the 2.2.0 baseline.` (i.e. `scheduler` at slot 10, `__gap` at slot 11 with length 42). If it reports the gap, the array length is wrong — it must be 42.

- [ ] **Step 4: Commit**

```bash
git add contracts/src/WeatherMarketV2.sol contracts/src/interfaces/IWeatherMarket.sol contracts/test/SchedulerRole.t.sol
git commit -m "feat(contracts): add scheduler role for market creation (2.3.0)"
```

---

### Task 3: Regenerate the shared ABI and accept both contract versions

**Files:**
- Create: `scripts/generate-contract-abi.mjs`
- Regenerate: `packages/shared/src/abi/weather-market.ts`
- Create: `packages/shared/src/constants/contract.ts`
- Modify: `packages/shared/src/constants/index.ts` (export)
- Modify: `apps/web/src/lib/cron/market-state.ts:12-22`, `apps/web/src/lib/arc-wallet.ts:47`
- Modify: `apps/web/src/test/lifecycle-mocks.ts:145`, `apps/web/src/lib/__tests__/arc-wallet.test.ts`
- Test: `apps/web/src/lib/cron/__tests__/market-state.test.ts` (create if absent) 
- Modify: `package.json` (`generate:abi` script, lint list)

**Interfaces:**
- Produces: `SUPPORTED_CONTRACT_VERSIONS: readonly ['2.2.0', '2.3.0']`, `isSupportedContractVersion(v: string): boolean`, `CURRENT_CONTRACT_VERSION = '2.3.0'`; `WEATHER_MARKET_ABI` now includes `scheduler`, `setScheduler`, `SchedulerUpdated`, `NotOwnerOrScheduler`.

- [ ] **Step 1: ABI generator**

`scripts/generate-contract-abi.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const artifact = JSON.parse(readFileSync(new URL('contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json', root), 'utf8'));
const source = readFileSync(new URL('contracts/src/WeatherMarketV2.sol', root), 'utf8');
const version = /return "(\d+\.\d+\.\d+)";/.exec(source)?.[1];
if (!version) throw new Error('Could not read version() from WeatherMarketV2.sol');
const body = JSON.stringify(artifact.abi, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1:').replace(/"/g, "'");
writeFileSync(
  new URL('packages/shared/src/abi/weather-market.ts', root),
  `// Generated from contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json by scripts/generate-contract-abi.mjs.\n// Intended source version: ${version}; this does not upgrade any deployed contract.\nexport const WEATHER_MARKET_ABI = ${body} as const;\n`,
);
console.log(`Shared ABI regenerated for ${version} (${artifact.abi.length} entries).`);
```

Add to root `package.json`: `"generate:abi": "node scripts/generate-contract-abi.mjs"` and the file to the `lint` list.

Run: `npm run generate:abi && npm run lint -- --fix && npm run check:abi`
Expected: `Shared ABI regenerated for 2.3.0`; prettier/eslint reformat the file; `Shared ABI matches the compiled WeatherMarketV2 contract.` Inspect `git diff --stat packages/shared/src/abi/weather-market.ts` — additions only for the four new entries plus formatting.

- [ ] **Step 2: Version constants**

`packages/shared/src/constants/contract.ts`:

```ts
/** Versions of WeatherMarketV2 the Arc restart automation may operate against. */
export const SUPPORTED_CONTRACT_VERSIONS = ['2.2.0', '2.3.0'] as const;
export const CURRENT_CONTRACT_VERSION = '2.3.0';
export function isSupportedContractVersion(version: string): boolean {
  return (SUPPORTED_CONTRACT_VERSIONS as readonly string[]).includes(version);
}
```

Export from `packages/shared/src/constants/index.ts` (`export * from './contract';`).

- [ ] **Step 3: Failing test for market-state**

`apps/web/src/lib/cron/__tests__/market-state.test.ts` (new; mocks prisma like other cron tests):

```ts
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ default: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ $executeRaw: vi.fn(), systemConfig: { findUniqueOrThrow: vi.fn(async () => ({ deploymentKey: '5042002:0xd86e2774e4a9bf2e86199791068b9350b718b891' })) } })) } }));
import { requireRestartContract } from '../market-state';
const client = (version: string) => ({ getChainId: async () => 5042002, readContract: async () => version }) as never;
const address = '0xd86e2774e4a9bf2e86199791068b9350b718b891';
describe('requireRestartContract', () => {
  it.each(['2.2.0', '2.3.0'])('accepts %s', async (v) => { await expect(requireRestartContract(client(v), address)).resolves.toBeUndefined(); });
  it.each(['2.0.0', '2.1.0', '3.0.0'])('rejects %s', async (v) => { await expect(requireRestartContract(client(v), address)).rejects.toThrow(/2\.2\.0 or 2\.3\.0/); });
});
```

Run: `cd apps/web && npx vitest run src/lib/cron/__tests__/market-state.test.ts`
Expected: `accepts 2.3.0` FAILS.

- [ ] **Step 4: Implement**

`market-state.ts`:
```ts
import { assertArcChain, SUPPORTED_CONTRACT_VERSIONS, isSupportedContractVersion } from '@weatherb/shared/constants';
...
  if (!isSupportedContractVersion(version))
    throw new Error(`Automation requires the Arc restart contract (${SUPPORTED_CONTRACT_VERSIONS.join(' or ')})`);
```
`arc-wallet.ts:47`: `if (!isSupportedContractVersion(version)) throw new Error('The configured address is not the Arc restart contract.');` (import from `@weatherb/shared/constants`).
`lifecycle-mocks.ts:145`: return `'2.3.0'`. In `arc-wallet.test.ts` add a case that `'2.3.0'` is accepted alongside the existing `'2.2.0'` case (parametrize the existing test with `it.each(['2.2.0','2.3.0'])`).

- [ ] **Step 5: Run affected suites**

Run: `cd apps/web && npx vitest run src/lib/cron src/lib/__tests__/arc-wallet.test.ts src/app/api/cron && npm run typecheck` (from root)
Expected: all pass (existing `rejects legacy contracts` tests still pass because `'2.0.0'` is unsupported).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-contract-abi.mjs packages/shared/src/abi/weather-market.ts packages/shared/src/constants/contract.ts packages/shared/src/constants/index.ts apps/web/src/lib/cron/market-state.ts apps/web/src/lib/arc-wallet.ts apps/web/src/test/lifecycle-mocks.ts apps/web/src/lib/__tests__/arc-wallet.test.ts apps/web/src/lib/cron/__tests__/market-state.test.ts package.json
git commit -m "feat(shared): regenerate ABI for 2.3.0 and accept both restart contract versions"
```

---

### Task 4: Harden `schedule-daily` like the settlement routes

**Files:**
- Rewrite: `apps/web/src/app/api/cron/schedule-daily/route.ts`
- Modify: `apps/web/src/lib/cron/worker-run.ts` (`WorkerRunKind`)
- Modify: `apps/web/src/app/api/cron/__tests__/schedule-daily.integration.test.ts`

**Interfaces:**
- Consumes: `verifyWorkerRequest`, `withSignerLease(id, holder, ttl, fn)`, `recordWorkerRun(kind, trigger, fn)`, `triggerFromRequest`, `redactError`, `reconcileOutstandingMarkets`, `readMarket`, `persistMarket`, `requireRestartContract`, `ensureSettlementScheduled(marketId: bigint, resolveTimeSec: number)`.
- Produces: `WorkerRunKind` includes `'schedule-daily'`; run summaries `{ created, marketId?, transactionHash?, slot, settlementSchedule }`; paused → `200 skipped` **and** a `skipped` run; lease busy → `409 { success:false, busy:true }`.

- [ ] **Step 1: Extend the run kind**

`worker-run.ts`: `export type WorkerRunKind = 'settle-sweep' | 'settle-market' | 'schedule-daily';`

- [ ] **Step 2: Add failing tests**

Append to `schedule-daily.integration.test.ts` (inside the describe; fixtures `mocks.queryRaw` default resolves `[{ holder }]` per `lifecycle-mocks` — check and set explicitly where needed):

```ts
  it('records a skipped run while paused and no run on outage', async () => {
    mocks.config.mockResolvedValue({ isPaused: true });
    expect(await (await GET(request())).json()).toMatchObject({ skipped: true });
    expect(mocks.runCreate).toHaveBeenCalledWith({ data: { kind: 'schedule-daily', trigger: 'manual' } });
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }));
    mocks.runCreate.mockClear();
    mocks.config.mockRejectedValue(new Error('offline'));
    expect((await GET(request())).status).toBe(503);
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });
  it('returns 409 and logs busy when the scheduler lease is held', async () => {
    mocks.queryRaw.mockResolvedValueOnce([]);
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ busy: true });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'busy' }) }));
  });
  it('logs a succeeded run with the created market and releases the lease', async () => {
    expect((await GET(request())).status).toBe(200);
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'succeeded', summary: expect.objectContaining({ created: 1, marketId: '0' }) }),
    }));
    expect(mocks.executeRaw).toHaveBeenCalled(); // release
  });
  it('schedules settlement once through the shared helper', async () => {
    vi.stubEnv('QSTASH_TOKEN', 'qs'); vi.stubEnv('APP_URL', 'https://worker.example');
    await GET(request());
    await GET(request()); // same slot → reuse, no second publish
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { settlementMessageId: expect.any(String) } }));
  });
```

The existing test `'schedules confirmed resolve time and tolerates queue failure visibly'` asserted the old inline publisher's message; update its expectation to the `ensureSettlementScheduled` result shape (`settlementSchedule: { scheduled: false, message: 'QStash not configured' }` when unconfigured; when `mocks.publish` rejects, the route must catch and report `{ scheduled: false, message: 'Queue unavailable; periodic settlement remains required' }`). `'rotates using durable chain count...'` and `'handles concurrent requests with the same contract slot'` stay unchanged.

Run: `cd apps/web && npx vitest run src/app/api/cron/__tests__/schedule-daily.integration.test.ts`
Expected: the four new tests FAIL; existing ones pass.

- [ ] **Step 3: Rewrite the route**

`apps/web/src/app/api/cron/schedule-daily/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { keccak256, toBytes, toEventSelector, type Hex } from 'viem';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyWorkerRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import { persistMarket, readMarket, reconcileOutstandingMarkets, requireRestartContract } from '@/lib/cron/market-state';
import { ensureSettlementScheduled, type SettlementScheduleResult } from '@/lib/cron/settlement-schedule';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type ScheduleSummary = {
  slot: number;
  created: number;
  skipped?: boolean;
  reason?: string;
  marketId?: string;
  thresholdTenths?: number;
  transactionHash?: Hex;
  settlementSchedule?: SettlementScheduleResult;
};

/** One idempotent slot per UTC hour from 12 through 16; the contract enforces the limit. */
export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('scheduler');
  if (readiness) {
    if (readiness.status === 200)
      await recordWorkerRun('schedule-daily', triggerFromRequest(request), async () => ({
        status: 'skipped',
        summary: await readiness.clone().json(),
      }));
    return readiness;
  }
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SCHEDULER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !contractAddress || !privateKey)
    return NextResponse.json({ success: false, error: 'Missing scheduler configuration' }, { status: 500 });
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const { publicClient, walletClient } = clients;
    const lease = `scheduler:${walletClient.account!.address.toLowerCase()}`;
    const outcome = await recordWorkerRun<ScheduleSummary | { busy: true }>(
      'schedule-daily',
      triggerFromRequest(request),
      async (runId) => {
        const held = await withSignerLease(lease, runId, LEASE_SECONDS, async (): Promise<ScheduleSummary> => {
          await requireRestartContract(publicClient, contractAddress);
          // Recover earlier writes before allowing more markets, including a failure in an earlier hour.
          await reconcileOutstandingMarkets(publicClient, contractAddress);
          const now = Math.floor(Date.now() / 1000);
          const slot = Math.floor(now / 3600) * 3600;
          const hour = (slot % 86400) / 3600;
          if (hour < 12 || hour > 16) return { slot, created: 0, skipped: true, reason: 'Outside creation hours' };
          const lookup = () =>
            publicClient.readContract({ address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'getScheduledMarket', args: [BigInt(slot)] });
          let storedId = await lookup();
          let transactionHash: Hex | undefined;
          let created = 0;
          if (storedId === 0n) {
            const cities = await prisma.city.findMany({ where: { isActive: true }, orderBy: [{ createdAt: 'asc' }, { slug: 'asc' }] });
            if (cities.length === 0) throw new Error('No active cities configured');
            const count = await publicClient.readContract({ address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'getMarketCount' });
            const city = cities[Number(count % BigInt(cities.length))]!;
            let forecast: number;
            try {
              forecast = await createWeatherProviderFromEnv().getForecast(city.latitude, city.longitude, now + 86400);
              await recordProviderSuccess();
            } catch (error) {
              await recordProviderError();
              throw error;
            }
            const threshold = Math.round(forecast / 10) * 10;
            if (!Number.isSafeInteger(threshold) || threshold <= 0) throw new Error('Unsupported forecast threshold');
            const { request: txRequest } = await publicClient.simulateContract({
              address: contractAddress, abi: WEATHER_MARKET_ABI, functionName: 'createScheduledMarket',
              args: [keccak256(toBytes(city.slug)), BigInt(threshold), BigInt(slot)], account: walletClient.account!,
            });
            transactionHash = await walletClient.writeContract(txRequest);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
            if (receipt.status !== 'success') throw new Error(`Creation transaction reverted: ${transactionHash}`);
            created = receipt.logs.some(
              (log) => log.address.toLowerCase() === contractAddress.toLowerCase() &&
                log.topics[0] === toEventSelector('MarketCreated(uint256,bytes32,uint64,uint256,address)'),
            ) ? 1 : 0;
            storedId = await lookup(); // Simulation's predicted ID can be stale under concurrent creation.
            if (storedId === 0n) throw new Error(`Creation not confirmed: ${transactionHash}`);
          }
          const id = storedId - 1n;
          const confirmed = await readMarket(publicClient, contractAddress, id);
          await persistMarket(id, confirmed);
          const settlementSchedule = await ensureSettlementScheduled(id, Number(confirmed.resolveTime)).catch(
            (): SettlementScheduleResult => ({ scheduled: false, message: 'Queue unavailable; periodic settlement remains required' }),
          );
          return { slot, created, marketId: id.toString(), thresholdTenths: Number(confirmed.thresholdTenths), transactionHash, settlementSchedule };
        });
        if (!held.acquired) return { status: 'busy', summary: { busy: true as const } };
        return { status: held.value.skipped ? 'skipped' : 'succeeded', summary: held.value };
      },
    );
    if ('busy' in outcome.summary) return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const s = outcome.summary;
    if (s.skipped) return NextResponse.json({ success: true, created: 0, skipped: true, reason: s.reason });
    return NextResponse.json({
      success: true,
      created: s.created,
      market: { marketId: s.marketId, thresholdTenths: s.thresholdTenths, transactionHash: s.transactionHash },
      settlementSchedule: s.settlementSchedule,
    });
  } catch (error) {
    console.error('[Scheduler] Creation/reconciliation failed:', redactError(error));
    return NextResponse.json(
      { success: false, error: 'Creation or reconciliation failed; retry this endpoint to recover chain state' },
      { status: 503 },
    );
  }
}
```

Delete the old inline `scheduleMarketSettlement` and its type. `ensureSettlementScheduled` reads `APP_URL || NEXT_PUBLIC_APP_URL` and reuses `Market.settlementMessageId`, so a retry of the same slot never publishes twice.

- [ ] **Step 4: Run the suite**

Run: `cd apps/web && npx vitest run src/app/api/cron && npm run typecheck` (root)
Expected: all schedule-daily tests pass including the four new ones; settle-markets unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/cron/schedule-daily/route.ts apps/web/src/lib/cron/worker-run.ts apps/web/src/app/api/cron/__tests__/schedule-daily.integration.test.ts
git commit -m "feat(worker): gate, lease and log scheduled market creation"
```

---

### Task 5: Creation visibility in health, alerts, and the Operations page

**Files:**
- Modify: `apps/web/src/lib/worker-status.ts`, `apps/web/src/lib/__tests__/worker-status.test.ts`
- Modify: `apps/web/src/lib/admin-operations.ts`, `apps/web/src/lib/__tests__/admin-operations.test.ts`
- Modify: `apps/web/src/app/admin/(dashboard)/operations/operations-client.tsx`

**Interfaces:**
- Produces: `WorkerStatus` gains `lastScheduleAt: string | null`, `lastSuccessfulScheduleAt: string | null`, `lastScheduleStatus: string | null`. `deriveOperationsAlerts` input gains `schedulerPaused: boolean`; new alert codes `scheduler-paused` (warning: in a 12–16 UTC hour while paused) and `schedule-missed` (warning: unpaused, UTC hour 12–16, minute ≥ 15, and no `schedule-daily` run succeeded since the top of the current hour). `OperationsSnapshot.schedulerPaused` already exists.

- [ ] **Step 1: Failing worker-status test**

Add to `worker-status.test.ts` (mock `prisma.workerRun.findFirst` to answer by `where.kind`):

```ts
  it('reports the latest scheduled-creation run separately from sweeps', async () => {
    mocks.findFirst.mockImplementation(async ({ where }: { where: { kind: string; status?: string } }) =>
      where.kind === 'schedule-daily'
        ? { startedAt: new Date('2026-09-21T12:05:00Z'), status: where.status ?? 'succeeded' }
        : { startedAt: new Date('2026-09-21T12:18:00Z'), status: where.status ?? 'succeeded' },
    );
    const status = await readWorkerStatus(new Date('2026-09-21T12:20:00Z'));
    expect(status).toMatchObject({ lastScheduleAt: '2026-09-21T12:05:00.000Z', lastScheduleStatus: 'succeeded', lastSweepAt: '2026-09-21T12:18:00.000Z' });
  });
```

Run: `cd apps/web && npx vitest run src/lib/__tests__/worker-status.test.ts` → FAIL (fields undefined).

- [ ] **Step 2: Implement**

`worker-status.ts`: add the three fields to `WorkerStatus`; extend the `Promise.all` with two more `findFirst` calls (`kind: 'schedule-daily'` latest; `kind: 'schedule-daily', status: 'succeeded'` latest) and map them exactly like the sweep fields.

- [ ] **Step 3: Failing alert tests**

Add to `admin-operations.test.ts` a `schedule` table (reuse the existing `base` fixture helper; `worker` fixture includes the new fields as `null` unless set):

```ts
  it.each([
    ['in-window, unpaused, created this hour', '2026-09-21T13:20:00Z', false, '2026-09-21T13:05:00Z', []],
    ['in-window, unpaused, nothing since top of hour', '2026-09-21T13:20:00Z', false, '2026-09-21T12:05:00Z', ['schedule-missed']],
    ['in-window, first 15 minutes grace', '2026-09-21T13:10:00Z', false, null, []],
    ['in-window while paused', '2026-09-21T14:30:00Z', true, null, ['scheduler-paused']],
    ['outside window while paused', '2026-09-21T09:30:00Z', true, null, []],
  ])('%s', (_, now, schedulerPaused, lastOk, expected) => {
    const alerts = deriveOperationsAlerts({ ...quietInput(new Date(now)), schedulerPaused, worker: { ...quietWorker(new Date(now)), lastSuccessfulScheduleAt: lastOk } });
    expect(alerts.map((a) => a.code).filter((c) => c.startsWith('sched')).sort()).toEqual(expected);
  });
```

(`quietInput(now)` / `quietWorker(now)` are the existing fixtures that produce zero alerts at `now` — if they are inline in the file, extract them into helpers first.)

Run → FAIL (`schedulerPaused` not accepted / codes missing).

- [ ] **Step 4: Implement alerts + card**

`admin-operations.ts` — inside `deriveOperationsAlerts` (input type gains `schedulerPaused: boolean`), after the settler block:

```ts
  const hourUtc = input.now.getUTCHours();
  const inCreationWindow = hourUtc >= 12 && hourUtc <= 16;
  if (inCreationWindow) {
    if (input.schedulerPaused)
      alerts.push({ level: 'warning', code: 'scheduler-paused', message: 'Market creation is paused during the 12:00–16:59 UTC creation window' });
    else if (input.now.getUTCMinutes() >= 15) {
      const topOfHour = Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate(), hourUtc);
      const lastOk = input.worker.lastSuccessfulScheduleAt ? Date.parse(input.worker.lastSuccessfulScheduleAt) : null;
      if (lastOk === null || lastOk < topOfHour)
        alerts.push({ level: 'warning', code: 'schedule-missed', message: `No successful creation run yet for the ${String(hourUtc).padStart(2, '0')}:00 UTC slot` });
    }
  }
```

Pass `schedulerPaused: config.isPaused` from `getOperationsSnapshot`. In `operations-client.tsx` change the four-card grid to five: add `['Creation', snapshot.schedulerPaused ? 'Paused' : 'Enabled']` and `['Last creation run', \`${fmt(snapshot.worker.lastScheduleAt)} · ${snapshot.worker.lastScheduleStatus ?? '—'}\`]` (grid `md:grid-cols-3 lg:grid-cols-6`, or two rows — keep it readable).

- [ ] **Step 5: Run tests, lint, typecheck**

Run: `cd apps/web && npx vitest run src/lib/__tests__/worker-status.test.ts src/lib/__tests__/admin-operations.test.ts src/lib/__tests__/database-readiness.test.ts && cd ../.. && npm run typecheck && npm run lint`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/worker-status.ts apps/web/src/lib/__tests__/worker-status.test.ts apps/web/src/lib/admin-operations.ts apps/web/src/lib/__tests__/admin-operations.test.ts "apps/web/src/app/admin/(dashboard)/operations/operations-client.tsx"
git commit -m "feat(admin): surface scheduled-creation runs and alerts"
```

---

### Task 6: Operator tooling — scheduler key, worker profile, hosted flag, lifecycle upgrade commands

**Files:**
- Create: `scripts/development/setup-hosted-key.mjs`; Delete: `scripts/development/setup-hosted-settler.mjs`
- Modify: `scripts/development/worker-profile.mjs`, `scripts/verification/worker-profile.test.mjs`
- Modify: `scripts/development/worker.mjs`
- Modify: `scripts/development/hosted.mjs`, `apps/web/src/scripts/development-database.ts`
- Modify: `apps/web/src/scripts/arc-lifecycle.ts`
- Modify: `.env.arc-worker.example`, `package.json`

**Interfaces:**
- Produces: `npm run arc:hosted-key -- settler|scheduler` (writes `.tools/arc-hosted/<role>.json`, prints only the address); `npm run arc:hosted-settler` kept as an alias for `settler`; `npm run arc:hosted-scheduler`. `workerEnvironment()` requires `SCHEDULER_PRIVATE_KEY` (64-hex, ≠ `SETTLER_PRIVATE_KEY`) and includes it in `vercelEnv`. `npm run arc:worker -- schedules` creates/updates both `weatherb-arc-settle-sweep` and `weatherb-arc-schedule-daily` (`5 12-16 * * *`, `retries: 3`); `npm run arc:worker -- create-now` performs one authorized `GET /api/cron/schedule-daily` and prints the JSON. `npm run arc:hosted -- scheduler enable|disable` toggles `SystemConfig.isPaused`. `npm run arc:lifecycle -- upgrade | set-scheduler | fund-hosted-scheduler`; journal gains `hostedScheduler?: Hex` and `implementations?: { version: string; address: Hex; transaction: Hex }[]`.

- [ ] **Step 1: Generalize the key generator**

`scripts/development/setup-hosted-key.mjs` (content of the old `setup-hosted-settler.mjs` with the role parameterized):

```js
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
const role = process.argv[2];
if (!['settler', 'scheduler'].includes(role)) throw new Error('Use setup-hosted-key.mjs settler|scheduler');
const dir = fileURLToPath(new URL('../../.tools/arc-hosted', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const path = `${dir}/${role}.json`;
if (!existsSync(path)) {
  const privateKey = generatePrivateKey();
  writeFileSync(path, JSON.stringify({ role, chainId: ARC_TESTNET.id, createdAt: new Date().toISOString(), address: privateKeyToAccount(privateKey).address, privateKey }, null, 2), { mode: 0o600, flag: 'wx' });
}
if (statSync(path).mode & 0o077) throw new Error(`Hosted ${role} file permissions must be 0600`);
const saved = JSON.parse(readFileSync(path));
assertArcChain(saved.chainId);
console.log(`hosted ${role}: ${saved.address}`);
console.log(`Copy the private key into .env.arc-worker as ${role.toUpperCase()}_PRIVATE_KEY by hand (never via chat or logs).`);
```

`package.json`: `"arc:hosted-key": "node scripts/development/setup-hosted-key.mjs"`, `"arc:hosted-settler": "node scripts/development/setup-hosted-key.mjs settler"`, `"arc:hosted-scheduler": "node scripts/development/setup-hosted-key.mjs scheduler"`. `git rm scripts/development/setup-hosted-settler.mjs`. Update the comment in `.env.arc-worker.example` (`SETTLER_PRIVATE_KEY=REPLACE   # from .tools/arc-hosted/settler.json (npm run arc:hosted-settler)`) and add `SCHEDULER_PRIVATE_KEY=REPLACE # from .tools/arc-hosted/scheduler.json (npm run arc:hosted-scheduler)`.

- [ ] **Step 2: Worker profile — failing tests**

In `scripts/verification/worker-profile.test.mjs` the valid fixture gains `SCHEDULER_PRIVATE_KEY: '0x' + 'b'.repeat(64)`. Add:

```js
test('worker profile requires a distinct scheduler key and forwards it', () => {
  const env = workerEnvironment(valid());
  assert.equal(env.vercelEnv.SCHEDULER_PRIVATE_KEY, valid().SCHEDULER_PRIVATE_KEY);
  assert.throws(() => workerEnvironment({ ...valid(), SCHEDULER_PRIVATE_KEY: '' }), /SCHEDULER_PRIVATE_KEY/);
  assert.throws(() => workerEnvironment({ ...valid(), SCHEDULER_PRIVATE_KEY: valid().SETTLER_PRIVATE_KEY }), /must differ/);
});
```

Run: `npm run test:safety` → FAIL.

- [ ] **Step 3: Worker profile — implement**

In `worker-profile.mjs` after the `SETTLER_PRIVATE_KEY` check:

```js
  if (!/^0x[0-9a-fA-F]{64}$/.test(settings.SCHEDULER_PRIVATE_KEY ?? '')) throw new Error('SCHEDULER_PRIVATE_KEY missing or malformed');
  if (settings.SCHEDULER_PRIVATE_KEY.toLowerCase() === settings.SETTLER_PRIVATE_KEY.toLowerCase()) throw new Error('SCHEDULER_PRIVATE_KEY must differ from SETTLER_PRIVATE_KEY');
```
and `SCHEDULER_PRIVATE_KEY: settings.SCHEDULER_PRIVATE_KEY,` in `vercelEnv`.

Run: `npm run test:safety` → pass.

- [ ] **Step 4: worker.mjs — schedules and create-now**

Extend the command list to `['env-push', 'deploy', 'schedules', 'check', 'create-now']`. Replace the `schedules` branch:

```js
} else if (command === 'schedules') {
  const { Client } = await import('@upstash/qstash');
  const client = new Client({ token: worker.qstashToken });
  const headers = { Authorization: `Bearer ${worker.cronSecret}` };
  const defs = [
    { scheduleId: 'weatherb-arc-settle-sweep', cron: '*/2 * * * *', path: '/api/cron/settle-markets', retries: 0 },
    { scheduleId: 'weatherb-arc-schedule-daily', cron: '5 12-16 * * *', path: '/api/cron/schedule-daily', retries: 3 },
  ];
  for (const def of defs) {
    const destination = `${worker.workerUrl}${def.path}`;
    const schedule = await client.schedules.create({ scheduleId: def.scheduleId, destination, cron: def.cron, method: 'GET', retries: def.retries, headers });
    console.log(JSON.stringify({ scheduleId: schedule.scheduleId, cron: def.cron, destination }));
  }
} else if (command === 'create-now') {
  const response = await fetch(`${worker.workerUrl}/api/cron/schedule-daily`, { headers: { Authorization: `Bearer ${worker.cronSecret}` } });
  console.log(JSON.stringify({ status: response.status, body: await response.json() }, null, 2));
}
```
(`schedules.create` with an existing `scheduleId` upserts; the settle sweep definition is unchanged so re-running is safe.) Also add `schedule-daily` anonymous/authorized probes to the `check` branch output (`scheduleAnonymous`, `scheduleAuthorized`).

- [ ] **Step 5: Hosted scheduler flag**

`apps/web/src/scripts/development-database.ts` — after the `settler` branch:

```ts
  } else if (command === 'scheduler') {
    const mode = process.argv[3];
    if (mode !== 'enable' && mode !== 'disable') throw new Error('Use scheduler enable|disable');
    await db.systemConfig.update({ where: { id: 'default' }, data: { isPaused: mode === 'disable' } });
    console.log(JSON.stringify({ schedulerPaused: mode === 'disable' }));
```
Update the usage error string to include `scheduler`. `scripts/development/hosted.mjs`: add `scheduler: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'scheduler', ...process.argv.slice(3)],` and the usage string.

- [ ] **Step 6: arc-lifecycle — upgrade, set-scheduler, fund-hosted-scheduler**

In `apps/web/src/scripts/arc-lifecycle.ts`:

Journal type: add `hostedScheduler?: Hex;` and `implementations?: { version: string; address: Hex; transaction: Hex }[];`.

`send()` function-name union: add `'setScheduler' | 'upgradeToAndCall'`.

Extract the bytecode verification from `deploy` into a helper used by both `deploy` and `upgrade`:

```ts
async function verifyImplementationBytecode(implementation: Hex, artifact: { deployedBytecode: { object: string; immutableReferences: Record<string, { start: number; length: number }[]> } }) {
  const code = await publicClient.getCode({ address: implementation });
  let expectedCode: string = artifact.deployedBytecode.object;
  // UUPS embeds its implementation address in three immutable __self slots.
  for (const refs of Object.values(artifact.deployedBytecode.immutableReferences)) {
    for (const ref of refs) {
      const start = 2 + ref.start * 2;
      expectedCode = expectedCode.slice(0, start) + implementation.slice(2).toLowerCase().padStart(ref.length * 2, '0') + expectedCode.slice(start + ref.length * 2);
    }
  }
  if (code?.toLowerCase() !== expectedCode.toLowerCase()) throw new Error('Implementation bytecode does not match the local build.');
}
```

State snapshot helper (used before and after the upgrade):

```ts
async function snapshotState(target: Hex) {
  const read = <N extends 'owner' | 'settler' | 'feeBps' | 'minBetWei' | 'bettingBufferSeconds' | 'isPaused' | 'getMarketCount'>(functionName: N) =>
    publicClient.readContract({ address: target, abi, functionName });
  const [owner, settler, feeBps, minBetWei, buffer, paused, count] = await Promise.all([
    read('owner'), read('settler'), read('feeBps'), read('minBetWei'), read('bettingBufferSeconds'), read('isPaused'), read('getMarketCount'),
  ]);
  const markets = [];
  for (let id = 0n; id < count; id++) markets.push(await readMarket(publicClient, target, id));
  const slots = markets.map((m) => BigInt(Math.floor((Number(m.resolveTime) - 86400) / 3600) * 3600));
  const scheduled = await Promise.all(slots.map((slot) => publicClient.readContract({ address: target, abi, functionName: 'getScheduledMarket', args: [slot] })));
  return JSON.stringify({ owner, settler, feeBps, minBetWei, buffer, paused, count, markets, scheduled }, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}
```
(The `slots` derivation reads `getScheduledMarket` for the 12–16 UTC slot each existing market would have come from; non-scheduled markets just return 0 both times — the point is equality before/after.)

Commands:

```ts
  } else if (command === 'upgrade') {
    const target = await requireDeployment();
    const source = readFileSync(`${root}contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json`, 'utf8');
    const artifact = JSON.parse(source);
    const expectedVersion = /return "(\d+\.\d+\.\d+)";/.exec(readFileSync(`${root}contracts/src/WeatherMarketV2.sol`, 'utf8'))![1]!;
    const before = await snapshotState(target);
    const currentVersion = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (currentVersion === expectedVersion) throw new Error(`Proxy already reports ${expectedVersion}.`);
    const signer = wallet('owner');
    const implementationReceipt = await receipt('upgrade-implementation', () =>
      signer.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object }),
    );
    const implementation = implementationReceipt.contractAddress!;
    await verifyImplementationBytecode(implementation, artifact);
    const upgradeReceipt = await send('upgrade-proxy', 'owner', 'upgradeToAndCall', [implementation, '0x']);
    const after = await snapshotState(target);
    if (after !== before) throw new Error('State snapshot changed across the upgrade; investigate before continuing.');
    const version = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (version !== expectedVersion) throw new Error(`Upgrade did not produce ${expectedVersion} (got ${version}).`);
    journal.implementation = implementation;
    journal.build = createHash('sha256').update(source).digest('hex');
    (journal.implementations ??= []).push({ version, address: implementation, transaction: upgradeReceipt.transactionHash });
    save();
    console.log(`proxy ${target} now runs ${version} at implementation ${implementation}`);
  } else if (command === 'set-scheduler') {
    const file = `${root}.tools/arc-hosted/scheduler.json`;
    if (statSync(file).mode & 0o077) throw new Error('Hosted scheduler file must have mode 0600.');
    const hosted = JSON.parse(readFileSync(file, 'utf8')) as { chainId: number; address: Hex };
    assertArcChain(hosted.chainId);
    const target = await requireDeployment();
    const version = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (version === '2.2.0') throw new Error('Run upgrade first; 2.2.0 has no scheduler role.');
    await send('set-scheduler', 'owner', 'setScheduler', [hosted.address]);
    const current = await publicClient.readContract({ address: target, abi, functionName: 'scheduler' });
    if (current.toLowerCase() !== hosted.address.toLowerCase()) throw new Error('Scheduler assignment not confirmed.');
    journal.hostedScheduler = hosted.address;
    save();
    console.log(`scheduler is now hosted ${hosted.address}`);
  } else if (command === 'fund-hosted-scheduler') {
    if (!journal.hostedScheduler) throw new Error('Run set-scheduler first.');
    const signer = wallet('owner');
    const to = journal.hostedScheduler;
    await receipt('fund-hosted-scheduler', () => signer.sendTransaction({ to, value: parseNativeUsdc('2') }));
    console.log(`hosted scheduler balance: ${formatEther(await publicClient.getBalance({ address: to }))} USDC`);
```

`send()` must return the receipt (check its current return; if it returns `void`, return the `receipt(...)` result). Update the usage error string with the three new commands. Note `send` calls `requireDeployment()` internally — that is fine for `upgradeToAndCall` because the role checks (owner, settler) hold before and after.

`status` command: also print `scheduler` from chain when `version !== '2.2.0'`, and `journal.hostedScheduler`.

- [ ] **Step 7: Typecheck, lint, safety, targeted tests**

Run: `npm run typecheck && npm run lint && npm run test:safety`
Expected: clean. Then `node scripts/development/worker.mjs check` against the existing `.env.arc-worker` must now **fail** with `SCHEDULER_PRIVATE_KEY missing or malformed` — this is the intended guard until Task 7 fills it. (Do not fill it in this task.)

- [ ] **Step 8: Commit**

```bash
git add scripts/development/setup-hosted-key.mjs scripts/development/worker-profile.mjs scripts/verification/worker-profile.test.mjs scripts/development/worker.mjs scripts/development/hosted.mjs apps/web/src/scripts/development-database.ts apps/web/src/scripts/arc-lifecycle.ts .env.arc-worker.example package.json
git rm -q scripts/development/setup-hosted-settler.mjs
git commit -m "feat(ops): scheduler key setup, worker profile, hosted flag, and lifecycle upgrade commands"
```

Then: `npm run verify` — must be fully green before any operator step.

---

### Task 7: Operator — deploy code, upgrade the proxy, assign and fund the scheduler (creation stays paused)

Nothing in this task creates a market. Record every result in `docs/testing/arc-testnet-lifecycle-acceptance.md` (Task 9). Same secrecy rules as the settlement handover: throwaway scripts under `/tmp/weatherb-ops/`, no secret in argv or output.

- [ ] **Step 1: Preflight**
  - `npm run verify` green on the final code commit.
  - `npm run arc:lifecycle -- status`: owner ≥ 3 USDC (upgrade gas + 2 USDC funding), chain `version() == 2.2.0`, `settler()` = hosted settler.
  - Both `/api/health` endpoints: `settler: enabled`, sweeps succeeding.

- [ ] **Step 2: Scheduler key and profile**
  - `npm run arc:hosted-scheduler` → prints the scheduler address only. Record it.
  - Copy the key into `.env.arc-worker` as `SCHEDULER_PRIVATE_KEY` via a `/tmp` script reading `.tools/arc-hosted/scheduler.json` (never printed). `node scripts/development/worker.mjs check` now passes the profile guard.

- [ ] **Step 3: Deploy the version-tolerant code first**
  - `npm run arc:worker -- env-push` (adds `SCHEDULER_PRIVATE_KEY`; 14 keys) then `npm run arc:worker -- deploy`.
  - Public project (repo root is linked to it): `vercel deploy --prod --yes`. No new public env. **This must precede the upgrade**: the public site's `arc-wallet.ts` refuses to prepare bets against an unsupported version, so upgrading first would block users until the redeploy.
  - Verify: worker `/api/health` 200, `settler: enabled`, next sweep `succeeded` (still 2.2.0 on chain — proves both-version acceptance); `curl -s -o /dev/null -w '%{http_code}' https://weatherb-arc-worker.vercel.app/api/cron/schedule-daily` → 401; `npm run arc:worker -- check` shows `scheduleAuthorized` → `200 { skipped: true, reason: "scheduler is paused" }`.

- [ ] **Step 4: Upgrade the proxy (owner)**
  - `npm --workspace=@weatherb/contracts run build && npm run check:storage-layout && npm run check:abi` — must pass on the exact commit being deployed.
  - `npm run arc:lifecycle -- upgrade` → expect `upgrade-implementation` and `upgrade-proxy` receipt links, then `proxy 0xd86e… now runs 2.3.0 at implementation 0x…`. The command aborts if the pre/post snapshot differs.
  - Independent read: `version() == 2.3.0`, `owner`, `settler`, `getMarketCount() == 7` (or current), `getMarket(2)` and `getMarket(3)` unchanged, `scheduler() == 0x0`.
  - Wait for the next sweep: worker `/api/health` still `lastSweepStatus: succeeded`. Public site homepage and `/api/markets` still serve Markets 2/3.

- [ ] **Step 5: Assign and fund the scheduler**
  - `npm run arc:lifecycle -- set-scheduler` → `scheduler is now hosted 0x…`; independent read `scheduler()` equals the address from Step 2.
  - `npm run arc:lifecycle -- fund-hosted-scheduler` → balance ≈ 2 USDC.
  - `npm run arc:lifecycle -- status` → shows version 2.3.0, hosted settler, hosted scheduler.

- [ ] **Step 6: Register the daily schedule, still paused**
  - `npm run arc:worker -- schedules` → prints both schedule IDs; `weatherb-arc-schedule-daily` cron `5 12-16 * * *`.
  - The hosted scheduler flag remains **paused**; at the next `:05` inside 12–16 UTC a `schedule-daily` run must appear as `skipped` in `/admin/operations` (proves trigger path). Outside the window nothing fires.

---

### Task 8: Operator — one manual creation, then hand creation over

Perform inside a 12:00–16:59 UTC window (first opportunity: 2026-09-21). Markets 2/3 settle at 12:08 UTC the same day; the two signers use separate leases and do not interfere, but for clean evidence do the manual trigger at **12:20 UTC or later** so the settlement evidence is already recorded.

- [ ] **Step 1: Enable and trigger once**
  - `npm run arc:hosted -- scheduler enable`.
  - `npm run arc:worker -- create-now` → expect `200 { success: true, created: 1, market: { marketId, thresholdTenths, transactionHash }, settlementSchedule: { scheduled: true, messageId } }`. Record the market ID, city (from `/api/markets`), threshold, tx link, and the `WorkerRun` id/trigger (`manual`).
  - Verify: chain `getScheduledMarket(<current slot>) == id + 1`; `getMarket(id).resolveTime == creation block + 86400`; hosted DB row present with `isTest = false`; the public site lists it under active markets; `/admin/operations` shows a `succeeded` `schedule-daily` run and no `schedule-missed` alert.
  - Idempotency: run `npm run arc:worker -- create-now` again → `created: 0`, same `marketId`, no new transaction — live evidence that a duplicate trigger is harmless.

- [ ] **Step 2: Leave it enabled and watch the next slot**
  - Do **not** disable. At the next `HH:05` UTC (≤ 16:05) the QStash schedule must create the following slot's market: `/admin/operations` shows trigger `qstash:weatherb-arc-schedule-daily`, `created: 1`, a new market for the next city in rotation. Record it.
  - If the `:05` run fails (`503`), QStash retries up to 3 times; the `schedule-missed` alert fires at `:15` if none succeeded. Investigate via the run's redacted error before intervening; do not create manually.

- [ ] **Step 3: Confirm the daily cadence the following day**
  - On 2026-09-22 after 16:20 UTC: exactly five new markets (slots 12–16) exist on chain and in the DB; each has a `settlementMessageId`; the scheduler balance dropped by roughly five creations of gas. From then on the product runs unattended: creation at `:05`, settlement 24 h later.

---

### Task 9: Documentation and closing

**Files:**
- Modify: `docs/testing/arc-hosted-testnet.md` (Settlement worker → "Settlement and creation worker": scheduler address, `SCHEDULER_PRIVATE_KEY`, both schedules, `arc:hosted -- scheduler enable|disable`, `arc:worker -- create-now`, `arc:lifecycle -- upgrade|set-scheduler|fund-hosted-scheduler`, the two new alerts, the contract freeze note).
- Modify: `docs/testing/arc-testnet-lifecycle-acceptance.md` — "2026-09-21 — 2.3.0 upgrade and automated creation" section: storage-layout check output, implementation address and both receipts, snapshot equality, scheduler address/receipt/funding, manual creation evidence, first automated slot evidence, five-slot confirmation.
- Modify: `AGENTS.md` banner: version is now 2.3.0; "Automatic market creation runs from the worker via QStash `5 12-16 * * *` with the scheduler role; the owner key remains local." Update the Quick Reference line.
- Modify: `docs/backlog-and-ideas.md`: mark the scheduler-role item done with the date; add "Contract freeze before audit — no further contract changes until the audit scope is set" as a note.
- Create: `docs/memory/2026-09-21/scheduler-role-upgrade-memory-2026-09-21.md` (decisions: scheduler may call both create functions and why that was accepted; layout-baseline guard; version tolerance; staged go-live; state at handoff).

- [ ] **Step 1: Write the docs listed above** (facts only from recorded evidence; mark anything that did not pass).
- [ ] **Step 2: Commit**

```bash
git add docs AGENTS.md
git commit -m "docs: scheduler role upgrade runbook, acceptance evidence, and restart notes"
```

---

## Rollback

- Before Step 4 of Task 7 nothing on chain changed; redeploying the previous commit to both projects restores the old behavior.
- After the upgrade: 2.3.0 is a superset of 2.2.0. If creation misbehaves, `npm run arc:hosted -- scheduler disable` stops the worker; `setScheduler(address(0))` (add a `revoke-scheduler` lifecycle command if ever needed — one owner tx) removes the role on chain. Downgrading the implementation is not planned; the layout guard and the preserved-state snapshot make it unnecessary.

## Out of scope

- Contract audit (schedule after this upgrade; freeze the contract first).
- Per-capability admin writes; push notifications; QStash signature verification; Upstash Redis on the worker (see `docs/backlog-and-ideas.md`).
- Any change to market rules, fees, minimum bet, or duration.
