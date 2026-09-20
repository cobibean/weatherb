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
