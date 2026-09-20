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
    uint256 constant BOUNDS_SLOT = 11; // min packs into slot 10's tail; max takes slot 11.
    function test_boundsPackIntoOneGapSlot() public {
        market.setMarketDurationBounds(900, 7 days);
        uint256 word10 = uint256(vm.load(address(market), bytes32(uint256(10))));
        assertEq(address(uint160(word10)), scheduler);
        assertEq(uint64(word10 >> 160), 900);
        assertEq(uint64(uint256(vm.load(address(market), bytes32(BOUNDS_SLOT)))), 7 days);
        assertEq(uint256(vm.load(address(market), bytes32(uint256(12)))), 0);
    }
}
