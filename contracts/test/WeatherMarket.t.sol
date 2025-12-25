// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {WeatherMarket} from "../src/WeatherMarket.sol";
import {IWeatherMarket} from "../src/interfaces/IWeatherMarket.sol";
import {PayoutMath} from "../src/libraries/PayoutMath.sol";

contract WeatherMarketTest is Test {
    WeatherMarket internal market;

    address internal owner = address(0xA11CE);
    address internal settler = address(0xB0B);
    address internal alice = address(0x111);
    address internal bob = address(0x222);

    bytes32 internal cityId = keccak256("nyc");

    function setUp() public {
        vm.prank(owner);
        market = new WeatherMarket();

        vm.prank(owner);
        market.setSettler(settler);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_oneBetPerWalletEnforced() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 853, address(0));

        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(marketId, true);

        vm.prank(alice);
        vm.expectRevert(WeatherMarket.AlreadyBet.selector);
        market.placeBet{value: 0.01 ether}(marketId, false);
    }

    function test_bettingClosesAtDeadline() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 853, address(0));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        vm.warp(m.bettingDeadline);

        vm.prank(alice);
        vm.expectRevert(WeatherMarket.BettingClosed.selector);
        market.placeBet{value: 0.01 ether}(marketId, true);
    }

    function test_resolveAndClaimWithFee() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 2 ether}(marketId, false);

        vm.warp(resolveTime);

        // Settler submits temperature directly (no FDC proof)
        // temp 900 = 90.0°F, threshold 850 = 85.0°F → YES wins
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);
        uint256 aliceAfter = alice.balance;

        // YES wins: winningPool=1, losingPool=2, fee=0.02, net losing=1.98 => payout=1 + 1.98 = 2.98
        assertEq(aliceAfter - aliceBefore, 2.98 ether);

        // Fees accrued
        assertEq(market.accruedFees(address(0)), 0.02 ether);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        market.withdrawFees(address(0), owner);
        assertEq(owner.balance - ownerBefore, 0.02 ether);
    }

    function test_nonSettlerCannotResolve() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);

        // Random user cannot resolve
        vm.prank(alice);
        vm.expectRevert(WeatherMarket.NotSettler.selector);
        market.resolveMarket(marketId, 900, uint64(resolveTime));
    }

    function test_cannotResolveWithEarlyTimestamp() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.warp(resolveTime);

        // Observation timestamp before resolve time should fail
        vm.prank(settler);
        vm.expectRevert(WeatherMarket.TooEarly.selector);
        market.resolveMarket(marketId, 900, uint64(resolveTime - 1));
    }

    function test_thresholdTie_yesWins() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);

        // temp == threshold → YES wins (per spec: temp >= threshold)
        vm.prank(settler);
        market.resolveMarket(marketId, 850, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertTrue(m.outcome); // YES wins
    }

    function test_getMarketCountIncrements() public {
        assertEq(market.getMarketCount(), 0);
        vm.prank(owner);
        market.createMarket(cityId, uint64(block.timestamp + 2 hours), 853, address(0));
        assertEq(market.getMarketCount(), 1);
    }

    function test_cancelMarketBySettlerAfterResolveTime() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.warp(resolveTime);
        vm.prank(settler);
        market.cancelMarketBySettler(marketId);

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.status), uint256(IWeatherMarket.MarketStatus.Cancelled));
    }

    function test_refundAfterCancel() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.prank(owner);
        market.cancelMarket(marketId);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.refund(marketId);
        assertEq(alice.balance - aliceBefore, 1 ether);
    }

    function testFuzz_PayoutMathNoOverflow(uint128 yesPool, uint128 noPool, uint128 stake) public pure {
        vm.assume(yesPool > 0);
        vm.assume(noPool > 0);
        vm.assume(stake > 0 && stake <= yesPool);

        (uint256 payout, uint256 fee) = PayoutMath.payoutForWinner(uint256(yesPool), uint256(noPool), uint256(stake));

        assertGe(payout, uint256(stake));
        assertEq(fee, (uint256(noPool) * 100) / 10_000);
    }

    // ========== Access Control Tests ==========

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

    // ========== Market Creation Validation Tests ==========

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

    // ========== Betting Edge Cases ==========

    function test_placeBet_rejectsBelowMinimum() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        vm.expectRevert(WeatherMarket.BetTooSmall.selector);
        market.placeBet{value: 0.001 ether}(marketId, true);
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

    // ========== Resolution Edge Cases ==========

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
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertTrue(m.outcome);
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
        market.resolveMarket(marketId, 800, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertFalse(m.outcome);
    }

    function test_resolve_cancelsIfNoWinners() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

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

    // ========== Claim/Refund Tests ==========

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
        market.resolveMarket(marketId, 800, uint64(resolveTime));

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

    // ========== Admin Function Tests ==========

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
        market.setBettingBuffer(1800);
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

    // ========== Fee Accounting Tests ==========

    function test_feeCalculation_accurate() public {
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
        uint256 expectedFee = 0.01 ether;

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

    // ========== Multi-Bettor Scenarios ==========

    function test_multipleBettors_payoutsProportional() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        address charlie = address(0x333);
        vm.deal(charlie, 10 ether);

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(charlie);
        market.placeBet{value: 3 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 4 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);
        assertEq(alice.balance - aliceBefore, 1.99 ether);

        uint256 charlieBefore = charlie.balance;
        vm.prank(charlie);
        market.claim(marketId);
        assertEq(charlie.balance - charlieBefore, 5.97 ether);
    }

    // ========== Additional Edge Cases for Branch Coverage ==========

    function test_resolve_cancelsWhenOnlyYesBets() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.warp(resolveTime);
        vm.prank(settler);
        // NO wins (temp below threshold), but no NO bets → market cancelled
        market.resolveMarket(marketId, 800, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.status), uint256(IWeatherMarket.MarketStatus.Cancelled));
    }

    function test_resolve_withNoBets() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.warp(resolveTime);
        vm.prank(settler);
        // No bets at all → should cancel
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.status), uint256(IWeatherMarket.MarketStatus.Cancelled));
    }

    function test_getMarket_invalidMarketId() public {
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.getMarket(999);
    }

    function test_getPosition_invalidMarketId() public {
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.getPosition(999, alice);
    }

    function test_placeBet_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.placeBet{value: 1 ether}(999, true);
    }

    function test_claim_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.claim(999);
    }

    function test_refund_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.refund(999);
    }

    function test_resolveMarket_invalidMarketId() public {
        vm.prank(settler);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.resolveMarket(999, 900, uint64(block.timestamp));
    }

    function test_cancelMarket_invalidMarketId() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.cancelMarket(999);
    }

    function test_cancelMarketBySettler_invalidMarketId() public {
        vm.prank(settler);
        vm.expectRevert(WeatherMarket.InvalidMarket.selector);
        market.cancelMarketBySettler(999);
    }

    function test_cancelMarketBySettler_beforeResolveTime() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        // Settler cannot cancel before resolve time
        vm.prank(settler);
        vm.expectRevert(WeatherMarket.TooEarly.selector);
        market.cancelMarketBySettler(marketId);
    }

    function test_cancelMarketBySettler_onlySettler() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.warp(resolveTime);
        vm.prank(alice);
        vm.expectRevert(WeatherMarket.NotSettler.selector);
        market.cancelMarketBySettler(marketId);
    }

    function test_cancelMarket_alreadyCancelled() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(owner);
        market.cancelMarket(marketId);

        vm.prank(owner);
        vm.expectRevert(WeatherMarket.InvalidStatus.selector);
        market.cancelMarket(marketId);
    }

    function test_unpause_onlyOwner() public {
        vm.prank(owner);
        market.pause();

        vm.prank(alice);
        vm.expectRevert(WeatherMarket.NotOwner.selector);
        market.unpause();
    }

    // ========== PayoutMath Library Tests ==========

    function test_PayoutMath_impliedProbability() public pure {
        (uint256 yesBps, uint256 noBps) = PayoutMath.impliedProbabilityBps(1 ether, 1 ether);
        assertEq(yesBps, 5_000); // 50%
        assertEq(noBps, 5_000); // 50%
    }

    function test_PayoutMath_impliedProbability_emptyPools() public pure {
        (uint256 yesBps, uint256 noBps) = PayoutMath.impliedProbabilityBps(0, 0);
        assertEq(yesBps, 5_000); // Default 50%
        assertEq(noBps, 5_000); // Default 50%
    }

    function test_PayoutMath_impliedProbability_skewedOdds() public pure {
        (uint256 yesBps, uint256 noBps) = PayoutMath.impliedProbabilityBps(9 ether, 1 ether);
        assertEq(yesBps, 9_000); // 90%
        assertEq(noBps, 1_000); // 10%
    }

    function test_PayoutMath_feeFromLosingPool() public pure {
        uint256 fee = PayoutMath.feeFromLosingPool(100 ether);
        assertEq(fee, 1 ether); // 1% of 100
    }

    function test_PayoutMath_payoutForWinner_zeroWinningPool() public pure {
        (uint256 payout, uint256 fee) = PayoutMath.payoutForWinner(0, 10 ether, 1 ether);
        assertEq(payout, 0); // No payout when winning pool is 0
        assertEq(fee, 0.1 ether); // Fee still calculated
    }

    function test_PayoutMath_payoutForWinner_zeroStake() public pure {
        (uint256 payout, uint256 fee) = PayoutMath.payoutForWinner(10 ether, 10 ether, 0);
        assertEq(payout, 0); // No payout when stake is 0
        assertEq(fee, 0.1 ether); // Fee still calculated
    }
}
