// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {WeatherMarketV2} from "../src/WeatherMarketV2.sol";
import {IWeatherMarket} from "../src/interfaces/IWeatherMarket.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title WeatherMarketComprehensiveTest
/// @notice Comprehensive test suite covering all user flows, admin flows, proxy upgrades, and security fixes
/// @dev Tests organized by flow type for easy maintenance and upgrades
contract WeatherMarketComprehensiveTest is Test {
    WeatherMarketV2 internal market;
    WeatherMarketV2 internal implementation;
    ERC1967Proxy internal proxy;

    // Test accounts
    address internal owner = makeAddr("owner");
    address internal settler = makeAddr("settler");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal charlie = makeAddr("charlie");
    address internal dave = makeAddr("dave");
    address internal attacker = makeAddr("attacker");

    // Test data
    bytes32 internal cityId = keccak256("nyc");
    uint256 internal constant DEFAULT_THRESHOLD = 850; // 85.0°F
    uint64 internal constant DEFAULT_RESOLVE_OFFSET = 2 hours;

    // Events to test
    event MarketCreated(
        uint256 indexed marketId,
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    );
    event BetPlaced(uint256 indexed marketId, address indexed bettor, bool isYes, uint256 amount);
    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        uint256 tempTenths,
        uint64 observedTimestamp
    );
    event WinningsClaimed(uint256 indexed marketId, address indexed winner, uint256 payout);
    event MarketCancelled(uint256 indexed marketId);
    event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event Upgraded(address indexed implementation);

    function setUp() public {
        // Deploy implementation
        implementation = new WeatherMarketV2();

        // Encode initializer call
        bytes memory initData = abi.encodeWithSelector(
            WeatherMarketV2.initialize.selector,
            owner,
            settler
        );

        // Deploy proxy and initialize
        proxy = new ERC1967Proxy(address(implementation), initData);
        market = WeatherMarketV2(address(proxy));

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);
        vm.deal(attacker, 100 ether);
    }

    // ============================================================
    // PROXY UPGRADE TESTS
    // ============================================================

    function test_proxy_initialSetup() public view {
        assertEq(market.owner(), owner);
        assertEq(market.settler(), settler);
        assertEq(market.minBetWei(), 0.01 ether);
        assertEq(market.bettingBufferSeconds(), 600);
        assertEq(market.feeBps(), 100); // 1%
        assertFalse(market.isPaused());
    }

    function test_proxy_cannotReinitialize() public {
        vm.expectRevert();
        market.initialize(alice, bob);
    }

    function test_proxy_implementationIsCorrect() public view {
        // Read implementation from ERC1967 storage slot
        bytes32 IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address impl = address(uint160(uint256(vm.load(address(proxy), IMPLEMENTATION_SLOT))));
        assertEq(impl, address(implementation));
    }

    function test_proxy_upgradeToNewImplementation() public {
        // Deploy new implementation
        WeatherMarketV2 newImpl = new WeatherMarketV2();

        // Owner upgrades to new implementation
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit Upgraded(address(newImpl));
        market.upgradeToAndCall(address(newImpl), "");

        // Verify upgrade
        bytes32 IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(address(proxy), IMPLEMENTATION_SLOT))));
        assertEq(currentImpl, address(newImpl));
    }

    function test_proxy_upgradePreservesState() public {
        // Create market and place bets
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        // Store pre-upgrade state
        IWeatherMarket.Market memory preMarket = market.getMarket(marketId);
        IWeatherMarket.Position memory prePosition = market.getPosition(marketId, alice);
        uint256 preMarketCount = market.getMarketCount();

        // Deploy and upgrade to new implementation
        WeatherMarketV2 newImpl = new WeatherMarketV2();
        vm.prank(owner);
        market.upgradeToAndCall(address(newImpl), "");

        // Verify state preservation
        IWeatherMarket.Market memory postMarket = market.getMarket(marketId);
        IWeatherMarket.Position memory postPosition = market.getPosition(marketId, alice);

        assertEq(market.getMarketCount(), preMarketCount);
        assertEq(postMarket.cityId, preMarket.cityId);
        assertEq(postMarket.thresholdTenths, preMarket.thresholdTenths);
        assertEq(postMarket.yesPool, preMarket.yesPool);
        assertEq(postMarket.noPool, preMarket.noPool);
        assertEq(postPosition.yesAmount, prePosition.yesAmount);
        assertEq(postPosition.noAmount, prePosition.noAmount);
    }

    function test_proxy_upgradeRequiresOwner() public {
        WeatherMarketV2 newImpl = new WeatherMarketV2();

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.upgradeToAndCall(address(newImpl), "");
    }

    function test_proxy_upgradeWorksWithOngoingMarkets() public {
        // Create multiple markets at different stages
        uint64 resolveTime1 = uint64(block.timestamp + 1 hours);
        uint64 resolveTime2 = uint64(block.timestamp + 2 hours);
        uint64 resolveTime3 = uint64(block.timestamp + 3 hours);

        vm.startPrank(owner);
        uint256 marketId1 = market.createMarket(cityId, resolveTime1, 850, address(0));
        uint256 marketId2 = market.createMarket(cityId, resolveTime2, 860, address(0));
        uint256 marketId3 = market.createMarket(cityId, resolveTime3, 870, address(0));
        vm.stopPrank();

        // Place bets on all markets
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId1, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId2, false);
        vm.prank(charlie);
        market.placeBet{value: 1 ether}(marketId3, true);

        // Resolve one market
        vm.warp(resolveTime1);
        vm.prank(settler);
        market.resolveMarket(marketId1, 900, uint64(resolveTime1));

        // Upgrade
        WeatherMarketV2 newImpl = new WeatherMarketV2();
        vm.prank(owner);
        market.upgradeToAndCall(address(newImpl), "");

        // Verify all markets still accessible
        IWeatherMarket.Market memory m1 = market.getMarket(marketId1);
        IWeatherMarket.Market memory m2 = market.getMarket(marketId2);
        IWeatherMarket.Market memory m3 = market.getMarket(marketId3);

        assertEq(uint8(m1.status), uint8(IWeatherMarket.MarketStatus.Resolved));
        assertEq(uint8(m2.status), uint8(IWeatherMarket.MarketStatus.Open));
        assertEq(uint8(m3.status), uint8(IWeatherMarket.MarketStatus.Open));

        // Can claim from resolved market after upgrade
        vm.prank(alice);
        market.claim(marketId1);

        // Can continue betting on open markets after upgrade
        vm.prank(dave);
        market.placeBet{value: 1 ether}(marketId2, true);
    }

    // ============================================================
    // COMPLETE USER FLOW TESTS
    // ============================================================

    /// @notice Test full user journey: discover market → bet → win → claim
    function test_userFlow_happyPath_betAndWin() public {
        // 1. Owner creates market
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // 2. Alice checks market details
        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(m.cityId, cityId);
        assertEq(m.thresholdTenths, DEFAULT_THRESHOLD);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.Open));

        // 3. Alice places YES bet
        uint256 aliceInitial = alice.balance;
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        // 4. Bob places NO bet
        vm.prank(bob);
        market.placeBet{value: 2 ether}(marketId, false);

        // 5. Check positions
        IWeatherMarket.Position memory alicePos = market.getPosition(marketId, alice);
        IWeatherMarket.Position memory bobPos = market.getPosition(marketId, bob);
        assertEq(alicePos.yesAmount, 1 ether);
        assertEq(bobPos.noAmount, 2 ether);

        // 6. Time passes, settler resolves (YES wins)
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime)); // 90.0°F > 85.0°F

        // 7. Alice claims winnings
        vm.prank(alice);
        market.claim(marketId);

        // 8. Verify payout (1 ETH stake + proportional share of 2 ETH losing pool - 1% fee)
        // Fee = 2 * 0.01 = 0.02 ETH
        // Net losing pool = 2 - 0.02 = 1.98 ETH
        // Alice payout = 1 + 1.98 = 2.98 ETH
        uint256 expectedPayout = 2.98 ether;
        assertEq(alice.balance, aliceInitial - 1 ether + expectedPayout);

        // 9. Bob cannot claim (lost)
        vm.prank(bob);
        vm.expectRevert(WeatherMarketV2.NothingToClaim.selector);
        market.claim(marketId);
    }

    /// @notice Test user places multiple bets on same market
    function test_userFlow_multipleBets_sameUser() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Alice places multiple YES bets
        vm.startPrank(alice);
        market.placeBet{value: 0.5 ether}(marketId, true);
        market.placeBet{value: 0.3 ether}(marketId, true);
        market.placeBet{value: 0.2 ether}(marketId, true);
        vm.stopPrank();

        // Bob bets NO once
        vm.prank(bob);
        market.placeBet{value: 2 ether}(marketId, false);

        // Verify accumulation
        IWeatherMarket.Position memory alicePos = market.getPosition(marketId, alice);
        assertEq(alicePos.yesAmount, 1 ether); // 0.5 + 0.3 + 0.2

        // Resolve and claim
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);

        // Alice should get her 1 ETH stake + share of losing pool
        assertGt(alice.balance, aliceBefore + 1 ether);
    }

    /// @notice Test user bets on both YES and NO
    function test_userFlow_hedging_bothSides() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Alice hedges by betting both sides
        vm.startPrank(alice);
        market.placeBet{value: 1 ether}(marketId, true);  // YES
        market.placeBet{value: 1 ether}(marketId, false); // NO
        vm.stopPrank();

        // Bob bets YES
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, true);

        IWeatherMarket.Position memory alicePos = market.getPosition(marketId, alice);
        assertEq(alicePos.yesAmount, 1 ether);
        assertEq(alicePos.noAmount, 1 ether);

        // YES wins
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // Alice claims (wins from YES, loses from NO)
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);

        // Alice's YES bet wins proportionally: 1 ETH / 2 ETH total YES pool
        // Losing pool (NO) = 1 ETH, fee = 0.01 ETH, net = 0.99 ETH
        // Alice's share of winnings = (1/2) * 0.99 = 0.495 ETH
        // Total payout = 1 + 0.495 = 1.495 ETH
        assertApproxEqAbs(alice.balance - aliceBefore, 1.495 ether, 0.001 ether);
    }

    /// @notice Test user refund flow when market is cancelled
    function test_userFlow_cancelled_getRefund() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Users place bets
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 0.5 ether}(marketId, false);

        uint256 aliceInitial = alice.balance;
        uint256 bobInitial = bob.balance;

        // Owner cancels market
        vm.prank(owner);
        market.cancelMarket(marketId);

        // Users get full refunds
        vm.prank(alice);
        market.refund(marketId);
        assertEq(alice.balance, aliceInitial + 1 ether);

        vm.prank(bob);
        market.refund(marketId);
        assertEq(bob.balance, bobInitial + 0.5 ether);
    }

    /// @notice Test user cannot bet after deadline
    function test_userFlow_betAfterDeadline_reverts() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        IWeatherMarket.Market memory m = market.getMarket(marketId);

        // Warp to betting deadline
        vm.warp(m.bettingDeadline);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.BettingClosed.selector);
        market.placeBet{value: 1 ether}(marketId, true);
    }

    /// @notice Test user cannot double claim
    function test_userFlow_doubleClaim_reverts() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // First claim succeeds
        vm.prank(alice);
        market.claim(marketId);

        // Second claim fails
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.NothingToClaim.selector);
        market.claim(marketId);
    }

    // ============================================================
    // ADMIN FLOW TESTS
    // ============================================================

    /// @notice Test complete market lifecycle from admin perspective
    function test_adminFlow_createManageResolve() public {
        // 1. Admin creates market
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);

        vm.expectEmit(true, false, false, true);
        emit MarketCreated(0, cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        assertEq(market.getMarketCount(), 1);

        // 2. Admin adjusts parameters
        vm.startPrank(owner);
        market.setMinBet(0.05 ether);
        market.setBettingBuffer(900); // 15 minutes
        market.setFeeBps(200); // 2%
        vm.stopPrank();

        assertEq(market.minBetWei(), 0.05 ether);
        assertEq(market.bettingBufferSeconds(), 900);
        assertEq(market.feeBps(), 200);

        // 3. Users bet (new minimum applies to future bets)
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        // 4. Admin pauses contract temporarily
        vm.prank(owner);
        market.pause();

        // Users cannot bet while paused
        vm.prank(charlie);
        vm.expectRevert(WeatherMarketV2.Paused.selector);
        market.placeBet{value: 1 ether}(marketId, true);

        // 5. Admin unpauses
        vm.prank(owner);
        market.unpause();

        // 6. Settler resolves market (admin allows this)
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // 7. Admin withdraws fees
        uint256 expectedFees = (1 ether * 200) / 10_000; // 2% of losing pool
        assertEq(market.accruedFees(address(0)), expectedFees);

        address treasury = makeAddr("treasury");
        vm.prank(owner);
        market.withdrawFees(address(0), treasury);

        assertEq(treasury.balance, expectedFees);
        assertEq(market.accruedFees(address(0)), 0);
    }

    /// @notice Test admin creates multiple markets
    function test_adminFlow_multipleMarkets() public {
        uint64 baseTime = uint64(block.timestamp);

        vm.startPrank(owner);
        uint256 id1 = market.createMarket(cityId, baseTime + 1 hours, 800, address(0));
        uint256 id2 = market.createMarket(cityId, baseTime + 2 hours, 850, address(0));
        uint256 id3 = market.createMarket(cityId, baseTime + 3 hours, 900, address(0));
        vm.stopPrank();

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(id3, 2);
        assertEq(market.getMarketCount(), 3);

        // All markets have different thresholds
        assertEq(market.getMarket(id1).thresholdTenths, 800);
        assertEq(market.getMarket(id2).thresholdTenths, 850);
        assertEq(market.getMarket(id3).thresholdTenths, 900);
    }

    /// @notice Test admin cancels market before resolution
    function test_adminFlow_cancelMarket() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        // Admin cancels (maybe due to data provider issues)
        vm.expectEmit(true, false, false, false);
        emit MarketCancelled(marketId);

        vm.prank(owner);
        market.cancelMarket(marketId);

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.Cancelled));

        // User can refund
        vm.prank(alice);
        market.refund(marketId);
    }

    /// @notice Test admin transfers ownership
    function test_adminFlow_transferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        market.transferOwnership(newOwner);

        assertEq(market.owner(), newOwner);

        // Old owner cannot perform admin actions
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.NotOwner.selector);
        market.pause();

        // New owner can
        vm.prank(newOwner);
        market.pause();
        assertTrue(market.isPaused());
    }

    /// @notice Test admin changes settler
    function test_adminFlow_changeSettler() public {
        address newSettler = makeAddr("newSettler");

        vm.prank(owner);
        market.setSettler(newSettler);

        assertEq(market.settler(), newSettler);

        // Old settler cannot resolve
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.warp(resolveTime);
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.NotSettler.selector);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // New settler can
        vm.prank(newSettler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));
    }

    /// @notice Test admin cannot set invalid parameters
    function test_adminFlow_parameterValidation() public {
        vm.startPrank(owner);

        // Cannot set zero min bet
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.setMinBet(0);

        // Cannot set zero betting buffer
        vm.expectRevert(WeatherMarketV2.InvalidParams.selector);
        market.setBettingBuffer(0);

        // Cannot set fee too high
        vm.expectRevert(WeatherMarketV2.FeeTooHigh.selector);
        market.setFeeBps(1001); // > 10%

        // Cannot set zero address as owner
        vm.expectRevert(WeatherMarketV2.ZeroAddress.selector);
        market.transferOwnership(address(0));

        // Cannot set zero address as settler
        vm.expectRevert(WeatherMarketV2.ZeroAddress.selector);
        market.setSettler(address(0));

        vm.stopPrank();
    }

    // ============================================================
    // SETTLER FLOW TESTS
    // ============================================================

    /// @notice Test settler resolves market normally
    function test_settlerFlow_normalResolution() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        // Settler waits until resolve time
        vm.warp(resolveTime);

        // Settler submits temperature data
        uint256 actualTemp = 900; // 90.0°F

        vm.expectEmit(true, false, false, true);
        emit MarketResolved(marketId, true, actualTemp, uint64(resolveTime));

        vm.prank(settler);
        market.resolveMarket(marketId, actualTemp, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.Resolved));
        assertEq(m.resolvedTempTenths, actualTemp);
        assertTrue(m.outcome); // YES wins
    }

    /// @notice Test settler cancels market after resolve time
    function test_settlerFlow_cancelAfterResolveTime() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        // Settler cannot cancel before resolve time
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.TooEarly.selector);
        market.cancelMarketBySettler(marketId);

        // After resolve time, settler can cancel (e.g., bad data)
        vm.warp(resolveTime);
        vm.prank(settler);
        market.cancelMarketBySettler(marketId);

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.Cancelled));
    }

    /// @notice Test settler handles edge case: no winners
    function test_settlerFlow_noWinners() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Only YES bets placed
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        vm.warp(resolveTime);

        // Temperature below threshold → NO wins, but no NO bets
        vm.prank(settler);
        market.resolveMarket(marketId, 800, uint64(resolveTime)); // 80.0°F < 85.0°F

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.NoWinners));
        assertFalse(m.outcome); // NO won but no NO bets

        // Alice gets full refund
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);
        assertEq(alice.balance - aliceBefore, 1 ether);
    }

    /// @notice Test settler cannot resolve before time
    function test_settlerFlow_cannotResolveEarly() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);

        // Warp to before resolve time
        vm.warp(resolveTime - 1);

        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.TooEarly.selector);
        market.resolveMarket(marketId, 900, uint64(resolveTime));
    }

    /// @notice Test settler validates observation timestamp
    function test_settlerFlow_observationTimestampValidation() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.warp(resolveTime);

        // Observation timestamp before resolve time should fail
        vm.prank(settler);
        vm.expectRevert(WeatherMarketV2.TooEarly.selector);
        market.resolveMarket(marketId, 900, uint64(resolveTime - 1));

        // Observation at or after resolve time should succeed
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));
    }

    // ============================================================
    // SECURITY FIX TESTS (Overflow Protection)
    // ============================================================

    /// @notice Test that pool accumulation uses checked arithmetic
    function test_security_poolAccumulationOverflowProtection() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Place multiple large bets to verify checked arithmetic handles it
        vm.deal(attacker, 100 ether);

        vm.prank(attacker);
        market.placeBet{value: 50 ether}(marketId, true);

        // Second bet accumulates properly
        vm.prank(attacker);
        market.placeBet{value: 30 ether}(marketId, true);

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(m.yesPool, 80 ether); // Accumulation works correctly
    }

    /// @notice Test fee accumulation does not overflow
    function test_security_feeAccumulationOverflowProtection() public {
        // This is harder to test directly, but we verify checked arithmetic is used
        // by creating multiple markets and resolving them

        vm.startPrank(owner);
        for (uint256 i = 0; i < 10; i++) {
            uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET + i);
            uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

            vm.stopPrank();

            // Place large bets
            vm.prank(alice);
            market.placeBet{value: 10 ether}(marketId, true);
            vm.prank(bob);
            market.placeBet{value: 10 ether}(marketId, false);

            // Resolve
            vm.warp(resolveTime);
            vm.prank(settler);
            market.resolveMarket(marketId, 900, uint64(resolveTime));

            vm.startPrank(owner);
        }
        vm.stopPrank();

        // Fees should accumulate properly
        uint256 totalFees = market.accruedFees(address(0));
        assertEq(totalFees, 10 * 0.1 ether); // 10 markets * 1% of 10 ETH
    }

    /// @notice Test balance check before payout
    function test_security_insufficientBalanceCheck() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // Simulate contract balance being drained (shouldn't happen, but testing the check)
        // We can't actually drain it, but the check is in place for accounting errors

        // Normal claim should work
        vm.prank(alice);
        market.claim(marketId);
    }

    // ============================================================
    // EDGE CASE TESTS
    // ============================================================

    /// @notice Test market with exact tie on threshold
    function test_edgeCase_exactThreshold_yesWins() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
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
        assertTrue(m.outcome); // YES wins on tie
    }

    /// @notice Test minimum bet enforcement
    function test_edgeCase_minimumBet() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Below minimum should revert
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.BetTooSmall.selector);
        market.placeBet{value: 0.001 ether}(marketId, true);

        // Exactly minimum should work
        vm.prank(alice);
        market.placeBet{value: 0.01 ether}(marketId, true);

        IWeatherMarket.Position memory pos = market.getPosition(marketId, alice);
        assertEq(pos.yesAmount, 0.01 ether);
    }

    /// @notice Test market with no bets at all
    function test_edgeCase_noBets() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.warp(resolveTime);

        // Settler can still resolve
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint8(m.status), uint8(IWeatherMarket.MarketStatus.NoWinners));
        assertEq(m.yesPool, 0);
        assertEq(m.noPool, 0);
    }

    /// @notice Test very large number of bettors
    function test_edgeCase_manyBettors() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Create 50 bettors (use addresses starting from 1000 to avoid precompiles)
        for (uint160 i = 1000; i < 1050; i++) {
            address bettor = address(i);
            vm.deal(bettor, 1 ether);

            vm.prank(bettor);
            market.placeBet{value: 0.1 ether}(marketId, i % 2 == 0); // Alternate YES/NO
        }

        IWeatherMarket.Market memory m = market.getMarket(marketId);
        assertEq(m.yesPool, 2.5 ether); // 25 * 0.1
        assertEq(m.noPool, 2.5 ether); // 25 * 0.1

        // Resolve
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // All YES bettors can claim
        for (uint160 i = 1000; i < 1050; i += 2) {
            address bettor = address(i);
            vm.prank(bettor);
            market.claim(marketId);
        }
    }

    /// @notice Test invalid market ID access
    function test_edgeCase_invalidMarketId() public {
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.getMarket(999);

        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.getPosition(999, alice);

        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.InvalidMarket.selector);
        market.placeBet{value: 1 ether}(999, true);
    }

    /// @notice Test contract paused during various operations
    function test_edgeCase_pausedContract() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Place bet before pause
        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        // Pause contract
        vm.prank(owner);
        market.pause();

        // Note: Owner CAN still create markets when paused (no whenNotPaused modifier)
        // This allows emergency markets if needed

        // Cannot place bets when paused
        vm.prank(charlie);
        vm.expectRevert(WeatherMarketV2.Paused.selector);
        market.placeBet{value: 1 ether}(marketId, true);

        // Cannot claim when paused (even before resolution)
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.Paused.selector);
        market.claim(marketId);

        // Unpause temporarily to resolve
        vm.prank(owner);
        market.unpause();

        // Resolve market
        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // Pause again
        vm.prank(owner);
        market.pause();

        // Cannot claim when paused after resolution
        vm.prank(alice);
        vm.expectRevert(WeatherMarketV2.Paused.selector);
        market.claim(marketId);

        // Unpause
        vm.prank(owner);
        market.unpause();

        // Now can claim
        vm.prank(alice);
        market.claim(marketId);
    }

    /// @notice Test proportional payouts with uneven pools
    function test_edgeCase_unevenPools() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        // Heavily skewed pools: 10 ETH YES, 1 ETH NO
        vm.prank(alice);
        market.placeBet{value: 10 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime)); // YES wins

        // Alice should get: 10 ETH stake + (1 ETH - 0.01 fee) = 10.99 ETH
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);

        assertEq(alice.balance - aliceBefore, 10.99 ether);
    }

    /// @notice Test changing fee rate doesn't affect existing unresolved markets (until resolved)
    /// NOTE: This tests current behavior - fee is mutable until resolution
    function test_edgeCase_feeChange_affectsUnresolvedMarkets() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        // Change fee from 1% to 5%
        vm.prank(owner);
        market.setFeeBps(500);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        // Fee calculated at resolution with NEW rate: 5% of 1 ETH = 0.05 ETH
        assertEq(market.accruedFees(address(0)), 0.05 ether);

        // Alice gets: 1 + (1 - 0.05) = 1.95 ETH
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.claim(marketId);
        assertEq(alice.balance - aliceBefore, 1.95 ether);
    }

    /// @notice Test maximum fee cap enforcement
    function test_edgeCase_maxFeeCap() public {
        vm.prank(owner);
        market.setFeeBps(1000); // 10% - maximum allowed

        assertEq(market.feeBps(), 1000);

        // Cannot set above 10%
        vm.prank(owner);
        vm.expectRevert(WeatherMarketV2.FeeTooHigh.selector);
        market.setFeeBps(1001);
    }

    // ============================================================
    // GAS OPTIMIZATION TESTS
    // ============================================================

    /// @notice Benchmark gas for placing bet
    function test_gas_placeBet() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        uint256 gasBefore = gasleft();
        market.placeBet{value: 1 ether}(marketId, true);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for placeBet", gasUsed);
    }

    /// @notice Benchmark gas for claim
    function test_gas_claim() public {
        uint64 resolveTime = uint64(block.timestamp + DEFAULT_RESOLVE_OFFSET);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, DEFAULT_THRESHOLD, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);
        vm.prank(settler);
        market.resolveMarket(marketId, 900, uint64(resolveTime));

        vm.prank(alice);
        uint256 gasBefore = gasleft();
        market.claim(marketId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for claim", gasUsed);
    }
}
