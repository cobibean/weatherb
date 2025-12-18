# Epic 3 — FDC Proof Verification Integration

> **Goal:** Integrate Flare Data Connector (FDC) for trustless, verifiable weather data settlement.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Attestation type | **Web2Json** | Weather APIs are Web2; this is the right Flare primitive |
| Verification | **On-chain via Flare's relay** | Standard Flare pattern |
| Data format | **JSON → custom struct decode** | Match attestation payload to our needs |

---

## ⚠️ Get This Answered From User

| Question | Why It Matters | Options |
|----------|----------------|---------|
| **Is Flare FDC live on mainnet?** | Need to verify current status | Research needed |
| **Attestation provider selection?** | Different providers = different trust | Use default / specific provider |
| **What if FDC is down but weather API is up?** | Different failure mode than weather API | Wait / Cancel / Manual override |

---

## Contract Registry Addresses (Implemented)

WeatherB uses `IFlareContractRegistry` to resolve `FdcVerification` on-chain by name.

- **Coston2 + Flare mainnet registry address:** `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- **Source:** `flare-foundation/flare-foundry-periphery-package` (`src/coston2/ContractRegistry.sol`, `src/flare/ContractRegistry.sol`)
- **Verified via read-only RPC calls:**
  - Coston2:
    `cast call --rpc-url https://coston2-api.flare.network/ext/C/rpc 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019 "getContractAddressByName(string)(address)" "FdcVerification"`
  - Flare:
    `cast call --rpc-url https://flare-api.flare.network/ext/C/rpc 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019 "getContractAddressByName(string)(address)" "FdcVerification"`

This value is wired via `.env.example` / `FLARE_CONTRACT_REGISTRY_ADDRESS` and passed to `WeatherMarket` constructor.

---

## Background: How Flare FDC Works

1. **Off-chain request:** Settlement bot requests attestation from Flare attestation providers
2. **Attestation creation:** Provider fetches weather data from API, creates signed attestation
3. **Merkle proof:** Attestation included in Merkle tree, root submitted to Flare relay contract
4. **On-chain verification:** Our contract verifies proof against relay, decodes data, settles market

This gives us **trustless verification** — even if our settler bot is compromised, it can't fake weather data.

---

## Attestation Payload Design

```solidity
// What we need for settlement
struct WeatherAttestation {
    bytes32 cityId;           // Location identifier
    uint64 requestedTime;     // The T we asked for
    uint64 observedTimestamp; // When reading was actually taken
    uint256 tempTenths;       // Temperature in 0.1°F units
    string providerUrl;       // API endpoint used (for audit)
}
```

**Web2Json request format** (what we send to attestation providers):

```json
{
  "attestationType": "0x5765623248736f6e...",
  "sourceId": "0x...",
  "requestBody": {
    "url": "https://api.open-meteo.com/v1/...",
    "postprocessJq": ".hourly.temperature_2m[0]",
    "abi_signature": "(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)"
  }
}
```

---

## Folder Structure

```
contracts/
└── src/
    ├── WeatherMarket.sol
    ├── interfaces/
    │   ├── IWeatherMarket.sol
    │   └── IFlareContractRegistry.sol
    └── verification/
        ├── FDCVerifier.sol        # Verification logic
        └── AttestationDecoder.sol # Decode attestation bytes
```

---

## Contract Integration

```solidity
// verification/FDCVerifier.sol

import {IFlareContractRegistry} from "../interfaces/IFlareContractRegistry.sol";
import {IFdcVerification} from "../interfaces/IFdcVerification.sol";

abstract contract FDCVerifier {
    // Flare contract registry address (fixed per network)
    IFlareContractRegistry public immutable registry;
    
    // Web2Json attestation type hash
    bytes32 public constant WEB2JSON_TYPE = keccak256("Web2Json");
    
    constructor(address _registry) {
        registry = IFlareContractRegistry(_registry);
    }
    
    function _verifyAttestation(
        bytes calldata proof
    ) internal view returns (bool) {
        // Get FDC verification contract from registry
        IFdcVerification fdcVerification = IFdcVerification(
            registry.getContractAddressByName("FdcVerification")
        );
        
        // Verify the Merkle proof
        return fdcVerification.verifyWeb2Json(proof);
    }
    
    function _decodeWeatherAttestation(
        bytes calldata attestationData
    ) internal pure returns (
        bytes32 cityId,
        uint64 observedTimestamp,
        uint256 tempTenths
    ) {
        return abi.decode(attestationData, (bytes32, uint64, uint256));
    }
}
```

### Updated Resolution Function

```solidity
// In WeatherMarket.sol

contract WeatherMarket is IWeatherMarket, FDCVerifier, ReentrancyGuard, Pausable, Ownable {
    
    constructor(address _registry) FDCVerifier(_registry) Ownable(msg.sender) {}
    
    function resolveMarket(
        uint256 marketId,
        bytes calldata proof,
        bytes calldata attestationData
    ) external onlySettler nonReentrant {
        Market storage market = markets[marketId];
        
        require(
            market.status == MarketStatus.Open || 
            market.status == MarketStatus.Closed, 
            "Invalid status"
        );
        require(block.timestamp >= market.resolveTime, "Too early");
        
        // === FDC VERIFICATION ===
        require(_verifyAttestation(proof), "Invalid FDC proof");
        
        // Decode the attestation data
        (
            bytes32 cityId,
            uint64 observedTimestamp,
            uint256 tempTenths
        ) = _decodeWeatherAttestation(attestationData);
        
        // Validate attestation matches this market
        require(cityId == market.cityId, "City mismatch");
        require(observedTimestamp >= market.resolveTime, "Reading too early");
        
        // Compute outcome
        bool outcome = tempTenths >= market.thresholdTenths;
        
        // Update market state
        market.status = MarketStatus.Resolved;
        market.resolvedTempTenths = tempTenths;
        market.observedTimestamp = observedTimestamp;
        market.outcome = outcome;
        
        // Calculate fees
        uint256 losingPool = outcome ? market.noPool : market.yesPool;
        market.totalFees = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
        
        emit MarketResolved(marketId, outcome, tempTenths, observedTimestamp);
    }
}
```

---

## Settler Bot Flow

```typescript
// services/settler/src/resolve.ts

import { prepareAttestationRequest, submitAndWaitForProof } from './fdc';
import { weatherProvider } from '@weatherb/shared/providers';

async function resolveMarket(marketId: string, market: Market) {
  // 1. Get weather reading
  const reading = await weatherProvider.getFirstReadingAtOrAfter(
    market.latitude,
    market.longitude,
    market.resolveTime
  );
  
  // 2. Prepare FDC attestation request
  const attestationRequest = prepareAttestationRequest({
    cityId: market.cityId,
    latitude: market.latitude,
    longitude: market.longitude,
    resolveTime: market.resolveTime,
  });
  
  // 3. Submit to Flare attestation providers and wait for proof
  const { proof, attestationData } = await submitAndWaitForProof(attestationRequest);
  
  // 4. Call contract
  const tx = await weatherMarketContract.resolveMarket(
    marketId,
    proof,
    attestationData
  );
  
  await tx.wait();
  
  console.log(`Market ${marketId} resolved: ${reading.tempF_tenths >= market.thresholdTenths ? 'YES' : 'NO'}`);
}
```

### FDC Client

```typescript
// services/settler/src/fdc.ts

import axios from 'axios';

const FDC_HUB_URL = process.env.FDC_HUB_URL || 'https://fdc-hub.flare.network';

interface AttestationRequest {
  cityId: string;
  latitude: number;
  longitude: number;
  resolveTime: number;
}

export function prepareAttestationRequest(params: AttestationRequest) {
  const weatherUrl = buildWeatherApiUrl(params);
  
  return {
    attestationType: '0x5765623248736f6e00000000000000000000000000000000', // Web2Json
    sourceId: '0x0000000000000000000000000000000000000000000000000000000000000001',
    requestBody: {
      url: weatherUrl,
      postprocessJq: '.hourly.temperature_2m[0] * 10 | floor', // Convert to tenths
      abi_signature: '(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)',
    },
  };
}

export async function submitAndWaitForProof(request: AttestationRequest) {
  // Submit attestation request
  const submitResponse = await axios.post(`${FDC_HUB_URL}/attestation/request`, request);
  const requestId = submitResponse.data.requestId;
  
  // Poll for result (with timeout)
  const maxWait = 120_000; // 2 minutes
  const pollInterval = 5_000; // 5 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const statusResponse = await axios.get(`${FDC_HUB_URL}/attestation/status/${requestId}`);
    
    if (statusResponse.data.status === 'finalized') {
      return {
        proof: statusResponse.data.proof,
        attestationData: statusResponse.data.attestationData,
      };
    }
    
    if (statusResponse.data.status === 'failed') {
      throw new Error(`Attestation failed: ${statusResponse.data.error}`);
    }
    
    await sleep(pollInterval);
  }
  
  throw new Error('Attestation timeout');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Tasks

### 3.1 Research Flare FDC
- [ ] Study Flare FDC documentation
- [ ] Understand Web2Json attestation flow
- [ ] Find contract addresses for Coston2 and mainnet
- [ ] Test attestation request manually

### 3.2 Implement Contract Verification
- [ ] Create `FDCVerifier.sol` abstract contract
- [ ] Implement `_verifyAttestation()` using Flare's verification contract
- [ ] Implement `_decodeWeatherAttestation()`
- [ ] Integrate into `WeatherMarket.sol`

### 3.3 Implement Settler FDC Client
- [ ] Create `fdc.ts` module
- [ ] Implement `prepareAttestationRequest()`
- [ ] Implement `submitAndWaitForProof()`
- [ ] Handle timeout and retry logic

### 3.4 Design Attestation Payload
- [ ] Define exact JSON structure for weather API response
- [ ] Define jq postprocessing to extract temp
- [ ] Define ABI signature for on-chain decoding
- [ ] Test end-to-end with mock data

### 3.5 Handle FDC Failures
- [ ] What if attestation times out? → Retry with backoff
- [ ] What if proof verification fails? → Log, alert, manual review
- [ ] What if FDC network is down? → Different from weather API down

### 3.6 Write Integration Tests
- [ ] Test with mock attestation proofs
- [ ] Test proof rejection for invalid data
- [ ] Test city mismatch detection
- [ ] Test timestamp validation

---

## Flare Network Addresses

| Network | Contract Registry |
|---------|------------------|
| Coston2 (testnet) | `0x...` (research needed) |
| Flare (mainnet) | `0x...` (research needed) |

---

## Error Handling

```solidity
// Custom errors for gas efficiency
error InvalidProof();
error CityMismatch(bytes32 expected, bytes32 got);
error ReadingTooEarly(uint64 marketTime, uint64 readingTime);
error AttestationTimeout();
```

---

## Acceptance Criteria

- [ ] FDC proof verification works on Coston2
- [ ] Invalid proofs are rejected
- [ ] Attestation data correctly decoded
- [ ] City/timestamp validation enforced
- [ ] Settler bot can complete full attestation → resolution flow
- [ ] Appropriate error handling for FDC-specific failures

---

## Dependencies

- **Epic 0:** Foundry setup
- **Epic 2:** `WeatherMarket.sol` contract structure
- **Needed by Epic 4B:** Settlement bot uses FDC client

---

## Estimated Effort

| Task | Effort |
|------|--------|
| FDC research | 4 hours |
| Contract verification | 4 hours |
| Settler FDC client | 6 hours |
| Payload design | 2 hours |
| Error handling | 2 hours |
| Integration tests | 4 hours |
| **Total** | **~22 hours** |

---

## Risks

| Risk | Mitigation |
|------|------------|
| FDC not fully documented | Engage Flare community/Discord |
| Attestation latency too high | Set appropriate timeouts, warn users |
| Proof format changes | Abstract verification behind interface |
| FDC down during critical settlement | Have fallback policy (delay, not fake) |

---

## Resources

- Flare FDC Documentation: https://docs.flare.network/
- Flare Discord (for support)
- Example Web2Json implementations
