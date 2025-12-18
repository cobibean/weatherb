// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWeatherMarket {
    enum MarketStatus {
        Open,
        Closed,
        Resolved,
        Cancelled
    }

    struct Market {
        bytes32 cityId;
        uint64 resolveTime;
        uint64 bettingDeadline;
        uint256 thresholdTenths;
        address currency; // address(0) = native FLR
        MarketStatus status;
        uint256 yesPool;
        uint256 noPool;
        uint256 totalFees;
        uint256 resolvedTempTenths;
        uint64 observedTimestamp;
        bool outcome;
    }

    struct Position {
        uint256 yesAmount;
        uint256 noAmount;
        bool claimed;
    }

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
        uint256 resolvedTempTenths,
        uint64 observedTimestamp
    );
    event MarketCancelled(uint256 indexed marketId);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);
    event Refunded(uint256 indexed marketId, address indexed bettor, uint256 amount);

    function createMarket(
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    ) external returns (uint256 marketId);

    function cancelMarket(uint256 marketId) external;

    function cancelMarketBySettler(uint256 marketId) external;

    function withdrawFees(address token, address recipient) external;

    function setSettler(address settler) external;

    function transferOwnership(address newOwner) external;

    function setMinBet(uint256 minBetWei) external;

    function setBettingBuffer(uint64 bettingBufferSeconds) external;

    function pause() external;
    function unpause() external;

    function resolveMarket(uint256 marketId, bytes calldata proof, bytes calldata attestationData) external;

    function placeBet(uint256 marketId, bool isYes) external payable;

    function claim(uint256 marketId) external;

    function refund(uint256 marketId) external;

    function getMarket(uint256 marketId) external view returns (Market memory);

    function getMarketCount() external view returns (uint256);

    function getPosition(uint256 marketId, address bettor) external view returns (Position memory);

    function calculatePayout(uint256 marketId, address bettor) external view returns (uint256);

    function getImpliedPrices(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice);
}
