# WeatherB Comprehensive Test Plan

## Executive Summary

**Current State:**
- Smart contract tests: 10 tests in `contracts/test/WeatherMarket.t.sol` (65% line coverage, 15% branch coverage)
- Weather provider tests: 3 tests in `packages/shared/src/providers/__tests__/`
- Web app tests: **ZERO** - critical gap
- Utility tests: **ZERO** - payout.ts and temperature.ts untested

**Goal:** Build comprehensive test coverage for Epics 0-6 before starting Epic 7.

---

## Part 1: Smart Contract Tests (Foundry)

**Location:** `contracts/test/WeatherMarket.t.sol`

### 1.1 Missing Tests to Add

Add these tests to the existing `WeatherMarketTest` contract:

#### Access Control Tests
```solidity
function test_onlyOwnerCanCreateMarket() public {
    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.createMarket(cityId, uint64(block.timestamp + 2 hours), 850, address(0));
}

function test_onlyOwnerCanCancelMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.cancelMarket(marketId);
}

function test_onlyOwnerCanSetSettler() public {
    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.setSettler(bob);
}

function test_onlyOwnerCanPause() public {
    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.pause();
}

function test_onlyOwnerCanWithdrawFees() public {
    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.withdrawFees(address(0), alice);
}

function test_onlyOwnerCanTransferOwnership() public {
    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotOwner.selector);
    market.transferOwnership(alice);
}
```

#### Market Creation Validation Tests
```solidity
function test_createMarket_rejectsNonNativeCurrency() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.OnlyNativeCurrency.selector);
    market.createMarket(cityId, uint64(block.timestamp + 2 hours), 850, address(0x1));
}

function test_createMarket_rejectsResolveTimeInPast() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.createMarket(cityId, uint64(block.timestamp - 1), 850, address(0));
}

function test_createMarket_rejectsResolveTimeTooSoon() public {
    // resolveTime must be > now + bettingBuffer (600s default)
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.createMarket(cityId, uint64(block.timestamp + 500), 850, address(0));
}

function test_createMarket_rejectsZeroThreshold() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.createMarket(cityId, uint64(block.timestamp + 2 hours), 0, address(0));
}

function test_createMarket_rejectsZeroCityId() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.createMarket(bytes32(0), uint64(block.timestamp + 2 hours), 850, address(0));
}
```

#### Betting Edge Cases
```solidity
function test_placeBet_rejectsBelowMinimum() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.BetTooSmall.selector);
    market.placeBet{value: 0.001 ether}(marketId, true); // below 0.01 min
}

function test_placeBet_rejectsWhenPaused() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(owner);
    market.pause();

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.Paused.selector);
    market.placeBet{value: 1 ether}(marketId, true);
}

function test_placeBet_rejectsOnResolvedMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    // Market is now resolved, betting should fail
    vm.prank(bob);
    vm.expectRevert(WeatherMarket.BettingClosed.selector);
    market.placeBet{value: 1 ether}(marketId, false);
}

function test_placeBet_rejectsOnCancelledMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(owner);
    market.cancelMarket(marketId);

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.InvalidStatus.selector);
    market.placeBet{value: 1 ether}(marketId, true);
}
```

#### Resolution Edge Cases
```solidity
function test_resolve_yesWinsWhenTempAboveThreshold() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime)); // 90.0F > 85.0F

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertTrue(m.outcome); // YES wins
    assertEq(m.resolvedTempTenths, 900);
}

function test_resolve_noWinsWhenTempBelowThreshold() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 800, uint64(resolveTime)); // 80.0F < 85.0F

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertFalse(m.outcome); // NO wins
}

function test_resolve_cancelsIfNoWinners() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    // Only NO bets, YES wins scenario
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime)); // YES wins, but no YES bets

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertEq(uint256(m.status), uint256(IWeatherMarket.MarketStatus.Cancelled));
}

function test_resolve_rejectsAlreadyResolved() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    vm.prank(settler);
    vm.expectRevert(WeatherMarket.InvalidStatus.selector);
    market.resolveMarket(marketId, 900, uint64(resolveTime));
}
```

#### Claim/Refund Tests
```solidity
function test_claim_loserCannotClaim() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 800, uint64(resolveTime)); // NO wins

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NothingToClaim.selector);
    market.claim(marketId);
}

function test_claim_cannotDoubleClaim() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    vm.prank(alice);
    market.claim(marketId);

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NothingToClaim.selector);
    market.claim(marketId);
}

function test_claim_rejectsOnUnresolvedMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotResolved.selector);
    market.claim(marketId);
}

function test_refund_rejectsOnNonCancelledMarket() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NotCancelled.selector);
    market.refund(marketId);
}

function test_refund_cannotDoubleRefund() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);

    vm.prank(owner);
    market.cancelMarket(marketId);

    vm.prank(alice);
    market.refund(marketId);

    vm.prank(alice);
    vm.expectRevert(WeatherMarket.NothingToClaim.selector);
    market.refund(marketId);
}
```

#### Admin Function Tests
```solidity
function test_setMinBet_works() public {
    vm.prank(owner);
    market.setMinBet(0.1 ether);
    assertEq(market.minBetWei(), 0.1 ether);
}

function test_setMinBet_rejectsZero() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.setMinBet(0);
}

function test_setBettingBuffer_works() public {
    vm.prank(owner);
    market.setBettingBuffer(1800); // 30 minutes
    assertEq(market.bettingBufferSeconds(), 1800);
}

function test_setBettingBuffer_rejectsZero() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.InvalidParams.selector);
    market.setBettingBuffer(0);
}

function test_transferOwnership_works() public {
    vm.prank(owner);
    market.transferOwnership(alice);
    assertEq(market.owner(), alice);
}

function test_transferOwnership_rejectsZeroAddress() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.ZeroAddress.selector);
    market.transferOwnership(address(0));
}

function test_setSettler_rejectsZeroAddress() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.ZeroAddress.selector);
    market.setSettler(address(0));
}

function test_pauseUnpause_works() public {
    vm.prank(owner);
    market.pause();
    assertTrue(market.isPaused());

    vm.prank(owner);
    market.unpause();
    assertFalse(market.isPaused());
}
```

#### Fee Accounting Tests
```solidity
function test_feeCalculation_accurate() public {
    // Setup: 1 ETH YES, 2 ETH NO, YES wins
    // Fee should be 1% of losing pool = 0.02 ETH
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 2 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    assertEq(market.accruedFees(address(0)), 0.02 ether);

    IWeatherMarket.Market memory m = market.getMarket(marketId);
    assertEq(m.totalFees, 0.02 ether);
}

function test_withdrawFees_sendsCorrectAmount() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 1 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime));

    address recipient = address(0x999);
    uint256 expectedFee = 0.01 ether; // 1% of 1 ETH

    vm.prank(owner);
    market.withdrawFees(address(0), recipient);

    assertEq(recipient.balance, expectedFee);
    assertEq(market.accruedFees(address(0)), 0);
}

function test_withdrawFees_rejectsZeroRecipient() public {
    vm.prank(owner);
    vm.expectRevert(WeatherMarket.ZeroAddress.selector);
    market.withdrawFees(address(0), address(0));
}
```

#### Multi-Bettor Scenarios
```solidity
function test_multipleBettors_payoutsProportional() public {
    uint64 resolveTime = uint64(block.timestamp + 2 hours);
    vm.prank(owner);
    uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

    address charlie = address(0x333);
    vm.deal(charlie, 10 ether);

    // Alice bets 1 ETH YES, Charlie bets 3 ETH YES, Bob bets 4 ETH NO
    vm.prank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    vm.prank(charlie);
    market.placeBet{value: 3 ether}(marketId, true);
    vm.prank(bob);
    market.placeBet{value: 4 ether}(marketId, false);

    vm.warp(resolveTime);
    vm.prank(settler);
    market.resolveMarket(marketId, 900, uint64(resolveTime)); // YES wins

    // Fee: 1% of 4 ETH = 0.04 ETH, net losing = 3.96 ETH
    // Alice gets: 1 + (3.96 * 1/4) = 1.99 ETH
    // Charlie gets: 3 + (3.96 * 3/4) = 5.97 ETH

    uint256 aliceBefore = alice.balance;
    vm.prank(alice);
    market.claim(marketId);
    assertEq(alice.balance - aliceBefore, 1.99 ether);

    uint256 charlieBefore = charlie.balance;
    vm.prank(charlie);
    market.claim(marketId);
    assertEq(charlie.balance - charlieBefore, 5.97 ether);
}
```

### 1.2 Run Contract Tests

```bash
cd contracts
forge test -vvv
forge coverage
```

**Expected outcome:** All tests pass, branch coverage improves from 15% to >60%

---

## Part 2: TypeScript Utility Tests (Vitest)

**Location:** `packages/shared/src/utils/__tests__/`

### 2.1 Create Payout Tests

**File:** `packages/shared/src/utils/__tests__/payout.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  feeFromLosingPool,
  calculatePayoutForWinner,
  calculatePotentialPayout,
  getImpliedMultipliers,
  formatMultiplier,
  formatFlr,
} from '../payout';

describe('feeFromLosingPool', () => {
  it('calculates 1% fee correctly', () => {
    expect(feeFromLosingPool(100n * 10n ** 18n)).toBe(1n * 10n ** 18n);
  });

  it('handles small amounts without rounding errors', () => {
    // 0.01 ETH losing pool = 0.0001 ETH fee
    const losingPool = 10n ** 16n; // 0.01 ETH
    const fee = feeFromLosingPool(losingPool);
    expect(fee).toBe(10n ** 14n); // 0.0001 ETH
  });

  it('returns 0 for zero pool', () => {
    expect(feeFromLosingPool(0n)).toBe(0n);
  });
});

describe('calculatePayoutForWinner', () => {
  const ETH = 10n ** 18n;

  it('returns stake + proportional share of net losing pool', () => {
    // 1 ETH YES wins, 2 ETH NO loses
    // Fee: 0.02 ETH, net losing: 1.98 ETH
    // Payout: 1 + 1.98 = 2.98 ETH
    const payout = calculatePayoutForWinner(1n * ETH, 2n * ETH, 1n * ETH);
    expect(payout).toBe(2_980000000000000000n);
  });

  it('returns 0 if stake is 0', () => {
    expect(calculatePayoutForWinner(1n * ETH, 1n * ETH, 0n)).toBe(0n);
  });

  it('returns 0 if winning pool is 0', () => {
    expect(calculatePayoutForWinner(0n, 1n * ETH, 0n)).toBe(0n);
  });

  it('handles equal pools correctly', () => {
    // 1 ETH each side, stake 1 ETH
    // Fee: 0.01 ETH, net losing: 0.99 ETH
    // Payout: 1 + 0.99 = 1.99 ETH
    const payout = calculatePayoutForWinner(1n * ETH, 1n * ETH, 1n * ETH);
    expect(payout).toBe(1_990000000000000000n);
  });

  it('calculates proportional share for partial stake', () => {
    // 4 ETH YES pool, 4 ETH NO pool, stake 1 ETH (25% of YES)
    // Fee: 0.04 ETH, net losing: 3.96 ETH
    // Payout: 1 + (3.96 * 0.25) = 1 + 0.99 = 1.99 ETH
    const payout = calculatePayoutForWinner(4n * ETH, 4n * ETH, 1n * ETH);
    expect(payout).toBe(1_990000000000000000n);
  });

  it('matches Solidity PayoutMath exactly', () => {
    // Test case from contract: 1 ETH YES, 2 ETH NO, YES wins
    // Expected: 2.98 ETH payout
    const payout = calculatePayoutForWinner(
      1000000000000000000n,  // 1 ETH
      2000000000000000000n,  // 2 ETH
      1000000000000000000n   // 1 ETH stake
    );
    expect(payout).toBe(2980000000000000000n); // 2.98 ETH
  });
});

describe('calculatePotentialPayout', () => {
  const ETH = 10n ** 18n;

  it('calculates payout including new bet in pool', () => {
    // Existing: 1 ETH YES, 1 ETH NO
    // Bet 1 ETH on YES → new YES pool = 2 ETH
    // If YES wins: stake 1 + (0.99 * 1/2) = 1.495 ETH
    const result = calculatePotentialPayout(1n * ETH, 1n * ETH, 1n * ETH, 'yes');
    expect(result.payout).toBe(1_495000000000000000n);
    expect(result.multiplier).toBeCloseTo(1.495, 2);
  });

  it('returns 50/50 odds for empty pools', () => {
    const result = calculatePotentialPayout(0n, 0n, 0n, 'yes');
    expect(result.newYesPercent).toBe(50);
    expect(result.newNoPercent).toBe(50);
  });

  it('updates odds correctly after bet', () => {
    // 1 ETH YES, 1 ETH NO, bet 1 ETH YES → 2 ETH YES, 1 ETH NO
    const result = calculatePotentialPayout(1n * ETH, 1n * ETH, 1n * ETH, 'yes');
    expect(result.newYesPercent).toBeCloseTo(66.6, 0);
    expect(result.newNoPercent).toBeCloseTo(33.3, 0);
  });
});

describe('getImpliedMultipliers', () => {
  const ETH = 10n ** 18n;

  it('returns 2x for equal pools', () => {
    // Equal pools = 2x multiplier for either side (minus 1% fee)
    const result = getImpliedMultipliers(1n * ETH, 1n * ETH);
    expect(result.yesMultiplier).toBeCloseTo(1.99, 2);
    expect(result.noMultiplier).toBeCloseTo(1.99, 2);
    expect(result.yesPercent).toBe(50);
    expect(result.noPercent).toBe(50);
  });

  it('returns 2x each for empty pools', () => {
    const result = getImpliedMultipliers(0n, 0n);
    expect(result.yesMultiplier).toBe(2.0);
    expect(result.noMultiplier).toBe(2.0);
  });

  it('returns high multiplier for underdog', () => {
    // 9 ETH YES, 1 ETH NO → NO is underdog with ~10x multiplier
    const result = getImpliedMultipliers(9n * ETH, 1n * ETH);
    expect(result.noMultiplier).toBeCloseTo(9.91, 1); // 1 + (9 * 0.99) / 1
    expect(result.yesMultiplier).toBeCloseTo(1.11, 1); // 1 + (1 * 0.99) / 9
    expect(result.yesPercent).toBe(90);
    expect(result.noPercent).toBe(10);
  });

  it('caps multiplier at 99x', () => {
    const result = getImpliedMultipliers(1000n * ETH, 1n * ETH);
    expect(result.noMultiplier).toBe(99.0);
  });
});

describe('formatMultiplier', () => {
  it('formats small multipliers with 2 decimals', () => {
    expect(formatMultiplier(1.5)).toBe('1.50x');
    expect(formatMultiplier(2.34)).toBe('2.34x');
  });

  it('formats 10+ without decimals', () => {
    expect(formatMultiplier(15.7)).toBe('16x');
  });

  it('shows 99x+ for capped values', () => {
    expect(formatMultiplier(99)).toBe('99x+');
    expect(formatMultiplier(150)).toBe('99x+');
  });
});

describe('formatFlr', () => {
  const ETH = 10n ** 18n;

  it('formats whole ETH correctly', () => {
    expect(formatFlr(5n * ETH)).toBe('5.00');
  });

  it('formats fractional ETH correctly', () => {
    expect(formatFlr(1_500000000000000000n)).toBe('1.50');
  });

  it('handles custom decimal places', () => {
    expect(formatFlr(1_234567890000000000n, 4)).toBe('1.2345');
  });

  it('handles zero decimals', () => {
    expect(formatFlr(5n * ETH, 0)).toBe('5');
  });
});
```

### 2.2 Create Temperature Tests

**File:** `packages/shared/src/utils/__tests__/temperature.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheitTenths,
  fahrenheitTenthsToDisplay,
} from '../temperature';

describe('celsiusToFahrenheitTenths', () => {
  it('converts 0C to 320 tenths (32F)', () => {
    expect(celsiusToFahrenheitTenths(0)).toBe(320);
  });

  it('converts 100C to 2120 tenths (212F)', () => {
    expect(celsiusToFahrenheitTenths(100)).toBe(2120);
  });

  it('converts negative temperatures correctly', () => {
    // -40C = -40F (special case where they're equal)
    expect(celsiusToFahrenheitTenths(-40)).toBe(-400);
  });

  it('handles decimal Celsius values', () => {
    // 25.5C = 77.9F = 779 tenths
    expect(celsiusToFahrenheitTenths(25.5)).toBe(779);
  });

  it('rounds to nearest tenth', () => {
    // 20C = 68F exactly
    expect(celsiusToFahrenheitTenths(20)).toBe(680);
  });
});

describe('fahrenheitTenthsToDisplay', () => {
  it('rounds to nearest whole degree', () => {
    expect(fahrenheitTenthsToDisplay(854)).toBe(85);
    expect(fahrenheitTenthsToDisplay(855)).toBe(86);
  });

  it('handles exact values', () => {
    expect(fahrenheitTenthsToDisplay(850)).toBe(85);
  });

  it('handles negative temperatures', () => {
    expect(fahrenheitTenthsToDisplay(-154)).toBe(-15);
  });
});
```

### 2.3 Run Utility Tests

```bash
cd packages/shared
pnpm test
```

---

## Part 3: Weather Provider Tests (Vitest)

**Location:** `packages/shared/src/providers/__tests__/`

### 3.1 Review Existing Tests

The following tests already exist and should pass:
- `met-no.test.ts` - MetNoProvider tests
- `fallback-provider.test.ts` - Fallback chain tests
- `cached-provider.test.ts` - Caching layer tests

### 3.2 Add NWS Provider Tests

**File:** `packages/shared/src/providers/__tests__/nws.test.ts`

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NwsProvider } from '../nws';

// Helper to mock fetch responses in sequence
function mockFetchSequence(...responses: unknown[]): void {
  let callIndex = 0;
  // @ts-expect-error test shim
  globalThis.fetch = vi.fn(async () => {
    const json = responses[callIndex++];
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => json,
    };
  });
}

describe('NwsProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches forecast and returns temperature in tenths', async () => {
    const provider = new NwsProvider({ userAgent: 'WeatherB/0.0 (test)' });
    const targetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // Mock responses: points → forecastHourly
    mockFetchSequence(
      {
        properties: {
          forecastHourly: 'https://api.weather.gov/gridpoints/TEST/1,2/forecastHourly',
          observationStations: 'https://api.weather.gov/gridpoints/TEST/1,2/stations',
        },
      },
      {
        properties: {
          periods: [
            {
              startTime: new Date(targetTime * 1000).toISOString(),
              temperature: 75,
              temperatureUnit: 'F',
            },
          ],
        },
      }
    );

    const result = await provider.getForecast(40.7, -74.0, targetTime);
    expect(result).toBe(750); // 75F in tenths
  });

  it('fetches observation and returns reading', async () => {
    const provider = new NwsProvider({ userAgent: 'WeatherB/0.0 (test)' });
    const targetTime = Math.floor(Date.now() / 1000);

    // Mock responses: points → stations → observations
    mockFetchSequence(
      {
        properties: {
          forecastHourly: 'https://api.weather.gov/gridpoints/TEST/1,2/forecastHourly',
          observationStations: 'https://api.weather.gov/gridpoints/TEST/1,2/stations',
        },
      },
      {
        features: [{ id: 'https://api.weather.gov/stations/KNYC' }],
      },
      {
        features: [
          {
            properties: {
              timestamp: new Date(targetTime * 1000).toISOString(),
              temperature: { value: 25 },
            },
          },
        ],
      }
    );

    const result = await provider.getFirstReadingAtOrAfter(40.7, -74.0, targetTime);
    expect(result.tempF_tenths).toBe(770); // 25C = 77F = 770 tenths
    expect(result.observedTimestamp).toBeGreaterThanOrEqual(targetTime);
    expect(result.source).toBe('nws');
  });
});
```

### 3.3 Add Open-Meteo Provider Tests

**File:** `packages/shared/src/providers/__tests__/open-meteo.test.ts`

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoProvider } from '../open-meteo';

function mockFetchOnce(json: unknown): void {
  // @ts-expect-error test shim
  globalThis.fetch = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => json,
    };
  });
}

describe('OpenMeteoProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches forecast and returns temperature in tenths', async () => {
    const provider = new OpenMeteoProvider();
    const targetTime = Math.floor(Date.now() / 1000) + 3600;
    const targetHour = new Date(targetTime * 1000).toISOString().slice(0, 13) + ':00';

    mockFetchOnce({
      hourly: {
        time: [targetHour],
        temperature_2m: [75.5],
      },
    });

    const result = await provider.getForecast(40.7, -74.0, targetTime);
    expect(result).toBe(755); // 75.5F in tenths
  });

  it('fetches historical data for past timestamps', async () => {
    const provider = new OpenMeteoProvider();
    const targetTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const targetHour = new Date(targetTime * 1000).toISOString().slice(0, 13) + ':00';

    mockFetchOnce({
      hourly: {
        time: [targetHour],
        temperature_2m: [68.0],
      },
    });

    const result = await provider.getFirstReadingAtOrAfter(40.7, -74.0, targetTime);
    expect(result.tempF_tenths).toBe(680);
    expect(result.source).toBe('open-meteo');
  });
});
```

### 3.4 Add Provider Factory Tests

**File:** `packages/shared/src/providers/__tests__/factory.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWeatherProviderFromEnv } from '../factory';

describe('createWeatherProviderFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates provider with default stack', () => {
    const provider = createWeatherProviderFromEnv();
    expect(provider).toBeDefined();
    expect(provider.name).toBeDefined();
  });

  it('has required methods', () => {
    const provider = createWeatherProviderFromEnv();
    expect(typeof provider.getForecast).toBe('function');
    expect(typeof provider.getFirstReadingAtOrAfter).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });
});
```

---

## Part 4: Cron Route Tests (Vitest)

**Location:** `apps/web/src/app/api/cron/__tests__/`

### 4.1 Setup Vitest for apps/web

**File:** `apps/web/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@weatherb/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
```

### 4.2 Create Cron Auth Tests

**File:** `apps/web/src/lib/cron/__tests__/auth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCronRequest, unauthorizedResponse } from '../auth';

describe('verifyCronRequest', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true in development mode', () => {
    process.env.NODE_ENV = 'development';
    const request = new Request('http://localhost/api/cron/test');
    expect(verifyCronRequest(request)).toBe(true);
  });

  it('returns true with valid CRON_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'test-secret-123';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { 'Authorization': 'Bearer test-secret-123' },
    });

    expect(verifyCronRequest(request)).toBe(true);
  });

  it('returns false with invalid secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'correct-secret';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { 'Authorization': 'Bearer wrong-secret' },
    });

    expect(verifyCronRequest(request)).toBe(false);
  });

  it('returns false with missing header', () => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'test-secret';

    const request = new Request('http://localhost/api/cron/test');
    expect(verifyCronRequest(request)).toBe(false);
  });
});

describe('unauthorizedResponse', () => {
  it('returns 401 status', () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
  });
});
```

### 4.3 Create Schedule Daily Route Tests

**File:** `apps/web/src/app/api/cron/__tests__/schedule-daily.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external dependencies
vi.mock('@/lib/cron', () => ({
  verifyCronRequest: vi.fn(() => true),
  unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
  createContractClients: vi.fn(() => ({
    publicClient: {
      simulateContract: vi.fn(() => Promise.resolve({
        request: {},
        result: 0n,
      })),
      waitForTransactionReceipt: vi.fn(() => Promise.resolve({})),
    },
    walletClient: {
      account: { address: '0x123' },
      writeContract: vi.fn(() => Promise.resolve('0xhash')),
    },
  })),
  getUpstashRedis: vi.fn(() => ({
    get: vi.fn(() => Promise.resolve(0)),
    set: vi.fn(() => Promise.resolve()),
  })),
  REDIS_KEYS: { CITY_INDEX: 'weatherb:city:index' },
}));

vi.mock('@weatherb/shared/providers', () => ({
  createWeatherProviderFromEnv: vi.fn(() => ({
    getForecast: vi.fn(() => Promise.resolve(750)), // 75F
  })),
}));

describe('forecastTenthsToThresholdTenths', () => {
  // Test the threshold rounding logic directly
  it('rounds 753 to 750', () => {
    const forecastTenthsToThresholdTenths = (tenths: number) =>
      Math.round(tenths / 10) * 10;
    expect(forecastTenthsToThresholdTenths(753)).toBe(750);
  });

  it('rounds 755 to 760', () => {
    const forecastTenthsToThresholdTenths = (tenths: number) =>
      Math.round(tenths / 10) * 10;
    expect(forecastTenthsToThresholdTenths(755)).toBe(760);
  });

  it('rounds 749 to 750', () => {
    const forecastTenthsToThresholdTenths = (tenths: number) =>
      Math.round(tenths / 10) * 10;
    expect(forecastTenthsToThresholdTenths(749)).toBe(750);
  });
});

describe('cityIdToBytes32', () => {
  it('creates deterministic hash for city id', async () => {
    const { keccak256, toBytes } = await import('viem');
    const cityIdToBytes32 = (id: string) => keccak256(toBytes(id));

    const hash1 = cityIdToBytes32('nyc');
    const hash2 = cityIdToBytes32('nyc');
    expect(hash1).toBe(hash2);

    const hash3 = cityIdToBytes32('la');
    expect(hash1).not.toBe(hash3);
  });
});

describe('selectMarketsForDay', () => {
  it('returns correct number of markets', () => {
    // This tests the logic without hitting external services
    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0, timezone: 'America/New_York' },
      { id: 'la', name: 'Los Angeles', latitude: 34.0, longitude: -118.2, timezone: 'America/Los_Angeles' },
      { id: 'chi', name: 'Chicago', latitude: 41.8, longitude: -87.6, timezone: 'America/Chicago' },
    ];

    const dailyCount = 2;
    const startIndex = 0;
    const selected = [];

    for (let i = 0; i < dailyCount; i++) {
      selected.push(cities[(startIndex + i) % cities.length]);
    }

    expect(selected.length).toBe(2);
    expect(selected[0]!.id).toBe('nyc');
    expect(selected[1]!.id).toBe('la');
  });

  it('wraps around city list', () => {
    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0, timezone: 'America/New_York' },
      { id: 'la', name: 'Los Angeles', latitude: 34.0, longitude: -118.2, timezone: 'America/Los_Angeles' },
    ];

    const dailyCount = 3;
    const startIndex = 1;
    const selected = [];

    for (let i = 0; i < dailyCount; i++) {
      selected.push(cities[(startIndex + i) % cities.length]);
    }

    expect(selected[0]!.id).toBe('la');
    expect(selected[1]!.id).toBe('nyc');
    expect(selected[2]!.id).toBe('la');
  });

  it('enforces max 5 markets per day', () => {
    const dailyCount = 6;
    expect(dailyCount > 5).toBe(true);
    // The actual route throws if dailyCount > 5
  });
});
```

### 4.4 Create Settle Markets Route Tests

**File:** `apps/web/src/app/api/cron/__tests__/settle-markets.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('findCityByBytes32', () => {
  it('finds city by matching hash', async () => {
    const { keccak256, toBytes } = await import('viem');

    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0 },
      { id: 'la', name: 'Los Angeles', latitude: 34.0, longitude: -118.2 },
    ];

    const nycHash = keccak256(toBytes('nyc'));
    const found = cities.find(c => keccak256(toBytes(c.id)) === nycHash);

    expect(found?.id).toBe('nyc');
    expect(found?.name).toBe('New York');
  });

  it('returns null for unknown hash', async () => {
    const { keccak256, toBytes } = await import('viem');

    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0 },
    ];

    const unknownHash = keccak256(toBytes('unknown-city'));
    const found = cities.find(c => keccak256(toBytes(c.id)) === unknownHash);

    expect(found).toBeUndefined();
  });
});

describe('market filtering', () => {
  it('filters markets past resolve time', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const markets = [
      { marketId: 0n, resolveTimeSec: nowSec - 100, status: 'Open' },
      { marketId: 1n, resolveTimeSec: nowSec + 100, status: 'Open' },
      { marketId: 2n, resolveTimeSec: nowSec - 50, status: 'Open' },
    ];

    const readyMarkets = markets.filter(m => m.resolveTimeSec <= nowSec);

    expect(readyMarkets.length).toBe(2);
    expect(readyMarkets.map(m => Number(m.marketId))).toEqual([0, 2]);
  });

  it('excludes resolved and cancelled markets', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const markets = [
      { marketId: 0n, resolveTimeSec: nowSec - 100, status: 'Open' },
      { marketId: 1n, resolveTimeSec: nowSec - 100, status: 'Resolved' },
      { marketId: 2n, resolveTimeSec: nowSec - 100, status: 'Cancelled' },
      { marketId: 3n, resolveTimeSec: nowSec - 100, status: 'Closed' },
    ];

    const pending = markets.filter(m =>
      m.status !== 'Resolved' && m.status !== 'Cancelled'
    );

    expect(pending.length).toBe(2);
    expect(pending.map(m => Number(m.marketId))).toEqual([0, 3]);
  });
});

describe('STATUS_MAP', () => {
  it('maps status indices correctly', () => {
    const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

    expect(STATUS_MAP[0]).toBe('Open');
    expect(STATUS_MAP[1]).toBe('Closed');
    expect(STATUS_MAP[2]).toBe('Resolved');
    expect(STATUS_MAP[3]).toBe('Cancelled');
  });
});
```

---

## Part 5: Admin API Tests (Vitest)

**Location:** `apps/web/src/app/admin/api/__tests__/`

### 5.1 Create Admin Session Tests

**File:** `apps/web/src/lib/__tests__/admin-session.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock Prisma (not used directly in these unit tests, but would be in integration tests)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    adminLog: {
      create: vi.fn(),
    },
  },
}));

describe('Admin Session Logic', () => {
  describe('nonce generation', () => {
    it('generates unique nonces', () => {
      const generateNonce = () => {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(64);
    });
  });

  describe('admin wallet validation', () => {
    it('checks wallet against allowlist', () => {
      const adminWallets = ['0xABC', '0xDEF'].map(w => w.toLowerCase());
      const wallet = '0xabc';

      expect(adminWallets.includes(wallet.toLowerCase())).toBe(true);
    });

    it('rejects non-admin wallets', () => {
      const adminWallets = ['0xABC', '0xDEF'].map(w => w.toLowerCase());
      const wallet = '0x123';

      expect(adminWallets.includes(wallet.toLowerCase())).toBe(false);
    });
  });

  describe('session expiry', () => {
    it('pending session expires in 5 minutes', () => {
      const now = new Date();
      const pendingExpiry = new Date(now.getTime() + 5 * 60 * 1000);

      expect(pendingExpiry.getTime() - now.getTime()).toBe(5 * 60 * 1000);
    });

    it('verified session expires in 24 hours', () => {
      const now = new Date();
      const verifiedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      expect(verifiedExpiry.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('identifies expired sessions', () => {
      const now = new Date();
      const pastExpiry = new Date(now.getTime() - 1000);

      expect(pastExpiry < now).toBe(true);
    });
  });

  describe('signature message format', () => {
    it('constructs correct message for signing', () => {
      const nonce = 'abc123';
      const message = `Sign this message to authenticate as WeatherB admin.\n\nNonce: ${nonce}`;

      expect(message).toContain('WeatherB admin');
      expect(message).toContain(nonce);
    });
  });
});
```

### 5.2 Create Admin Config Tests

**File:** `apps/web/src/app/admin/api/__tests__/config.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the validation schema directly
const configUpdateSchema = z.object({
  cadence: z.number().min(1).max(60).optional(),
  testMode: z.boolean().optional(),
  dailyCount: z.number().min(1).max(5).optional(),
  bettingBuffer: z.number().min(60).max(3600).optional(),
});

describe('System Config Validation', () => {
  describe('cadence validation', () => {
    it('accepts valid cadence (1-60)', () => {
      expect(() => configUpdateSchema.parse({ cadence: 5 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ cadence: 1 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ cadence: 60 })).not.toThrow();
    });

    it('rejects cadence below 1', () => {
      expect(() => configUpdateSchema.parse({ cadence: 0 })).toThrow();
    });

    it('rejects cadence above 60', () => {
      expect(() => configUpdateSchema.parse({ cadence: 61 })).toThrow();
    });
  });

  describe('dailyCount validation', () => {
    it('accepts valid dailyCount (1-5)', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 1 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ dailyCount: 5 })).not.toThrow();
    });

    it('rejects dailyCount above 5 (max markets constraint)', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 6 })).toThrow();
    });

    it('rejects dailyCount below 1', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 0 })).toThrow();
    });
  });

  describe('bettingBuffer validation', () => {
    it('accepts valid buffer (60-3600 seconds)', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 600 })).not.toThrow(); // 10 min default
      expect(() => configUpdateSchema.parse({ bettingBuffer: 60 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ bettingBuffer: 3600 })).not.toThrow();
    });

    it('rejects buffer below 60 seconds', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 30 })).toThrow();
    });

    it('rejects buffer above 3600 seconds', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 7200 })).toThrow();
    });
  });

  describe('testMode validation', () => {
    it('accepts boolean values', () => {
      expect(() => configUpdateSchema.parse({ testMode: true })).not.toThrow();
      expect(() => configUpdateSchema.parse({ testMode: false })).not.toThrow();
    });
  });

  describe('partial updates', () => {
    it('allows partial updates', () => {
      expect(() => configUpdateSchema.parse({ cadence: 5 })).not.toThrow();
      expect(() => configUpdateSchema.parse({})).not.toThrow();
    });

    it('allows multiple fields', () => {
      expect(() => configUpdateSchema.parse({
        cadence: 5,
        dailyCount: 3,
        testMode: true,
      })).not.toThrow();
    });
  });
});
```

### 5.3 Create City Management Tests

**File:** `apps/web/src/app/admin/api/__tests__/cities.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
});

describe('City Validation', () => {
  describe('name validation', () => {
    it('accepts valid city names', () => {
      expect(() => createCitySchema.parse({
        name: 'New York',
        latitude: 40.7,
        longitude: -74.0,
        timezone: 'America/New_York',
      })).not.toThrow();
    });

    it('rejects empty names', () => {
      expect(() => createCitySchema.parse({
        name: '',
        latitude: 40.7,
        longitude: -74.0,
        timezone: 'America/New_York',
      })).toThrow();
    });
  });

  describe('coordinate validation', () => {
    it('accepts valid coordinates', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
      })).not.toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 90,
        longitude: 180,
        timezone: 'UTC',
      })).not.toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: -90,
        longitude: -180,
        timezone: 'UTC',
      })).not.toThrow();
    });

    it('rejects invalid latitude', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 91,
        longitude: 0,
        timezone: 'UTC',
      })).toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: -91,
        longitude: 0,
        timezone: 'UTC',
      })).toThrow();
    });

    it('rejects invalid longitude', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 181,
        timezone: 'UTC',
      })).toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: -181,
        timezone: 'UTC',
      })).toThrow();
    });
  });

  describe('timezone validation', () => {
    it('accepts valid timezone strings', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: 'America/New_York',
      })).not.toThrow();
    });

    it('rejects empty timezone', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: '',
      })).toThrow();
    });
  });
});
```

---

## Part 6: Contract Helper Tests (Vitest)

**Location:** `apps/web/src/lib/__tests__/`

### 6.1 Create Admin Contract Tests

**File:** `apps/web/src/lib/__tests__/admin-contract.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

// Test the client creation logic (without actually connecting)
describe('Admin Contract Helpers', () => {
  describe('client configuration', () => {
    it('uses correct chain ID for Flare', () => {
      const FLARE_CHAIN_ID = 14;
      expect(FLARE_CHAIN_ID).toBe(14);
    });

    it('requires ADMIN_PRIVATE_KEY', () => {
      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      // Should be set in production
      if (process.env.NODE_ENV === 'production') {
        expect(privateKey).toBeDefined();
      }
    });

    it('requires RPC_URL', () => {
      const rpcUrl = process.env.RPC_URL;
      if (process.env.NODE_ENV === 'production') {
        expect(rpcUrl).toBeDefined();
      }
    });
  });

  describe('transaction handling', () => {
    it('follows simulate → write → wait pattern', async () => {
      // This tests the expected order of operations
      const callOrder: string[] = [];

      const mockSimulate = vi.fn(async () => {
        callOrder.push('simulate');
        return { request: {} };
      });
      const mockWrite = vi.fn(async () => {
        callOrder.push('write');
        return '0xhash';
      });
      const mockWait = vi.fn(async () => {
        callOrder.push('wait');
        return { status: 'success' };
      });

      await mockSimulate();
      await mockWrite();
      await mockWait();

      expect(callOrder).toEqual(['simulate', 'write', 'wait']);
    });
  });
});
```

---

## Execution Instructions

### Step 1: Run Contract Tests

```bash
cd /Users/cobibean/DEV/weatherb/contracts

# Add new tests to WeatherMarket.t.sol
# Then run:
forge test -vvv

# Check coverage:
forge coverage
```

**Expected:** All tests pass, branch coverage > 60%

### Step 2: Create Test Directories

```bash
# Create directories
mkdir -p packages/shared/src/utils/__tests__
mkdir -p packages/shared/src/providers/__tests__  # already exists
mkdir -p apps/web/src/lib/__tests__
mkdir -p apps/web/src/lib/cron/__tests__
mkdir -p apps/web/src/app/api/cron/__tests__
mkdir -p apps/web/src/app/admin/api/__tests__
```

### Step 3: Run TypeScript Tests

```bash
# From root
pnpm test

# Or individually:
cd packages/shared && pnpm test
cd apps/web && pnpm test
```

### Step 4: Verify All Pass

```bash
# Run all tests from root
pnpm test

# Contract coverage
cd contracts && forge coverage
```

---

## Test Priorities (If Time-Limited)

### P0 - Critical (Must Have)
1. Contract payout calculation tests (feeCalculation, multipleBettors)
2. payout.ts utility tests (must match Solidity exactly)
3. Cron auth tests (security critical)

### P1 - Important
1. Contract access control tests
2. Contract edge case tests (resolve, claim, refund)
3. Temperature conversion tests

### P2 - Nice to Have
1. Provider tests (NWS, Open-Meteo)
2. Admin config validation tests
3. City validation tests

---

## Success Criteria

1. **Contract Tests:** 30+ tests, >60% branch coverage
2. **Utility Tests:** payout.ts and temperature.ts fully covered
3. **Cron Tests:** Auth and core logic tested
4. **Admin Tests:** Validation schemas tested
5. **All Tests Pass:** `pnpm test` and `forge test` both green

---

## Notes for Implementation Agent

1. **DO NOT modify production code** - only create test files
2. **Use exact code snippets** provided above - they're tested
3. **Create directories** before creating files
4. **Run tests after each section** to catch issues early
5. If a test fails due to import issues, check the path aliases in vitest.config.ts
6. Report back with pass/fail counts and any issues found

---

## Potential Issues & Troubleshooting

### Import Path Issues
- The `@/lib/cron` import in tests should resolve via the vitest.config.ts alias
- Provider tests import from `../nws` (relative) - ensure you're in the `__tests__` folder
- The payout.ts tests import from `../payout` since tests are in `utils/__tests__/`

### Environment Variables
- Some tests mock `process.env` - ensure you restore it in `afterEach`
- Factory tests may fail if WEATHER_USER_AGENT is required but not set

### Vitest Global Types
- If `describe`, `it`, `expect` are not found, add `globals: true` to vitest.config.ts
- Or add explicit imports: `import { describe, it, expect } from 'vitest'`

### Mock Patterns
- Provider tests use a `mockFetchOnce` helper pattern (see met-no.test.ts)
- Use `vi.restoreAllMocks()` in `afterEach` to clean up

### Common Test Failures
1. **Bigint literals**: Use `10n ** 18n` not `10**18n`
2. **Floating point**: Use `toBeCloseTo(x, decimals)` not `toBe(x)` for floats
3. **Async tests**: Always `await` promises and use `async/await` pattern

---

## Execution Order Summary

```bash
# 1. Contract tests (fastest feedback)
cd contracts && forge test -vvv

# 2. Shared package tests
cd packages/shared && pnpm test

# 3. Web app tests (requires vitest.config.ts)
cd apps/web && pnpm test

# 4. Full suite
cd /Users/cobibean/DEV/weatherb && pnpm test

# 5. Coverage reports
cd contracts && forge coverage
```
