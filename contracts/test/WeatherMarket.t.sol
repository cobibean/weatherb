// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {WeatherMarket} from "../src/WeatherMarket.sol";
import {IWeatherMarket} from "../src/interfaces/IWeatherMarket.sol";
import {PayoutMath} from "../src/libraries/PayoutMath.sol";
import {MockRegistry} from "./mocks/MockRegistry.sol";
import {MockFdcVerification} from "./mocks/MockFdcVerification.sol";

contract WeatherMarketTest is Test {
    WeatherMarket internal market;
    MockRegistry internal registry;
    MockFdcVerification internal verifier;

    address internal owner = address(0xA11CE);
    address internal settler = address(0xB0B);
    address internal alice = address(0x111);
    address internal bob = address(0x222);

    bytes32 internal cityId = keccak256("nyc");

    function setUp() public {
        registry = new MockRegistry();
        verifier = new MockFdcVerification();
        registry.setVerifier(address(verifier));

        vm.prank(owner);
        market = new WeatherMarket(address(registry));

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

        verifier.setOk(true);
        bytes memory proof = hex"1234";
        bytes memory attestationData = abi.encode(cityId, uint64(resolveTime), uint256(900));

        vm.prank(settler);
        market.resolveMarket(marketId, proof, attestationData);

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

    function test_invalidFdcProofReverts() public {
        uint64 resolveTime = uint64(block.timestamp + 2 hours);
        vm.prank(owner);
        uint256 marketId = market.createMarket(cityId, resolveTime, 850, address(0));

        vm.prank(alice);
        market.placeBet{value: 1 ether}(marketId, true);
        vm.prank(bob);
        market.placeBet{value: 1 ether}(marketId, false);

        vm.warp(resolveTime);

        verifier.setOk(false);
        bytes memory proof = hex"1234";
        bytes memory attestationData = abi.encode(cityId, uint64(resolveTime), uint256(900));

        vm.prank(settler);
        vm.expectRevert(WeatherMarket.InvalidAttestation.selector);
        market.resolveMarket(marketId, proof, attestationData);
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

    function testFuzz_PayoutMathNoOverflow(uint128 yesPool, uint128 noPool, uint128 stake) public {
        vm.assume(yesPool > 0);
        vm.assume(noPool > 0);
        vm.assume(stake > 0 && stake <= yesPool);

        (uint256 payout, uint256 fee) = PayoutMath.payoutForWinner(uint256(yesPool), uint256(noPool), uint256(stake));

        assertGe(payout, uint256(stake));
        assertEq(fee, (uint256(noPool) * 100) / 10_000);
    }
}
