// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWeatherMarket} from "./interfaces/IWeatherMarket.sol";
import {PayoutMath} from "./libraries/PayoutMath.sol";
import {FDCVerifier} from "./verification/FDCVerifier.sol";

contract WeatherMarket is IWeatherMarket, FDCVerifier {
    error NotOwner();
    error NotSettler();
    error Paused();
    error InvalidMarket();
    error InvalidStatus();
    error BettingClosed();
    error BetTooSmall();
    error AlreadyBet();
    error TooEarly();
    error OnlyNativeCurrency();
    error TransferFailed();
    error NotResolved();
    error NotCancelled();
    error NothingToClaim();
    error InvalidAttestation();
    error CityMismatch();
    error ReadingTooEarly();
    error InvalidParams();
    error ZeroAddress();

    address public owner;
    address public settler;

    bool public isPaused;
    uint64 public bettingBufferSeconds;
    uint256 public minBetWei;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    Market[] private markets;
    mapping(uint256 => mapping(address => Position)) private positions;
    mapping(address => uint256) public accruedFees;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySettler() {
        if (msg.sender != settler) revert NotSettler();
        _;
    }

    modifier whenNotPaused() {
        if (isPaused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert InvalidStatus();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address registryAddress) FDCVerifier(registryAddress) {
        if (registryAddress == address(0)) revert ZeroAddress();
        owner = msg.sender;
        settler = msg.sender;
        bettingBufferSeconds = 600;
        minBetWei = 0.01 ether;
        _status = _NOT_ENTERED;
    }

    /// @notice Create a new market for a city/time/threshold.
    /// @param cityId City identifier (bytes32).
    /// @param resolveTime Unix timestamp when the market can be resolved.
    /// @param thresholdTenths Temperature threshold in 0.1°F units (e.g. 853 = 85.3°F).
    /// @param currency Currency address (must be `address(0)` for native FLR in V1).
    /// @return marketId The newly created market id.
    function createMarket(
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    ) external onlyOwner returns (uint256 marketId) {
        if (currency != address(0)) revert OnlyNativeCurrency();
        if (resolveTime <= block.timestamp) revert InvalidParams();
        if (resolveTime <= uint64(block.timestamp) + bettingBufferSeconds) revert InvalidParams();
        if (thresholdTenths == 0) revert InvalidParams();
        if (cityId == bytes32(0)) revert InvalidParams();

        uint64 bettingDeadline = resolveTime - bettingBufferSeconds;
        Market memory m = Market({
            cityId: cityId,
            resolveTime: resolveTime,
            bettingDeadline: bettingDeadline,
            thresholdTenths: thresholdTenths,
            currency: currency,
            status: MarketStatus.Open,
            yesPool: 0,
            noPool: 0,
            totalFees: 0,
            resolvedTempTenths: 0,
            observedTimestamp: 0,
            outcome: false
        });

        markets.push(m);
        marketId = markets.length - 1;
        emit MarketCreated(marketId, cityId, resolveTime, thresholdTenths, currency);
    }

    /// @notice Cancel a market; bettors can refund.
    /// @param marketId Market id to cancel.
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage market = _getMarketStorage(marketId);
        _updateClosedStatus(market);
        if (market.status == MarketStatus.Resolved || market.status == MarketStatus.Cancelled)
            revert InvalidStatus();
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Withdraw accrued protocol fees.
    /// @param token Token address (must be `address(0)` for native FLR in V1).
    /// @param recipient Recipient of withdrawn fees.
    function withdrawFees(address token, address recipient) external onlyOwner nonReentrant {
        if (token != address(0)) revert OnlyNativeCurrency();
        if (recipient == address(0)) revert ZeroAddress();
        uint256 amount = accruedFees[token];
        accruedFees[token] = 0;
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Set the settler address allowed to resolve markets.
    /// @param newSettler Address that can call `resolveMarket`.
    function setSettler(address newSettler) external onlyOwner {
        if (newSettler == address(0)) revert ZeroAddress();
        settler = newSettler;
    }

    /// @notice Set the minimum bet amount in wei.
    /// @param newMinBetWei Minimum bet amount, in wei.
    function setMinBet(uint256 newMinBetWei) external onlyOwner {
        if (newMinBetWei == 0) revert InvalidParams();
        minBetWei = newMinBetWei;
    }

    /// @notice Set the betting buffer (betting closes resolveTime - buffer).
    /// @param newBufferSeconds Buffer in seconds.
    function setBettingBuffer(uint64 newBufferSeconds) external onlyOwner {
        if (newBufferSeconds == 0) revert InvalidParams();
        bettingBufferSeconds = newBufferSeconds;
    }

    /// @notice Pause user actions (bet/claim/refund).
    function pause() external onlyOwner {
        isPaused = true;
    }

    /// @notice Unpause user actions.
    function unpause() external onlyOwner {
        isPaused = false;
    }

    /// @notice Resolve a market using an FDC proof + decoded attestation payload.
    /// @param marketId Market id to resolve.
    /// @param proof FDC Merkle proof blob.
    /// @param attestationData ABI-encoded `(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)`.
    function resolveMarket(
        uint256 marketId,
        bytes calldata proof,
        bytes calldata attestationData
    ) external onlySettler nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        _updateClosedStatus(market);
        if (market.status != MarketStatus.Open && market.status != MarketStatus.Closed) revert InvalidStatus();
        if (block.timestamp < market.resolveTime) revert TooEarly();

        if (!_verifyAttestation(proof)) revert InvalidAttestation();

        (bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths) = _decodeWeatherAttestation(attestationData);
        if (cityId != market.cityId) revert CityMismatch();
        if (observedTimestamp < market.resolveTime) revert ReadingTooEarly();

        bool outcome = tempTenths >= market.thresholdTenths;
        uint256 winningPool = outcome ? market.yesPool : market.noPool;
        uint256 losingPool = outcome ? market.noPool : market.yesPool;

        if (winningPool == 0) {
            market.status = MarketStatus.Cancelled;
            emit MarketCancelled(marketId);
            return;
        }

        uint256 fee = PayoutMath.feeFromLosingPool(losingPool);
        market.status = MarketStatus.Resolved;
        market.outcome = outcome;
        market.resolvedTempTenths = tempTenths;
        market.observedTimestamp = observedTimestamp;
        market.totalFees = fee;
        accruedFees[market.currency] += fee;

        emit MarketResolved(marketId, outcome, tempTenths, observedTimestamp);
    }

    /// @notice Place a YES/NO bet on a market (native FLR only).
    /// @param marketId Market id to bet on.
    /// @param isYes True for YES, false for NO.
    function placeBet(uint256 marketId, bool isYes) external payable whenNotPaused nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        if (market.currency != address(0)) revert OnlyNativeCurrency();
        if (block.timestamp >= market.bettingDeadline) revert BettingClosed();
        _updateClosedStatus(market);
        if (market.status != MarketStatus.Open) revert InvalidStatus();
        if (msg.value < minBetWei) revert BetTooSmall();

        Position storage pos = positions[marketId][msg.sender];
        if (pos.yesAmount != 0 || pos.noAmount != 0) revert AlreadyBet();

        if (isYes) {
            pos.yesAmount = msg.value;
            market.yesPool += msg.value;
        } else {
            pos.noAmount = msg.value;
            market.noPool += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, isYes, msg.value);
    }

    /// @notice Claim winnings for a resolved market (winner-only).
    /// @param marketId Market id to claim from.
    function claim(uint256 marketId) external whenNotPaused nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        if (market.status != MarketStatus.Resolved) revert NotResolved();

        Position storage pos = positions[marketId][msg.sender];
        if (pos.claimed) revert NothingToClaim();
        pos.claimed = true;

        uint256 stake = market.outcome ? pos.yesAmount : pos.noAmount;
        if (stake == 0) revert NothingToClaim();

        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;

        (uint256 payout, ) = PayoutMath.payoutForWinner(winningPool, losingPool, stake);
        if (payout == 0) revert NothingToClaim();

        (bool ok, ) = msg.sender.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Refund your bet for a cancelled market.
    /// @param marketId Market id to refund from.
    function refund(uint256 marketId) external whenNotPaused nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        if (market.status != MarketStatus.Cancelled) revert NotCancelled();

        Position storage pos = positions[marketId][msg.sender];
        if (pos.claimed) revert NothingToClaim();
        pos.claimed = true;

        uint256 amount = pos.yesAmount + pos.noAmount;
        if (amount == 0) revert NothingToClaim();

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(marketId, msg.sender, amount);
    }

    /// @notice Get a market by id.
    /// @param marketId Market id.
    /// @return Market struct.
    function getMarket(uint256 marketId) external view returns (Market memory) {
        if (marketId >= markets.length) revert InvalidMarket();
        return markets[marketId];
    }

    /// @notice Get a bettor's position for a market.
    /// @param marketId Market id.
    /// @param bettor Bettor address.
    /// @return Position struct.
    function getPosition(uint256 marketId, address bettor) external view returns (Position memory) {
        if (marketId >= markets.length) revert InvalidMarket();
        return positions[marketId][bettor];
    }

    /// @notice Calculate expected payout for a bettor (0 if losing, claimed, or not resolved).
    /// @param marketId Market id.
    /// @param bettor Bettor address.
    /// @return payout Amount claimable if `bettor` is a winner; otherwise 0.
    function calculatePayout(uint256 marketId, address bettor) external view returns (uint256) {
        if (marketId >= markets.length) revert InvalidMarket();
        Market memory market = markets[marketId];
        if (market.status != MarketStatus.Resolved) return 0;

        Position memory pos = positions[marketId][bettor];
        if (pos.claimed) return 0;
        uint256 stake = market.outcome ? pos.yesAmount : pos.noAmount;
        if (stake == 0) return 0;

        uint256 winningPool = market.outcome ? market.yesPool : market.noPool;
        uint256 losingPool = market.outcome ? market.noPool : market.yesPool;

        (uint256 payout, ) = PayoutMath.payoutForWinner(winningPool, losingPool, stake);
        return payout;
    }

    /// @notice Get implied YES/NO prices in basis points (0-10000).
    /// @param marketId Market id.
    /// @return yesPrice YES implied probability in bps.
    /// @return noPrice NO implied probability in bps.
    function getImpliedPrices(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        if (marketId >= markets.length) revert InvalidMarket();
        Market memory market = markets[marketId];
        return PayoutMath.impliedProbabilityBps(market.yesPool, market.noPool);
    }

    function _getMarketStorage(uint256 marketId) internal view returns (Market storage) {
        if (marketId >= markets.length) revert InvalidMarket();
        return markets[marketId];
    }

    function _updateClosedStatus(Market storage market) internal {
        if (market.status == MarketStatus.Open && block.timestamp >= market.bettingDeadline) {
            market.status = MarketStatus.Closed;
        }
    }
}
