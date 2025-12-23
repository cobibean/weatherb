# Epic 10 — Security + Hardening

> **Goal:** Harden the system against attacks, accidents, and failures. Not an easy rug, not a self-rug.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Upgradeability | **Non-upgradeable** | More trust, simpler, V1 is limited scope |
| Audit | **Internal review + tools** | Full audit for V2 if traction |
| Admin powers | **Limited, logged** | Can pause/cancel, cannot steal funds |
| Bug bounty | **None for V1 (SECURITY.md inbox only)** | Keep scope tight; revisit if volume grows |
| Admin custody | **Single admin wallet for V1; plan multi-sig trigger later** | Lower complexity now; move to 2-of-3 when TVL/volume justifies |

---

## ⚠️ Get This Answered From User

| Question | Why It Matters | Options |
|----------|----------------|---------|
| **Timelock on admin actions?** | Reduce key compromise risk | No / 6 hours / 24 hours |
| **Multi-sig trigger timing?** | Define when to upgrade custody | At launch / After TVL threshold / Later |

---

## Contract Security

### Standard Protections

```solidity
// Already included in Epic 2 contract

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WeatherMarket is ReentrancyGuard, Pausable, Ownable {
    // All state-changing functions use nonReentrant
    // Solidity 0.8+ handles overflow/underflow
}
```

### Custom Security Measures

```solidity
// Access control
modifier onlySettler() {
    require(msg.sender == settler, "Not settler");
    _;
}

modifier onlyAdmin() {
    require(msg.sender == owner(), "Not admin");
    _;
}

// Prevent duplicate resolution
function resolveMarket(...) external onlySettler nonReentrant {
    require(market.status != MarketStatus.Resolved, "Already resolved");
    require(market.status != MarketStatus.Cancelled, "Already cancelled");
    // ...
}

// Ensure correct claim state
function claim(uint256 marketId) external nonReentrant {
    require(market.status == MarketStatus.Resolved, "Not resolved");
    require(!position.claimed, "Already claimed");
    
    // Mark claimed BEFORE transfer (CEI pattern)
    position.claimed = true;
    
    // Calculate and transfer
    uint256 payout = _calculatePayout(marketId, msg.sender);
    require(payout > 0, "No winnings");
    
    (bool success, ) = msg.sender.call{value: payout}("");
    require(success, "Transfer failed");
}
```

### Potential Attack Vectors

| Vector | Risk | Mitigation |
|--------|------|------------|
| Reentrancy | High | ReentrancyGuard + CEI pattern |
| Integer overflow | Medium | Solidity 0.8+ built-in |
| Front-running bets | Low | Small stakes reduce incentive |
| Settler key compromise | High | Timelock (optional), monitoring |
| Admin key compromise | High | Limited powers, multi-sig (optional) |
| Weather data manipulation | Medium | FDC provides independent verification |
| Oracle delay attacks | Medium | Use observedTimestamp >= resolveTime check |

---

## Emergency Controls

### Pause System

```solidity
// Pause betting (markets stay open for claims)
function pauseBetting() external onlyAdmin {
    _pause();
    emit BettingPaused(block.timestamp);
}

function unpauseBetting() external onlyAdmin {
    _unpause();
    emit BettingUnpaused(block.timestamp);
}

// Emergency cancel with refunds
function emergencyCancel(uint256 marketId) external onlyAdmin {
    Market storage market = markets[marketId];
    require(market.status == MarketStatus.Open, "Not open");
    
    market.status = MarketStatus.Cancelled;
    emit MarketCancelled(marketId, "Emergency admin action");
}
```

### Admin Power Limits

Admin **CAN**:
- Pause betting
- Cancel markets (before resolution)
- Change settler address
- Withdraw accumulated fees

Admin **CANNOT**:
- Resolve markets (only settler)
- Steal bet funds
- Change market outcomes after resolution
- Retroactively change bet amounts

---

## Rate Limits & Spam Prevention

### Contract Level

```solidity
// Minimum bet to prevent dust spam
uint256 public constant MIN_BET = 0.01 ether;

function placeBet(uint256 marketId, bool isYes) external payable {
    require(msg.value >= MIN_BET, "Bet too small");
    // ...
}
```

### API Level

```typescript
// Rate limit voting/suggestions
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for');
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return Response.json({ error: 'Rate limited' }, { status: 429 });
  }
  
  // Continue...
}
```

---

## Monitoring & Alerting

### Critical Alerts (Immediate)

- Settlement transaction reverted
- Provider down > 5 minutes
- Settler wallet low on gas
- Large withdrawal (> X FLR)
- Indexer lag > 50 blocks

### Warning Alerts (Check within hours)

- Unusual betting pattern
- High gas prices (delay non-urgent txs)
- Settlement taking > 5 minutes

### Alert Implementation

```typescript
// packages/shared/src/alerts.ts

export async function criticalAlert(message: string, data?: Record<string, any>) {
  logger.error({ ...data }, message);
  
  // Discord (immediate)
  await sendDiscordAlert('🚨 CRITICAL: ' + message);
  
  // Email
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: '🚨 WeatherB Critical Alert',
    text: `${message}\n\n${JSON.stringify(data, null, 2)}`,
  });
}
```

---

## Security Checklist

### Pre-Launch

- [ ] All functions have appropriate access control
- [ ] ReentrancyGuard on all state-changing external functions
- [ ] CEI pattern followed (Checks-Effects-Interactions)
- [ ] No floating pragma (locked to specific version)
- [ ] Events emitted for all state changes
- [ ] Slither/Mythril static analysis run
- [ ] Edge cases tested (empty pools, threshold ties, etc.)
- [ ] Gas limits reasonable for all functions
- [ ] Settler and admin addresses correct
- [ ] Contract verified on explorer

### Operational

- [ ] Monitoring alerts configured
- [ ] Admin wallet secured (hardware wallet recommended)
- [ ] Settler key stored securely (not in code)
- [ ] Backup procedure documented
- [ ] Incident response plan documented

---

## Tasks

### 10.1 Contract Hardening
- [ ] Review all access modifiers
- [ ] Add explicit checks for edge cases
- [ ] Run Slither static analysis
- [ ] Run Mythril (if available)
- [ ] Add comprehensive NatSpec documentation

### 10.2 Fuzz Testing
- [ ] Fuzz payout calculations with random values
- [ ] Fuzz pool math with extreme values
- [ ] Fuzz timestamp edge cases
- [ ] Test with 0 values in pools

### 10.3 Rate Limiting
- [ ] Add MIN_BET to contract
- [ ] Add API rate limiting (Upstash or similar)
- [ ] Test rate limits work correctly

### 10.4 Monitoring Setup
- [ ] Configure critical alerts
- [ ] Configure warning alerts
- [ ] Test alert delivery
- [ ] Set up on-call rotation (if team)

### 10.5 Documentation
- [ ] Document admin powers and limits
- [ ] Document incident response steps
- [ ] Document key management procedures
- [ ] Create `SECURITY.md` with vulnerability disclosure instructions (use admin email as inbox for now)

### 10.7 Next.js Middleware Migration
- [ ] Resolve middleware deprecation warning (`apps/web/src/middleware.ts`)
- [ ] Next.js 16+ deprecates `middleware.ts` convention in favor of `proxy.ts`
- [ ] Migrate admin auth middleware to new proxy pattern
- [ ] Update `next.config.mjs` if needed
- [ ] Test admin route protection still works after migration

### 10.6 Pre-Launch Review
- [ ] Complete security checklist
- [ ] Peer review of all contracts
- [ ] Test emergency procedures
- [ ] Verify all addresses correct

---

## Threat Model

### Settler Bot Compromise

**Scenario:** Attacker gains control of settler private key.

**Impact:** Could resolve markets incorrectly? **NO** — FDC proofs must be valid, so attacker can only:
- Delay settlement (DoS)
- Waste gas on invalid proofs

**Mitigation:**
- Settler can only call `resolveMarket()` with valid FDC proof
- Monitor for unusual activity
- Have backup settler key ready

### Weather Provider Manipulation

**Scenario:** Attacker manipulates weather API responses.

**Impact:** Could affect market outcomes? **Partially** — FDC attestation uses independent fetch, but:
- If same API used by FDC providers, manipulation possible
- Low-value markets reduce incentive

**Mitigation:**
- Use reputable weather providers
- Consider multi-source verification (V2)
- Monitor for anomalies

### Admin Key Compromise

**Scenario:** Attacker gains control of admin wallet.

**Impact:**
- Could pause system (DoS)
- Could cancel markets (user inconvenience)
- Could change settler address (redirect resolution)
- **CANNOT** steal funds directly

**Mitigation:**
- Use hardware wallet for admin
- Plan to switch to 2-of-3 multi-sig once TVL/daily volume crosses a defined threshold (TBD)
- Limit powers to necessary minimum
- All admin actions logged

---

## Acceptance Criteria

- [ ] Slither reports no high/medium issues
- [ ] All fuzz tests pass with 10,000 runs
- [ ] Rate limits prevent spam
- [ ] Critical alerts fire correctly
- [ ] Security checklist 100% complete
- [ ] Admin powers documented and limited
- [ ] Incident response plan exists

---

## Dependencies

- **Epic 2:** Contract must exist to harden
- **All Epics:** Security review of all components

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Contract hardening | 4 hours |
| Fuzz testing | 4 hours |
| Rate limiting | 2 hours |
| Monitoring setup | 3 hours |
| Documentation | 3 hours |
| Pre-launch review | 4 hours |
| **Total** | **~20 hours** |

---

## Future Considerations (V2+)

- Full third-party audit
- Multi-sig admin once TVL/volume justifies upgrade
- Timelock on critical changes
- On-chain governance
- Multiple weather data sources for settlement

