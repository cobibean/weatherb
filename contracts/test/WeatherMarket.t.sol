// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {IWeatherMarket} from "../src/interfaces/IWeatherMarket.sol";
import {PayoutMath} from "../src/libraries/PayoutMath.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract WeatherMarketTest is Test {
    WeatherMarketV2 internal market;

    address internal owner = address(0xA11CE);
    address internal settler = address(0xB0B);
    address internal alice = address(0x111);
    address internal bob = address(0x222);

    bytes32 internal cityId = keccak256("nyc");

    function setUp() public {
        // Deploy implementation
        WeatherMarketV2 impl = new WeatherMarketV2();

        // Encode initializer call
        bytes memory initData = abi.encodeWithSelector(
            WeatherMarketV2.initialize.selector,
            owner,
            settler
        );

        // Deploy proxy and initialize
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        market = WeatherMarketV2(address(proxy));

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_multipleBetsAllowed() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 853, address(0));

        // V2 allows multiple bets from the same wallet
        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(marketId, true);

        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(marketId, false);

        // Verify both bets were recorded
        IWeatherMarket.Position memory pos = market.getPosition(marketId, alice);
        assertEq(pos.yesAmount, 0.01 ether);
        assertEq(pos.noAmount, 0.01 ether);
    }

    function test_bettingClosesAtDeadline() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 853, address(0));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        vm.warp(m.bettingDeadline);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.BettingClosed.selector);
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
        vm.expectRevert(WeatherMarketV2.NotSettler.selector);
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
        vm.expectRevert(WeatherMarketV2.TooEarly.selector);
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
        vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector);
        market.createMarket(cityId, uint64(block.timestamp + 2 hours), 850, address(0));
    }

    function test_onlyOwnerCanCancelMarket() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.cancelMarket(marketId);
    }

    function test_onlyOwnerCanSetSettler() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.setSettler(bob);
    }

    function test_onlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.pause();
    }

    function test_onlyOwnerCanWithdrawFees() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.withdrawFees(address(0), alice);
    }

    function test_onlyOwnerCanTransferOwnership() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.transferOwnership(alice);
    }

    // ========== Market Creation Validation Tests ==========

    function test_createMarket_rejectsNonNativeCurrency() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.OnlyNativeCurrency.selector);
        market.createMarket(cityId, uint64(block.timestamp + 2 hours), 850, address(0x1));
    }

    function test_createMarket_rejectsResolveTimeInPast() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createMarket(cityId, uint64(block.timestamp - 1), 850, address(0));
    }

    function test_createMarket_rejectsResolveTimeTooSoon() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createMarket(cityId, uint64(block.timestamp + 500), 850, address(0));
    }

    function test_createMarket_rejectsZeroThreshold() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createMarket(cityId, uint64(block.timestamp + 2 hours), 0, address(0));
    }

    function test_createMarket_rejectsZeroCityId() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createMarket(bytes32(0), uint64(block.timestamp + 2 hours), 850, address(0));
    }

    // ========== Betting Edge Cases ==========

    function test_placeBet_rejectsBelowMinimum() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.BetTooSmall.selector);
        market.placeBet{value: 0.001 ether}(marketId, true);
    }

    function test_placeBet_rejectsWhenPaused() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(owner);
        market.pause();

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.Paused.selector);
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
        vm.expectRevert(WeatherMarketV2.BettingClosed.selector);
        market.placeBet{value: 1 ether}(marketId, false);
    }

    function test_placeBet_rejectsOnCancelledMarket() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(owner);
        market.cancelMarket(marketId);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.InvalidStatus.selector);
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

    function test_resolve_setsNoWinnersStatusWhenNoWinners() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);

        // YES wins but no YES bets → NoWinners status
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), 4); // NoWinners status
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
        vm.expectRevert(WeatherMarketV2.InvalidStatus.selector);
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
        vm.expectRevert(WeatherMarketV2.NothingToClaim.selector);
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
        vm.expectRevert(WeatherMarketV2.NothingToClaim.selector);
        market.claim(marketId);
    }

    function test_claim_rejectsOnUnresolvedMarket() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotResolved.selector);
        market.claim(marketId);
    }

    function test_refund_rejectsOnNonCancelledMarket() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotCancelled.selector);
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
        vm.expectRevert(WeatherMarketV2.NothingToClaim.selector);
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
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.setMinBet(0);
    }

    function test_setBettingBuffer_works() public {
        vm.prank(owner);
        market.setBettingBuffer(1800);
        assertEq(market.bettingBufferSeconds(), 1800);
    }

    function test_setBettingBuffer_rejectsZero() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.setBettingBuffer(0);
    }

    function test_transferOwnership_works() public {
        vm.prank(owner);
        market.transferOwnership(alice);
        assertEq(market.owner(), alice);
    }

    function test_transferOwnership_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.ZeroAddress.selector);
        market.transferOwnership(address(0));
    }

    function test_setSettler_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.ZeroAddress.selector);
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
        vm.expectRevert(WeatherMarketV2.ZeroAddress.selector);
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

    function test_resolve_setsNoWinnersStatusWhenOnlyYesBets() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.warp(resolveTime);

        // NO wins (temp below threshold), but no NO bets → NoWinners status
        vm.prank(settler);
        market.resolveMarket(marketId, 800, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), 4); // NoWinners status
    }

    function test_resolve_setsNoWinnersStatusWithNoBets() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.warp(resolveTime);

        // No bets at all → NoWinners status
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), 4); // NoWinners status
    }

    function test_getMarket_invalidMarketId() public {
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.getMarket(999);
    }

    function test_getPosition_invalidMarketId() public {
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.getPosition(999, alice);
    }

    function test_placeBet_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.placeBet{value: 1 ether}(999, true);
    }

    function test_claim_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.claim(999);
    }

    function test_refund_invalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.refund(999);
    }

    function test_resolveMarket_invalidMarketId() public {
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.resolveMarket(999, 900, uint64(block.timestamp));
    }

    function test_cancelMarket_invalidMarketId() public {
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.cancelMarket(999);
    }

    function test_cancelMarketBySettler_invalidMarketId() public {
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.cancelMarketBySettler(999);
    }

    function test_cancelMarketBySettler_beforeResolveTime() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        // Settler cannot cancel before resolve time
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.TooEarly.selector);
        market.cancelMarketBySettler(marketId);
    }

    function test_cancelMarketBySettler_onlySettler() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.warp(resolveTime);
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotSettler.selector);
        market.cancelMarketBySettler(marketId);
    }

    function test_cancelMarket_alreadyCancelled() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(owner);
        market.cancelMarket(marketId);

        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.InvalidStatus.selector);
        market.cancelMarket(marketId);
    }

    function test_unpause_onlyOwner() public {
        vm.prank(owner);
        market.pause();

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
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

    // ========== NoWinners Status Tests ==========

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
}
