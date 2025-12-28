# Add NoWinners Market Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new `NoWinners` market status to distinguish markets auto-cancelled due to zero winning pool from manually cancelled markets.

**Architecture:** This requires changes across the full stack:
- Solidity contract enum update (requires UUPS upgrade)
- Shared TypeScript types update
- Frontend status mapping and display logic
- Settlement cron job status handling
- Contract upgrade deployment script

**Tech Stack:** Solidity 0.8.24, Foundry, TypeScript, Next.js, Viem, UUPS Proxy Pattern

---

## Background

Currently, when a market is settled but has zero bets on the winning side, the contract auto-cancels it (sets status to `Cancelled`). This creates confusion because:
- Markets that were technically "resolved" (temperature checked) show as "Cancelled"
- Users can't distinguish between admin-cancelled and auto-cancelled markets
- The UI shows "Cancelled" for markets that actually settled

The fix adds a new `NoWinners` status (enum value 4) to make this distinction clear.

---

## Task 1: Update Contract Interface and Add NoWinners Status

**Files:**
- Modify: `contracts/src/interfaces/IWeatherMarket.sol:6-9`
- Modify: `contracts/src/WeatherMarketV2.sol:308-312`
- Modify: `contracts/src/WeatherMarketV2.sol:76-80` (version bump)

**Step 1: Add NoWinners to enum in interface**

In `contracts/src/interfaces/IWeatherMarket.sol`, update the enum:

```solidity
enum MarketStatus {
    Open,
    Closed,
    Resolved,
    Cancelled,
    NoWinners
}
```

**Step 2: Update auto-cancel logic in WeatherMarketV2**

In `contracts/src/WeatherMarketV2.sol`, find the `resolveMarket` function around line 308 and change:

```solidity
// Auto-cancel if no winners → use NoWinners status instead
if (winningPool == 0) {
    market.status = MarketStatus.NoWinners;
    market.resolvedTempTenths = tempTenths;
    market.observedTimestamp = observedTimestamp;
    emit MarketResolved(marketId, outcome, tempTenths, observedTimestamp);
    return;
}
```

**Step 3: Bump version number**

In `contracts/src/WeatherMarketV2.sol`, update the version function (around line 76):

```solidity
function version() external pure returns (string memory) {
    return "2.1.0";
}
```

**Step 4: Build contract**

Run: `forge build`
Expected: SUCCESS with no compilation errors

**Step 5: Commit**

```bash
git add contracts/src/interfaces/IWeatherMarket.sol contracts/src/WeatherMarketV2.sol
git commit -m "feat(contract): add NoWinners market status enum"
```

---

## Task 2: Write Contract Tests for NoWinners Status

**Files:**
- Modify: `contracts/test/WeatherMarket.t.sol`

**Step 1: Write test for no winners on YES side**

Add this test to `contracts/test/WeatherMarket.t.sol`:

```solidity
function test_noWinnersStatusWhenOnlyNoBets() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    // Only bob bets NO
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);

    // Temperature 900 = 90.0°F > threshold 850 = 85.0°F → YES wins, but no YES bets
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertEq(uint8(m.status), 4); // NoWinners = enum value 4
    assertEq(m.resolvedTempTenths, 900);
    assertEq(m.observedTimestamp, resolveTime);
    assertEq(m.outcome, true); // YES won (temp >= threshold)
}
```

**Step 2: Write test for no winners on NO side**

```solidity
function test_noWinnersStatusWhenOnlyYesBets() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    // Only alice bets YES
    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.warp(resolveTime);

    // Temperature 800 = 80.0°F < threshold 850 = 85.0°F → NO wins, but no NO bets
    vm.prank(settler);
    market.resolveMarket(marketId, 800, uint64(resolveTime));

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertEq(uint8(m.status), 4); // NoWinners
    assertEq(m.resolvedTempTenths, 800);
    assertEq(m.observedTimestamp, resolveTime);
    assertEq(m.outcome, false); // NO won (temp < threshold)
}
```

**Step 3: Write test for refund claim on NoWinners**

```solidity
function test_claimRefundOnNoWinnersMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    // Only bob bets NO
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);

    // YES wins, but no YES bets → NoWinners
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    // Bob should get full refund
    uint256 bobBefore = bob.balance;
    vm.prank(bob);
    market.claim(marketId);
    uint256 bobAfter = bob.balance;

    assertEq(bobAfter - bobBefore, 1 ether); // Full refund, no fees
}
```

**Step 4: Run tests to verify they fail (NoWinners not implemented yet in claim logic)**

Run: `forge test --match-test test_noWinners -vv`
Expected: Tests compile but may fail on claim logic (we'll fix claim in next task)

**Step 5: Commit**

```bash
git add contracts/test/WeatherMarket.t.sol
git commit -m "test(contract): add NoWinners status test cases"
```

---

## Task 3: Update Contract Claim Logic for NoWinners

**Files:**
- Modify: `contracts/src/WeatherMarketV2.sol` (claim function, around line 380-420)

**Step 1: Find the claim function**

Search for `function claim(uint256 marketId)` in WeatherMarketV2.sol (around line 380).

**Step 2: Update claim to handle NoWinners like Cancelled**

In the claim function, find the status check logic and update it to treat NoWinners same as Cancelled for refunds:

```solidity
function claim(uint256 marketId) external nonReentrant {
    Market storage market = _getMarketStorage(marketId);
    Position storage position = positions[marketId][msg.sender];

    if (position.claimed) revert AlreadyClaimed();
    if (position.yesAmount == 0 && position.noAmount == 0) revert NothingToClaim();

    MarketStatus status = market.status;

    // Handle Cancelled or NoWinners → full refund
    if (status == MarketStatus.Cancelled || status == MarketStatus.NoWinners) {
        uint256 refund = position.yesAmount + position.noAmount;
        if (refund == 0) revert NothingToClaim();

        position.claimed = true;

        (bool ok, ) = msg.sender.call{value: refund}("");
        if (!ok) revert TransferFailed();

        emit Claimed(marketId, msg.sender, refund);
        return;
    }

    // Handle Resolved markets (existing logic continues...)
    if (status != MarketStatus.Resolved) revert InvalidStatus();

    // ... rest of existing claim logic
}
```

**Step 3: Run all tests**

Run: `forge test -vv`
Expected: All tests pass, including new NoWinners tests

**Step 4: Run specific NoWinners tests**

Run: `forge test --match-test test_noWinners -vvv`
Expected: All 3 NoWinners tests pass

**Step 5: Commit**

```bash
git add contracts/src/WeatherMarketV2.sol
git commit -m "feat(contract): handle NoWinners in claim function for refunds"
```

---

## Task 4: Update Shared TypeScript Types

**Files:**
- Modify: `packages/shared/src/types/market.ts:1`
- Modify: `packages/shared/src/abi/weather-market.ts` (regenerate ABI)

**Step 1: Add 'noWinners' to MarketStatus type**

In `packages/shared/src/types/market.ts`, update line 1:

```typescript
export type MarketStatus = 'open' | 'closed' | 'resolved' | 'cancelled' | 'noWinners';
```

**Step 2: Regenerate ABI from contract**

Run: `forge inspect WeatherMarketV2 abi > packages/shared/src/abi/weather-market-raw.json`

**Step 3: Update the ABI export**

Manually update `packages/shared/src/abi/weather-market.ts` with the new ABI, or verify it includes the new enum value.

**Step 4: Build shared package**

Run: `pnpm --filter @weatherb/shared build`
Expected: SUCCESS with no TypeScript errors

**Step 5: Commit**

```bash
git add packages/shared/src/types/market.ts packages/shared/src/abi/
git commit -m "feat(shared): add noWinners to MarketStatus type"
```

---

## Task 5: Update Frontend Status Mapping Functions

**Files:**
- Modify: `apps/web/src/lib/contract-data.ts:60-73`
- Modify: `apps/web/src/lib/positions.ts:69-82`
- Modify: `apps/web/src/app/api/cron/settle-markets/route.ts:29`

**Step 1: Update toMarketStatus in contract-data.ts**

In `apps/web/src/lib/contract-data.ts`, update the function:

```typescript
function toMarketStatus(statusNum: number): MarketStatus {
  switch (statusNum) {
    case 0:
      return 'open';
    case 1:
      return 'closed';
    case 2:
      return 'resolved';
    case 3:
      return 'cancelled';
    case 4:
      return 'noWinners';
    default:
      return 'open';
  }
}
```

**Step 2: Update toMarketStatus in positions.ts**

In `apps/web/src/lib/positions.ts`, update the identical function:

```typescript
function toMarketStatus(statusNum: number): MarketStatus {
  switch (statusNum) {
    case 0:
      return 'open';
    case 1:
      return 'closed';
    case 2:
      return 'resolved';
    case 3:
      return 'cancelled';
    case 4:
      return 'noWinners';
    default:
      return 'open';
  }
}
```

**Step 3: Update STATUS_MAP in settle-markets route**

In `apps/web/src/app/api/cron/settle-markets/route.ts`, update the type and map:

```typescript
type MarketStatus = 'Open' | 'Closed' | 'Resolved' | 'Cancelled' | 'NoWinners';

const STATUS_MAP: readonly MarketStatus[] = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;
```

**Step 4: Build web app to check for type errors**

Run: `pnpm --filter @weatherb/web exec tsc --noEmit`
Expected: SUCCESS with no TypeScript errors

**Step 5: Commit**

```bash
git add apps/web/src/lib/contract-data.ts apps/web/src/lib/positions.ts apps/web/src/app/api/cron/settle-markets/route.ts
git commit -m "feat(web): add noWinners status mapping in frontend utils"
```

---

## Task 6: Update Position Status Logic for NoWinners

**Files:**
- Modify: `apps/web/src/lib/positions.ts:87-117`

**Step 1: Update determinePositionStatus function**

In `apps/web/src/lib/positions.ts`, update the function to treat NoWinners like Cancelled:

```typescript
function determinePositionStatus(
  marketStatus: MarketStatus,
  position: { yesAmount: bigint; noAmount: bigint; claimed: boolean },
  market: { outcome: boolean },
  payout: bigint
): PositionStatus {
  // Cancelled or NoWinners markets → refundable
  if (marketStatus === 'cancelled' || marketStatus === 'noWinners') {
    return position.claimed ? 'refunded' : 'refundable';
  }

  // Unresolved markets
  if (marketStatus !== 'resolved') {
    return 'active';
  }

  // Resolved markets
  const userBetYes = position.yesAmount > 0n;
  const didUserWin = (userBetYes && market.outcome) || (!userBetYes && !market.outcome);

  if (!didUserWin) {
    return 'lost';
  }

  // User won
  if (position.claimed) {
    return 'claimed';
  }

  return payout > 0n ? 'claimable' : 'claimed';
}
```

**Step 2: Update payout call logic in fetchUserPositions**

In the same file around line 192, update the condition to include NoWinners:

```typescript
if ((marketStatus === 'resolved' || marketStatus === 'cancelled' || marketStatus === 'noWinners') && !position.claimed) {
  payoutCalls.push({
    address: contractAddress,
    abi: WEATHER_MARKET_ABI,
    functionName: 'calculatePayout',
    args: [BigInt(marketIndex), walletAddress as Hex],
  });
  payoutIndices.push(resultIndex);
}
```

**Step 3: Update claimable amount fallback logic**

Around line 250-253, update to include noWinners:

```typescript
// For cancelled or noWinners markets without payout, use bet amount
if ((marketStatus === 'cancelled' || marketStatus === 'noWinners') && !position.claimed && claimableAmount === undefined) {
  claimableAmount = betAmount;
}
```

**Step 4: Build web app**

Run: `pnpm --filter @weatherb/web exec tsc --noEmit`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add apps/web/src/lib/positions.ts
git commit -m "feat(positions): handle noWinners status for refunds"
```

---

## Task 7: Update Frontend UI Display for NoWinners

**Files:**
- Modify: `apps/web/src/components/home/home-client.tsx:160-164`

**Step 1: Update Past Markets display logic**

In `apps/web/src/components/home/home-client.tsx`, update the status display:

```tsx
<p className="font-body text-sm text-neutral-500">
  Threshold:{' '}
  <TemperatureDisplay fahrenheit={thresholdValue} size="sm" />
  {' '} -{' '}
  {market.status === 'resolved'
    ? market.outcome
      ? 'YES Won'
      : 'NO Won'
    : market.status === 'noWinners'
    ? 'Settled (No Winners)'
    : 'Cancelled'}
</p>
```

**Step 2: Update Past Markets filter to include noWinners**

In `apps/web/src/app/api/markets/route.ts`, update the filter around line 17:

```typescript
if (status === 'past') {
  filteredMarkets = markets.filter(
    (market) => market.status === 'resolved' || market.status === 'cancelled' || market.status === 'noWinners'
  );
} else if (status === 'active') {
  // Active markets include both 'open' (can bet) and 'closed' (betting ended, waiting for resolution)
  filteredMarkets = markets.filter((market) => market.status === 'open' || market.status === 'closed');
}
```

**Step 3: Update contract-data to add resolution data for noWinners**

In `apps/web/src/lib/contract-data.ts`, around line 158-163:

```typescript
// Add resolution data if market is resolved OR noWinners
if (status === 'resolved' || status === 'noWinners') {
  market.resolvedTempF_tenths = Number(marketData.resolvedTempTenths);
  market.observedTimestamp = Number(marketData.observedTimestamp) * 1000;
  if (status === 'resolved') {
    market.outcome = marketData.outcome;
  }
}
```

**Step 4: Build web app**

Run: `pnpm --filter @weatherb/web build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add apps/web/src/components/home/home-client.tsx apps/web/src/app/api/markets/route.ts apps/web/src/lib/contract-data.ts
git commit -m "feat(ui): display 'Settled (No Winners)' for noWinners markets"
```

---

## Task 8: Update Settlement Cron to Skip NoWinners

**Files:**
- Modify: `apps/web/src/app/api/cron/settle-markets/route.ts:82-83`

**Step 1: Update pending markets filter**

In the `fetchPendingMarkets` function, update to skip NoWinners:

```typescript
// Skip already resolved, cancelled, or noWinners markets
if (status === 'Resolved' || status === 'Cancelled' || status === 'NoWinners') continue;
```

**Step 2: Build web app**

Run: `pnpm --filter @weatherb/web build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/settle-markets/route.ts
git commit -m "feat(cron): skip noWinners markets in settlement job"
```

---

## Task 9: Update Admin Dashboard (Optional but Recommended)

**Files:**
- Modify: `apps/web/src/lib/admin-data.ts` (if it has status logic)
- Modify: `apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx` (if it displays status)

**Step 1: Search for status display in admin components**

Run: `grep -n "status.*cancelled\|status.*resolved" apps/web/src/app/admin/(dashboard)/markets/markets-client.tsx`

**Step 2: Update any admin UI that displays market status**

Add noWinners handling wherever markets are displayed in admin panel. Example:

```tsx
{market.status === 'noWinners' && (
  <span className="...">No Winners</span>
)}
```

**Step 3: Build and verify**

Run: `pnpm --filter @weatherb/web build`
Expected: SUCCESS

**Step 4: Commit (if changes made)**

```bash
git add apps/web/src/app/admin/
git commit -m "feat(admin): display noWinners status in admin panel"
```

---

## Task 10: Create UUPS Upgrade Script

**Files:**
- Create: `contracts/script/UpgradeToV2_1.s.sol`

**Step 1: Write upgrade script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeToV2_1Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("NEXT_PUBLIC_CONTRACT_ADDRESS");

        console.log("Upgrading WeatherMarketV2 to v2.1.0...");
        console.log("Proxy address:", proxyAddress);
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        WeatherMarketV2 newImpl = new WeatherMarketV2();
        console.log("New implementation deployed at:", address(newImpl));

        // Upgrade proxy to new implementation
        WeatherMarketV2 proxy = WeatherMarketV2(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        // Verify upgrade
        console.log("New version:", proxy.version());
        require(
            keccak256(bytes(proxy.version())) == keccak256(bytes("2.1.0")),
            "Version mismatch"
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== UPGRADE COMPLETE ===");
        console.log("Proxy (same address):", proxyAddress);
        console.log("New implementation:", address(newImpl));
        console.log("Version:", proxy.version());
    }
}
```

**Step 2: Test upgrade script locally (dry-run)**

Run: `forge script script/UpgradeToV2_1.s.sol:UpgradeToV2_1Script --rpc-url $RPC_URL`
Expected: Script simulates successfully

**Step 3: Commit**

```bash
git add contracts/script/UpgradeToV2_1.s.sol
git commit -m "feat(deploy): add UUPS upgrade script for v2.1.0"
```

---

## Task 11: Update Tests for Settlement with NoWinners

**Files:**
- Modify: `apps/web/src/app/api/cron/__tests__/settle-markets.test.ts` (if exists)

**Step 1: Check if settlement tests exist**

Run: `ls -la apps/web/src/app/api/cron/__tests__/`

**Step 2: Add test for NoWinners status in settlement**

If tests exist, add a test case for the NoWinners scenario:

```typescript
describe('settle-markets with NoWinners', () => {
  it('should set NoWinners status when winning pool is zero', async () => {
    // Mock market with only NO bets
    // Mock temperature that makes YES win
    // Assert status becomes 'NoWinners'
    // Assert resolvedTempF_tenths is set
  });
});
```

**Step 3: Run tests**

Run: `pnpm --filter @weatherb/web test`
Expected: All tests pass

**Step 4: Commit (if changes made)**

```bash
git add apps/web/src/app/api/cron/__tests__/
git commit -m "test(cron): add NoWinners status test for settlement"
```

---

## Task 12: Documentation and Final Verification

**Files:**
- Create: `docs/CHANGELOG.md` (or append to existing)
- Modify: `PRD.md` (update status behavior documentation)

**Step 1: Document the change in CHANGELOG**

```markdown
## [2.1.0] - 2025-12-27

### Added
- New `NoWinners` market status to distinguish auto-cancelled markets (zero winning pool) from manually cancelled markets
- Markets with no bets on the winning side now settle with `NoWinners` status instead of `Cancelled`
- Frontend displays "Settled (No Winners)" for `NoWinners` markets
- Users can still claim full refunds on `NoWinners` markets (same as `Cancelled`)

### Changed
- Contract version bumped to 2.1.0
- UUPS upgrade required to production contract

### Technical Details
- Contract: Added `NoWinners` enum value (4) to `MarketStatus`
- Frontend: Updated all status mapping and display logic
- Settlement: Temperature and timestamp are now recorded for `NoWinners` markets
```

**Step 2: Update PRD.md market lifecycle documentation**

Search for market status documentation in PRD.md and add:

```markdown
#### Market Status: NoWinners

A market enters `NoWinners` status when:
- Settlement occurs (temperature is checked)
- The winning side has zero bets
- Losing side bets are refundable

This differs from `Cancelled` which is for admin-cancelled markets.
```

**Step 3: Run full build**

Run: `pnpm run build`
Expected: All packages build successfully

**Step 4: Run all contract tests**

Run: `forge test`
Expected: All tests pass

**Step 5: Final commit**

```bash
git add docs/ PRD.md
git commit -m "docs: document NoWinners status feature"
```

---

## Task 13: Production Upgrade Execution Plan

**Files:**
- Create: `docs/deployment/upgrade-v2.1.0.md`

**Step 1: Create upgrade runbook**

```markdown
# WeatherMarketV2 Upgrade to v2.1.0 - Production Runbook

## Pre-Upgrade Checklist
- [ ] All tests pass locally (`forge test && pnpm test`)
- [ ] Upgrade script tested on testnet (Coston2)
- [ ] Frontend build succeeds
- [ ] Database backup completed (if applicable)
- [ ] Announce maintenance window to users

## Upgrade Steps

### 1. Deploy to Testnet (Coston2) First
```bash
# Set testnet environment
export DEPLOYER_PRIVATE_KEY=$SCHEDULER_PRIVATE_KEY
export NEXT_PUBLIC_CONTRACT_ADDRESS=<coston2-proxy-address>
export RPC_URL=https://coston2-api.flare.network/ext/C/rpc

# Run upgrade
forge script script/UpgradeToV2_1.s.sol:UpgradeToV2_1Script \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### 2. Test on Testnet
- [ ] Create test market with only YES bets
- [ ] Settle with temperature that makes NO win
- [ ] Verify market shows NoWinners status
- [ ] Verify user can claim refund
- [ ] Check frontend displays "Settled (No Winners)"

### 3. Deploy to Production (Mainnet)
```bash
# Set production environment
export DEPLOYER_PRIVATE_KEY=<production-deployer-key>
export NEXT_PUBLIC_CONTRACT_ADDRESS=<mainnet-proxy-address>
export RPC_URL=<mainnet-rpc-url>

# Run upgrade
forge script script/UpgradeToV2_1.s.sol:UpgradeToV2_1Script \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### 4. Deploy Frontend
```bash
# Frontend automatically picks up new ABI
pnpm --filter @weatherb/web build
vercel --prod
```

### 5. Post-Upgrade Verification
- [ ] Check contract version: `cast call $PROXY "version()" --rpc-url $RPC_URL`
- [ ] Verify existing markets still work
- [ ] Monitor next settlement for NoWinners case
- [ ] Check error logs in Vercel

## Rollback Plan
If issues arise, the owner can:
1. Deploy previous implementation
2. Call `upgradeToAndCall()` with old implementation address
3. Redeploy previous frontend version

## Estimated Downtime
- Smart contract: ~0 seconds (UUPS upgrade is atomic)
- Frontend: ~2 minutes (Vercel deployment)
```

**Step 2: Commit runbook**

```bash
git add docs/deployment/upgrade-v2.1.0.md
git commit -m "docs: add production upgrade runbook for v2.1.0"
```

---

## Post-Implementation Testing Checklist

Before marking complete, verify:

- [ ] `forge test` passes all contract tests
- [ ] `pnpm --filter @weatherb/shared build` succeeds
- [ ] `pnpm --filter @weatherb/web build` succeeds
- [ ] `pnpm test` passes all frontend tests (if any)
- [ ] Manually test on local Anvil:
  - Deploy contract
  - Create market with only YES bets
  - Settle with NO winning temperature
  - Verify NoWinners status
  - Claim refund
- [ ] Test upgrade script on Coston2 testnet
- [ ] Verify frontend displays "Settled (No Winners)"

---

## Notes for Implementation

### DRY Violations to Clean Up
- `toMarketStatus` function is duplicated in `contract-data.ts` and `positions.ts`
- Consider extracting to shared utility in `packages/shared/src/utils/`

### Future Improvements
- Add GraphQL/event indexing to track NoWinners markets separately
- Analytics dashboard for NoWinners frequency
- Consider auto-canceling markets with zero total bets before settlement

### Testing Strategy
- TDD: Write contract tests first, then implementation
- Integration: Test full flow from settlement cron → contract → frontend display
- Regression: Ensure existing Cancelled behavior unchanged

---

## Execution Complete

Once all tasks are done:
1. Create PR with all commits
2. Request code review
3. Test on staging/testnet
4. Follow upgrade runbook for production deployment
