// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {IWeatherMarket} from "../src/interfaces/IWeatherMarket.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ReadinessTest is Test {
    WeatherMarketV2 market;
    address alice = address(0x111);
    address bob = address(0x222);
    address charlie = address(0x333);
    bytes32 city = keccak256("nyc");
    function setUp() public {
        WeatherMarketV2 implementation = new WeatherMarketV2();
        market = WeatherMarketV2(address(new ERC1967Proxy(address(implementation),
            abi.encodeCall(WeatherMarketV2.initialize, (address(this), address(this))))));
        vm.deal(alice, 100 ether); vm.deal(bob, 100 ether); vm.deal(charlie, 100 ether);
    }
    receive() external payable {}
    function create() internal returns (uint256 id) {
        id = market.createMarket(city, uint64(block.timestamp + 1 days), 850, address(0));
    }
    function test_feeChangesCannotChangeSettledPayoutsOrSolvency() public {
        uint256 id = create();
        vm.prank(alice); market.placeBet{value: 2 ether}(id, true);
        vm.prank(charlie); market.placeBet{value: 1 ether}(id, true);
        vm.prank(bob); market.placeBet{value: 9 ether}(id, false);
        vm.warp(market.getMarket(id).resolveTime);
        market.resolveMarket(id, 850, uint64(block.timestamp));
        uint256 alicePayout = market.calculatePayout(id, alice);
        uint256 charliePayout = market.calculatePayout(id, charlie);
        market.setFeeBps(1000);
        assertEq(market.calculatePayout(id, alice), alicePayout);
        market.withdrawFees(address(0), address(this));
        uint256 beforeAlice = alice.balance;
        vm.prank(alice); market.claim(id);
        assertEq(alice.balance - beforeAlice, alicePayout);
        market.setFeeBps(0);
        assertEq(market.calculatePayout(id, charlie), charliePayout);
        uint256 beforeCharlie = charlie.balance;
        vm.prank(charlie); market.claim(id);
        assertEq(charlie.balance - beforeCharlie, charliePayout);
        assertEq(address(market).balance, 0);
    }
    function test_cancelledRefundIncludesBothSidesAndCannotDoubleClaim() public {
        uint256 id = create();
        vm.prank(alice); market.placeBet{value: 1 ether}(id, true);
        vm.prank(alice); market.placeBet{value: 2 ether}(id, false);
        market.cancelMarket(id);
        assertEq(market.calculatePayout(id, alice), 3 ether);
        vm.prank(alice); market.claim(id);
        assertEq(market.calculatePayout(id, alice), 0);
        vm.prank(alice); vm.expectRevert(WeatherMarketV2.NothingToClaim.selector); market.refund(id);
        assertEq(alice.balance, 100 ether);
    }
    function test_noWinnersGetterAndClaimRefundEveryStake() public {
        uint256 id = create();
        vm.prank(alice); market.placeBet{value: 2 ether}(id, false);
        vm.warp(market.getMarket(id).resolveTime);
        market.resolveMarket(id, 850, uint64(block.timestamp));
        assertEq(market.calculatePayout(id, alice), 2 ether);
        vm.prank(alice); vm.expectRevert(WeatherMarketV2.NotCancelled.selector); market.refund(id);
        vm.prank(alice); market.claim(id);
        assertEq(alice.balance, 100 ether);
        assertEq(market.calculatePayout(id, alice), 0);
    }
    function test_rejectsEarlyLateAndFutureObservations() public {
        uint256 id = create();
        uint64 target = market.getMarket(id).resolveTime;
        vm.warp(target);
        vm.expectRevert(WeatherMarketV2.TooEarly.selector); market.resolveMarket(id, 850, target - 1);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector); market.resolveMarket(id, 850, target + 1);
        vm.warp(target + 601);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector); market.resolveMarket(id, 850, target + 601);
        market.resolveMarket(id, 850, target + 600); // Valid historical evidence remains valid.
    }
    function test_scheduledRetriesProduceFiveMarketsAtMostAndExactDurations() public {
        uint64 day = 20 days;
        for (uint64 hour = 12; hour <= 16; hour++) {
            uint64 slot = day + hour * 1 hours;
            vm.warp(slot + 17);
            uint256 id = market.createScheduledMarket(city, 850, slot, 86400);
            assertEq(id, hour - 12);
            assertEq(market.getMarket(id).resolveTime, block.timestamp + 1 days);
            vm.warp(slot + 3599);
            assertEq(market.createScheduledMarket(keccak256("austin"), 900, slot, 86400), id);
            assertEq(market.getScheduledMarket(slot), id + 1);
        }
        assertEq(market.getMarketCount(), 5);
        vm.warp(day + 17 hours + 5 minutes);
        uint256 late = market.createScheduledMarket(city, 850, day + 17 hours, 86400); // Hour 17 is now allowed.
        assertEq(market.getMarket(late).resolveTime, block.timestamp + 1 days);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, day + 16 hours + 1, 86400);
        assertEq(market.createScheduledMarket(city, 850, day + 12 hours, 86400), 0); // Late replay is safe.
    }
    function test_scheduledRejectsExpiredMissingSlotAndUnauthorizedCaller() public {
        vm.warp(20 days + 13 hours);
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.createScheduledMarket(city, 850, 20 days + 12 hours, 86400);
        vm.prank(alice); vm.expectRevert(WeatherMarketV2.NotOwnerOrScheduler.selector);
        market.createScheduledMarket(city, 850, 20 days + 13 hours, 86400);
    }
    function testFuzz_feeChangesPreservePayout(uint16 feeBefore, uint16 feeAfter, uint96 stake) public {
        feeBefore = uint16(bound(feeBefore, 0, 1000)); feeAfter = uint16(bound(feeAfter, 0, 1000));
        uint256 value = bound(stake, 0.01 ether, 90 ether);
        market.setFeeBps(feeBefore);
        uint256 id = create();
        vm.prank(alice); market.placeBet{value: value}(id, true);
        vm.prank(bob); market.placeBet{value: value}(id, false);
        vm.warp(market.getMarket(id).resolveTime);
        market.resolveMarket(id, 850, uint64(block.timestamp));
        uint256 payout = market.calculatePayout(id, alice);
        market.setFeeBps(feeAfter);
        assertEq(market.calculatePayout(id, alice), payout);
        vm.prank(alice); market.claim(id);
        assertEq(address(market).balance, market.accruedFees(address(0)));
    }
}
