// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PayoutMath {
    uint256 internal constant FEE_BPS = 100; // 1%
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    function feeFromLosingPool(uint256 losingPool) internal pure returns (uint256 fee) {
        fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
    }

    function payoutForWinner(
        uint256 winningPool,
        uint256 losingPool,
        uint256 bettorStake
    ) internal pure returns (uint256 payout, uint256 fee) {
        if (winningPool == 0 || bettorStake == 0) return (0, feeFromLosingPool(losingPool));
        fee = feeFromLosingPool(losingPool);
        uint256 netLosingPool = losingPool - fee;
        uint256 winningsFromLosers = (netLosingPool * bettorStake) / winningPool;
        payout = bettorStake + winningsFromLosers;
    }

    function impliedProbabilityBps(
        uint256 yesPool,
        uint256 noPool
    ) internal pure returns (uint256 yesBps, uint256 noBps) {
        uint256 total = yesPool + noPool;
        if (total == 0) return (5_000, 5_000);
        yesBps = (yesPool * BPS_DENOMINATOR) / total;
        noBps = BPS_DENOMINATOR - yesBps;
    }
}

