# Epic 2 — Smart Contracts (Core)

> **Goal:** Build the core prediction market contract: create markets, place bets, resolve, cancel, claim winnings.

---

## Status (Implemented)

As of 2025-12-18, the Epic 2 contract surface is implemented in:

- `contracts/src/WeatherMarket.sol` (native FLR-only V1)
- `contracts/src/libraries/PayoutMath.sol`
- `contracts/src/interfaces/IWeatherMarket.sol`
- `contracts/test/WeatherMarket.t.sol` (includes a `PayoutMath` fuzz test)
- `contracts/script/Deploy.s.sol`

Notes:
- Settlement is restricted to `onlySettler`.
- Outcome uses `tempTenths >= thresholdTenths` (tie → YES).
- Betting closes at `resolveTime - bettingBufferSeconds` (default 600s).
- Fee is 1% of losing pool.

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | **Single contract** | Simpler for V1, lower gas, easier to reason about |
| Currency design | **`address(0)` = native FLR** | Clean, extensible to ERC20 later |
| Fee model | **1% from losing pool** | Winners get full share, losers pay fee |
| Upgradeability | **Non-upgradeable** | Simpler, more trust, V1 is small scope |
| Framework | **Foundry** | Fast tests, good fuzzing, Solidity-native |
| Min bet | **0.01 FLR (configurable)** | Spam prevention without blocking normal users |
| Max bet | **No max in V1 (configurable later)** | Keep friction low; add per-wallet caps later if needed |
| Betting deadline | **Close 10 minutes before resolve (configurable)** | Reduces timing exploits; adjustable via admin setting |

---

## ✅ User Decisions Locked

- **Min bet:** 0.01 FLR. Store as config so admin can adjust without redeploy (keep contract and admin setting in sync).
- **Max bet:** None for V1. Keep a path to add per-wallet caps later if whale behavior appears.
- **Betting deadline:** 10 minutes before resolve time. Make `bettingBufferMinutes` an admin-tunable setting enforced on-chain.
- **Admin flexibility:** Mirror settings in the admin panel + config table; avoid hardcoding except sane defaults.

> Still pending: clarify cancellation powers (keep question open).

---

## Contract Architecture

```
contracts/
└── src/
    ├── WeatherMarket.sol        # Main contract
    ├── interfaces/
    │   └── IWeatherMarket.sol   # Interface for external calls
    └── libraries/
        └── PayoutMath.sol       # Payout calculation logic
```

---

## Data Structures

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum MarketStatus {
    Open,       // Accepting bets
    Closed,     // Betting closed, awaiting resolution
    Resolved,   // Outcome determined, claims open
    Cancelled   // Refunds available
}

struct Market {
    bytes32 cityId;              // Identifier for city
    uint64 resolveTime;          // Unix timestamp for resolution
    uint64 bettingDeadline;      // When betting closes (resolveTime - buffer)
    uint256 thresholdTenths;     // 853 = 85.3°F
    address currency;            // address(0) = native FLR, else ERC20
    MarketStatus status;
    uint256 yesPool;
    uint256 noPool;
    uint256 totalFees;           // Accumulated fees
    // Resolution data
    uint256 resolvedTempTenths;
    uint64 observedTimestamp;
    bool outcome;                // true = YES won
}

struct Position {
    uint256 yesAmount;
    uint256 noAmount;
    bool claimed;
}
```

---

## Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWeatherMarket {
    // ========== EVENTS ==========
    event MarketCreated(
        uint256 indexed marketId,
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    );
    
    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        bool isYes,
        uint256 amount
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        uint256 resolvedTempTenths,
        uint64 observedTimestamp
    );
    
    event MarketCancelled(uint256 indexed marketId);
    
    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed claimer,
        uint256 amount
    );
    
    event Refunded(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    // ========== ADMIN FUNCTIONS ==========
    function createMarket(
        bytes32 cityId,
        uint64 resolveTime,
        uint256 thresholdTenths,
        address currency
    ) external returns (uint256 marketId);
    
    function cancelMarket(uint256 marketId) external;
    
    function withdrawFees(address token, address recipient) external;
    
    function setSettler(address settler) external;
    
    function pause() external;
    function unpause() external;

    // ========== SETTLER FUNCTIONS ==========
    function resolveMarket(
        uint256 marketId,
        bytes calldata proof,
        bytes calldata attestationData
    ) external;

    // ========== USER FUNCTIONS ==========
    function placeBet(uint256 marketId, bool isYes) external payable;
    
    function claim(uint256 marketId) external;
    
    function refund(uint256 marketId) external;

    // ========== VIEW FUNCTIONS ==========
    function getMarket(uint256 marketId) external view returns (Market memory);
    
    function getPosition(
        uint256 marketId, 
        address bettor
    ) external view returns (Position memory);
    
    function calculatePayout(
        uint256 marketId, 
        address bettor
    ) external view returns (uint256);
    
    function getImpliedPrices(
        uint256 marketId
    ) external view returns (uint256 yesPrice, uint256 noPrice);
}
```

---

## Core Logic

### Payout Calculation

```solidity
// libraries/PayoutMath.sol

library PayoutMath {
    uint256 constant FEE_BPS = 100; // 1% = 100 basis points
    uint256 constant BPS_DENOMINATOR = 10000;

    /**
     * Calculate payout for a winning bettor.
     * 
     * Formula:
     * 1. Take 1% fee from losing pool
     * 2. Distribute remaining losing pool to winners proportionally
     * 3. Winner gets: original bet + (their share of net losing pool)
     *
     * Example:
     * - YES pool: 100 FLR, NO pool: 200 FLR
     * - YES wins
     * - Fee: 200 * 1% = 2 FLR
     * - Net losing pool: 198 FLR
     * - Bettor with 10 FLR on YES gets: 10 + (10/100 * 198) = 29.8 FLR
     */
    function calculateWinnings(
        uint256 winningPool,
        uint256 losingPool,
        uint256 bettorStake
    ) internal pure returns (uint256 payout, uint256 fee) {
        if (winningPool == 0) return (0, 0);
        
        // Calculate fee from losing pool
        fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
        uint256 netLosingPool = losingPool - fee;
        
        // Proportional share of losing pool
        uint256 winningsFromLosers = (netLosingPool * bettorStake) / winningPool;
        
        // Total payout = original stake + winnings
        payout = bettorStake + winningsFromLosers;
    }
    
    /**
     * Calculate implied probability/price.
     * P(YES) = yesPool / (yesPool + noPool)
     * Returns value in basis points (0-10000)
     */
    function getImpliedProbability(
        uint256 yesPool,
        uint256 noPool
    ) internal pure returns (uint256 yesBps, uint256 noBps) {
        uint256 total = yesPool + noPool;
        if (total == 0) return (5000, 5000); // 50/50 default
        
        yesBps = (yesPool * BPS_DENOMINATOR) / total;
        noBps = BPS_DENOMINATOR - yesBps;
    }
}
```

### One Bet Per Wallet Enforcement

```solidity
function placeBet(uint256 marketId, bool isYes) external payable nonReentrant whenNotPaused {
    Market storage market = markets[marketId];
    Position storage pos = positions[marketId][msg.sender];
    
    require(market.status == MarketStatus.Open, "Market not open");
    require(block.timestamp < market.bettingDeadline, "Betting closed");
    require(msg.value > 0, "Bet amount required");
    
    // CRITICAL: One bet per wallet per market
    require(pos.yesAmount == 0 && pos.noAmount == 0, "Already bet on this market");
    
    if (isYes) {
        pos.yesAmount = msg.value;
        market.yesPool += msg.value;
    } else {
        pos.noAmount = msg.value;
        market.noPool += msg.value;
    }
    
    emit BetPlaced(marketId, msg.sender, isYes, msg.value);
}
```

### Resolution Logic

```solidity
function resolveMarket(
    uint256 marketId,
    bytes calldata proof,
    bytes calldata attestationData
) external onlySettler nonReentrant {
    Market storage market = markets[marketId];
    
    require(market.status == MarketStatus.Open || market.status == MarketStatus.Closed, "Invalid status");
    require(block.timestamp >= market.resolveTime, "Too early to resolve");
    
    // Verify FDC proof (see Epic 3)
    require(_verifyProof(proof, attestationData), "Invalid proof");
    
    // Decode attestation data
    (uint256 tempTenths, uint64 observedTs) = _decodeAttestation(attestationData);
    
    // Enforce "first reading at or after T"
    require(observedTs >= market.resolveTime, "Reading too early");
    
    // Compute outcome: temp >= threshold -> YES wins
    bool outcome = tempTenths >= market.thresholdTenths;
    
    // Update market
    market.status = MarketStatus.Resolved;
    market.resolvedTempTenths = tempTenths;
    market.observedTimestamp = observedTs;
    market.outcome = outcome;
    
    // Calculate and store total fees
    uint256 losingPool = outcome ? market.noPool : market.yesPool;
    market.totalFees = (losingPool * 100) / 10000; // 1%
    
    emit MarketResolved(marketId, outcome, tempTenths, observedTs);
}
```

---

## Tasks

### 2.1 Project Setup
- [ ] Initialize Foundry in `contracts/`
- [ ] Configure `foundry.toml` for Flare chain
- [ ] Add OpenZeppelin contracts (ReentrancyGuard, Pausable, Ownable)
- [ ] Set up remappings

### 2.2 Implement Core Contract
- [ ] Create `WeatherMarket.sol` with full struct definitions
- [ ] Implement `createMarket()` (admin only)
- [ ] Implement `placeBet()` with one-bet-per-wallet enforcement
- [ ] Implement `resolveMarket()` stub (FDC integration in Epic 3)
- [ ] Implement `cancelMarket()` and `refund()`
- [ ] Implement `claim()`
- [ ] Implement `withdrawFees()`

### 2.3 Implement Access Control
- [ ] `onlyAdmin` modifier for market creation/cancellation
- [ ] `onlySettler` modifier for resolution
- [ ] `setSettler()` function for admin
- [ ] Emergency pause functionality

### 2.4 Implement PayoutMath Library
- [ ] `calculateWinnings()` function
- [ ] `getImpliedProbability()` function
- [ ] Thorough documentation

### 2.5 Write Unit Tests
- [ ] Test: Market creation with valid params
- [ ] Test: Market creation with invalid params (revert)
- [ ] Test: Single bet placement
- [ ] Test: Second bet rejection (one per wallet)
- [ ] Test: Bet after deadline (revert)
- [ ] Test: Payout calculation scenarios
- [ ] Test: Resolution updates state correctly
- [ ] Test: Claim distributes correct amounts
- [ ] Test: Refund on cancellation
- [ ] Test: Fee withdrawal
- [ ] Test: Pause functionality
- [ ] Fuzz test: Payout math with random pools/bets

### 2.6 Gas Optimization
- [ ] Review storage layout
- [ ] Use `uint64` for timestamps
- [ ] Pack struct variables efficiently
- [ ] Benchmark common operations

### 2.7 Deploy to Testnet
- [ ] Create deployment script
- [ ] Deploy to Coston2
- [ ] Verify on explorer
- [ ] Test basic operations manually

---

## Test Scenarios

```solidity
// test/WeatherMarket.t.sol

function test_PayoutCalculation_YESWins() public {
    // Setup: 100 FLR on YES, 200 FLR on NO
    // Bettor A: 50 FLR on YES
    // Bettor B: 50 FLR on YES
    // YES wins
    
    // Expected:
    // Losing pool: 200 FLR
    // Fee: 2 FLR (1%)
    // Net losing pool: 198 FLR
    // Bettor A gets: 50 + (50/100 * 198) = 50 + 99 = 149 FLR
    // Bettor B gets: 50 + (50/100 * 198) = 50 + 99 = 149 FLR
}

function test_OneBetPerWallet() public {
    vm.startPrank(alice);
    market.placeBet{value: 1 ether}(marketId, true);
    
    // Second bet should revert
    vm.expectRevert("Already bet on this market");
    market.placeBet{value: 1 ether}(marketId, false);
    vm.stopPrank();
}

function test_BettingClosesBeforeResolve() public {
    // Fast forward to after betting deadline
    vm.warp(market.bettingDeadline + 1);
    
    vm.expectRevert("Betting closed");
    market.placeBet{value: 1 ether}(marketId, true);
}

function test_ThresholdTieResolvesToYES() public {
    // If temp == threshold exactly, outcome should be YES
    // temp: 850 (85.0°F), threshold: 850
    // 850 >= 850 = true = YES wins
}
```

---

## Contract Configuration

```solidity
// Constants
uint256 public constant FEE_BPS = 100;        // 1%
uint256 public constant MIN_BET = 0.01 ether;        // Minimum bet (admin-configurable default)
uint64 public constant BETTING_BUFFER = 600;         // Close betting 10 minutes before resolve

// State
address public admin;
address public settler;
uint256 public marketCount;
mapping(uint256 => Market) public markets;
mapping(uint256 => mapping(address => Position)) public positions;
mapping(address => uint256) public feeBalance; // Per-currency fee accumulation
```

---

## Gas Estimates

| Operation | Estimated Gas |
|-----------|---------------|
| createMarket | ~100,000 |
| placeBet | ~80,000 |
| resolveMarket | ~120,000 |
| claim | ~50,000 |
| refund | ~40,000 |

---

## Acceptance Criteria

- [ ] Contract compiles without warnings
- [ ] All tests pass with `forge test`
- [ ] One bet per wallet strictly enforced
- [ ] Payout math is accurate (verified with multiple scenarios)
- [ ] Fee calculation is correct (1% from losing pool)
- [ ] Only settler can resolve markets
- [ ] Only admin can create/cancel markets
- [ ] Deployed and verified on Coston2

---

## Dependencies

- **Epic 0:** Foundry setup, shared types
- **Blocks Epic 3:** FDC verification logic plugs into `resolveMarket()`
- **Blocks Epic 4:** Settler calls `resolveMarket()`, scheduler calls `createMarket()`
- **Blocks Epic 5:** Frontend reads market data, calls `placeBet()` and `claim()`

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Foundry setup | 1 hour |
| Core contract | 8 hours |
| Access control | 2 hours |
| PayoutMath library | 2 hours |
| Unit tests | 6 hours |
| Fuzz tests | 2 hours |
| Gas optimization | 2 hours |
| Testnet deployment | 2 hours |
| **Total** | **~25 hours** |

---

## Security Considerations

- **Reentrancy:** Use OpenZeppelin's `ReentrancyGuard`
- **Integer overflow:** Solidity 0.8+ has built-in checks
- **Access control:** Strict `onlyAdmin` and `onlySettler` modifiers
- **Front-running:** Low-value markets reduce incentive; consider commit-reveal later
- **Timestamp manipulation:** Using external FDC timestamps, not block.timestamp for resolution
