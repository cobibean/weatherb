// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IWeatherMarket} from "./interfaces/IWeatherMarket.sol";

/// @title WeatherMarketV2
/// @notice Upgradeable prediction market for temperature outcomes on Flare
/// @dev UUPS upgradeable pattern. Settlement is trusted to the settler address.
/// @custom:oz-upgrades-from WeatherMarket
contract WeatherMarketV2 is Initializable, UUPSUpgradeable, IWeatherMarket {
    // ============ Errors ============
    error NotOwner();
    error NotSettler();
    error Paused();
    error InvalidMarket();
    error InvalidStatus();
    error BettingClosed();
    error BetTooSmall();
    error TooEarly();
    error OnlyNativeCurrency();
    error TransferFailed();
    error NotResolved();
    error NotCancelled();
    error NothingToClaim();
    error InvalidParams();
    error ZeroAddress();
    error FeeTooHigh();

    // ============ Events ============
    // Config change events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SettlerUpdated(address indexed previousSettler, address indexed newSettler);
    event MinBetUpdated(uint256 previousMinBet, uint256 newMinBet);
    event BettingBufferUpdated(uint64 previousBuffer, uint64 newBuffer);
    event FeeBpsUpdated(uint256 previousFeeBps, uint256 newFeeBps);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event Upgraded(address indexed implementation);

    // ============ Constants ============
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MAX_FEE_BPS = 1000; // Max 10% fee
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // ============ Storage ============
    // Slot 0: Packed addresses
    address public owner;
    address public settler;
    
    // Slot 1: Packed config (bool + uint64 + uint64 = 1 + 8 + 8 = 17 bytes)
    bool public isPaused;
    uint64 public bettingBufferSeconds;
    uint64 private __gap_slot1; // Reserved for future use
    
    // Slot 2: Min bet
    uint256 public minBetWei;
    
    // Slot 3: Fee in basis points (mutable!)
    uint256 public feeBps;
    
    // Slot 4: Reentrancy guard
    uint256 private _status;

    // Dynamic storage
    Market[] private markets;
    mapping(uint256 => mapping(address => Position)) private positions;
    mapping(address => uint256) public accruedFees;

    // ============ Modifiers ============
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

    // ============ Initializer ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract (replaces constructor for upgradeable)
    /// @param _owner Initial owner address
    /// @param _settler Initial settler address
    function initialize(address _owner, address _settler) public initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_settler == address(0)) revert ZeroAddress();
        
        owner = _owner;
        settler = _settler;
        bettingBufferSeconds = 600; // 10 minutes default
        minBetWei = 0.01 ether;
        feeBps = 100; // 1% default
        _status = _NOT_ENTERED;
        
        emit OwnershipTransferred(address(0), _owner);
        emit SettlerUpdated(address(0), _settler);
    }

    // ============ UUPS Upgrade Authorization ============
    /// @notice Only owner can upgrade the contract
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit Upgraded(newImplementation);
    }

    // ============ Admin Functions ============
    
    /// @notice Transfer ownership to a new address
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Set the settler address
    /// @param newSettler Address that can call resolveMarket
    function setSettler(address newSettler) external onlyOwner {
        if (newSettler == address(0)) revert ZeroAddress();
        address oldSettler = settler;
        settler = newSettler;
        emit SettlerUpdated(oldSettler, newSettler);
    }

    /// @notice Set the protocol fee in basis points
    /// @param newFeeBps Fee in basis points (100 = 1%, max 1000 = 10%)
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFeeBps = feeBps;
        feeBps = newFeeBps;
        emit FeeBpsUpdated(oldFeeBps, newFeeBps);
    }

    /// @notice Set the minimum bet amount
    /// @param newMinBetWei Minimum bet in wei
    function setMinBet(uint256 newMinBetWei) external onlyOwner {
        if (newMinBetWei == 0) revert InvalidParams();
        uint256 oldMinBet = minBetWei;
        minBetWei = newMinBetWei;
        emit MinBetUpdated(oldMinBet, newMinBetWei);
    }

    /// @notice Set the betting buffer
    /// @param newBufferSeconds Seconds before resolveTime when betting closes
    function setBettingBuffer(uint64 newBufferSeconds) external onlyOwner {
        if (newBufferSeconds == 0) revert InvalidParams();
        uint64 oldBuffer = bettingBufferSeconds;
        bettingBufferSeconds = newBufferSeconds;
        emit BettingBufferUpdated(oldBuffer, newBufferSeconds);
    }

    /// @notice Pause user actions (bet/claim/refund)
    function pause() external onlyOwner {
        isPaused = true;
        emit ContractPaused(msg.sender);
    }

    /// @notice Unpause user actions
    function unpause() external onlyOwner {
        isPaused = false;
        emit ContractUnpaused(msg.sender);
    }

    /// @notice Create a new market
    /// @param cityId City identifier (bytes32)
    /// @param resolveTime Unix timestamp when market can be resolved
    /// @param thresholdTenths Temperature threshold in 0.1°F units
    /// @param currency Currency address (must be address(0) for FLR in V1)
    /// @return marketId The newly created market id
    function createMarket(
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    ) external onlyOwner returns (uint256 marketId) {
        if (currency != address(0)) revert OnlyNativeCurrency();
        if (resolveTime <= block.timestamp) revert InvalidParams();
        
        uint64 currentTime = uint64(block.timestamp);
        if (resolveTime <= currentTime + bettingBufferSeconds) revert InvalidParams();
        if (thresholdTenths == 0) revert InvalidParams();
        if (cityId == bytes32(0)) revert InvalidParams();

        uint64 bettingDeadline = resolveTime - bettingBufferSeconds;
        
        // Gas optimization: create in memory first
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
        
        // Gas optimization: unchecked for array length - 1
        unchecked {
            marketId = markets.length - 1;
        }
        
        emit MarketCreated(marketId, cityId, resolveTime, thresholdTenths, currency);
    }

    /// @notice Cancel a market (owner)
    /// @param marketId Market id to cancel
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage market = _getMarketStorage(marketId);
        _updateClosedStatus(market);
        
        MarketStatus status = market.status;
        if (status == MarketStatus.Resolved || status == MarketStatus.Cancelled) {
            revert InvalidStatus();
        }
        
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Cancel a market (settler - after failed resolution attempts)
    /// @param marketId Market id to cancel
    function cancelMarketBySettler(uint256 marketId) external onlySettler {
        Market storage market = _getMarketStorage(marketId);
        _updateClosedStatus(market);
        
        MarketStatus status = market.status;
        if (status == MarketStatus.Resolved || status == MarketStatus.Cancelled) {
            revert InvalidStatus();
        }
        if (block.timestamp < market.resolveTime) revert TooEarly();
        
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(marketId);
    }

    /// @notice Withdraw accumulated protocol fees
    /// @param token Token address (must be address(0) for FLR)
    /// @param recipient Recipient address
    function withdrawFees(address token, address recipient) external onlyOwner nonReentrant {
        if (token != address(0)) revert OnlyNativeCurrency();
        if (recipient == address(0)) revert ZeroAddress();
        
        uint256 amount = accruedFees[token];
        if (amount == 0) revert NothingToClaim();
        
        accruedFees[token] = 0;
        
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        
        emit FeesWithdrawn(token, recipient, amount);
    }

    // ============ Settler Functions ============

    /// @notice Resolve a market with temperature data
    /// @param marketId Market id to resolve
    /// @param tempTenths Observed temperature in 0.1°F units
    /// @param observedTimestamp When the temperature was observed
    function resolveMarket(
        uint256 marketId,
        uint256 tempTenths,
        uint64 observedTimestamp
    ) external onlySettler nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        _updateClosedStatus(market);
        
        MarketStatus status = market.status;
        if (status != MarketStatus.Open && status != MarketStatus.Closed) {
            revert InvalidStatus();
        }
        if (block.timestamp < market.resolveTime) revert TooEarly();
        if (observedTimestamp < market.resolveTime) revert TooEarly();

        bool outcome = tempTenths >= market.thresholdTenths;
        uint256 winningPool = outcome ? market.yesPool : market.noPool;
        uint256 losingPool = outcome ? market.noPool : market.yesPool;

        // Auto-cancel if no winners
        if (winningPool == 0) {
            market.status = MarketStatus.Cancelled;
            emit MarketCancelled(marketId);
            return;
        }

        // Calculate fee using current feeBps
        uint256 fee = _calculateFee(losingPool);
        
        market.status = MarketStatus.Resolved;
        market.outcome = outcome;
        market.resolvedTempTenths = tempTenths;
        market.observedTimestamp = observedTimestamp;
        market.totalFees = fee;
        
        // Gas optimization: unchecked for fee addition (can't overflow)
        unchecked {
            accruedFees[market.currency] += fee;
        }

        emit MarketResolved(marketId, outcome, tempTenths, observedTimestamp);
    }

    // ============ User Functions ============

    /// @notice Place a bet on YES or NO
    /// @dev Users CAN bet multiple times on the same market (accumulates)
    /// @param marketId Market id to bet on
    /// @param isYes True for YES, false for NO
    function placeBet(uint256 marketId, bool isYes) external payable whenNotPaused nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        
        if (market.currency != address(0)) revert OnlyNativeCurrency();
        if (block.timestamp >= market.bettingDeadline) revert BettingClosed();
        
        _updateClosedStatus(market);
        if (market.status != MarketStatus.Open) revert InvalidStatus();
        if (msg.value < minBetWei) revert BetTooSmall();

        Position storage pos = positions[marketId][msg.sender];
        
        // NO AlreadyBet check - users can bet multiple times!
        // Bets accumulate on the same side or both sides
        
        if (isYes) {
            // Gas optimization: unchecked for amount additions
            unchecked {
                pos.yesAmount += msg.value;
                market.yesPool += msg.value;
            }
        } else {
            unchecked {
                pos.noAmount += msg.value;
                market.noPool += msg.value;
            }
        }

        emit BetPlaced(marketId, msg.sender, isYes, msg.value);
    }

    /// @notice Claim winnings from a resolved market
    /// @param marketId Market id to claim from
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

        uint256 payout = _calculatePayout(winningPool, losingPool, stake);
        if (payout == 0) revert NothingToClaim();

        (bool ok, ) = msg.sender.call{value: payout}("");
        if (!ok) revert TransferFailed();
        
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /// @notice Refund bet from a cancelled market
    /// @param marketId Market id to refund from
    function refund(uint256 marketId) external whenNotPaused nonReentrant {
        Market storage market = _getMarketStorage(marketId);
        if (market.status != MarketStatus.Cancelled) revert NotCancelled();

        Position storage pos = positions[marketId][msg.sender];
        if (pos.claimed) revert NothingToClaim();
        pos.claimed = true;

        // Refund both YES and NO bets
        uint256 amount;
        unchecked {
            amount = pos.yesAmount + pos.noAmount;
        }
        if (amount == 0) revert NothingToClaim();

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        
        emit Refunded(marketId, msg.sender, amount);
    }

    // ============ View Functions ============

    /// @notice Get market by id
    function getMarket(uint256 marketId) external view returns (Market memory) {
        if (marketId >= markets.length) revert InvalidMarket();
        return markets[marketId];
    }

    /// @notice Get total market count
    function getMarketCount() external view returns (uint256 count) {
        return markets.length;
    }

    /// @notice Get user position for a market
    function getPosition(uint256 marketId, address bettor) external view returns (Position memory) {
        if (marketId >= markets.length) revert InvalidMarket();
        return positions[marketId][bettor];
    }

    /// @notice Calculate expected payout for a bettor
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

        return _calculatePayout(winningPool, losingPool, stake);
    }

    /// @notice Get implied YES/NO prices in basis points
    function getImpliedPrices(uint256 marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        if (marketId >= markets.length) revert InvalidMarket();
        Market memory market = markets[marketId];
        
        uint256 total = market.yesPool + market.noPool;
        if (total == 0) return (5_000, 5_000); // 50/50 when empty
        
        yesPrice = (market.yesPool * BPS_DENOMINATOR) / total;
        noPrice = BPS_DENOMINATOR - yesPrice;
    }

    /// @notice Get contract version
    function version() external pure returns (string memory) {
        return "2.0.0";
    }

    // ============ Internal Functions ============

    function _getMarketStorage(uint256 marketId) internal view returns (Market storage) {
        if (marketId >= markets.length) revert InvalidMarket();
        return markets[marketId];
    }

    function _updateClosedStatus(Market storage market) internal {
        if (market.status == MarketStatus.Open && block.timestamp >= market.bettingDeadline) {
            market.status = MarketStatus.Closed;
        }
    }

    /// @notice Calculate fee from losing pool using current feeBps
    function _calculateFee(uint256 losingPool) internal view returns (uint256) {
        return (losingPool * feeBps) / BPS_DENOMINATOR;
    }

    /// @notice Calculate payout for a winner
    function _calculatePayout(
        uint256 winningPool,
        uint256 losingPool,
        uint256 stake
    ) internal view returns (uint256 payout) {
        if (winningPool == 0 || stake == 0) return 0;
        
        uint256 fee = _calculateFee(losingPool);
        uint256 netLosingPool;
        
        unchecked {
            netLosingPool = losingPool - fee;
        }
        
        uint256 winningsFromLosers = (netLosingPool * stake) / winningPool;
        
        unchecked {
            payout = stake + winningsFromLosers;
        }
    }

    // ============ Gap for Future Storage ============
    uint256[44] private __gap;
}
