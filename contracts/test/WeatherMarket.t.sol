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
}
