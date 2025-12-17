# Epic 1 — Weather Provider Research + Adapter Layer

> **Goal:** Select a weather data provider for V1 and build an abstraction layer that makes switching providers painless.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary provider | **MET Norway (api.met.no)** | Free, high-quality global forecasts with nowcast (~5m cadence) |
| Fallback provider | **NOAA/NWS (api.weather.gov, US-only)** | Free, solid alerts + forecast grids; polite rate limits |
| Backup provider (dev/test only) | **Open-Meteo** | Non-commercial free tier; keep for local testing |
| Caching | **Redis with 60–300s TTL** | Reduce rate-limit risk, reproducible resolve inputs |
| Fallback strategy | **Priority list + health-based failover** | Automatically switch when a provider is degraded |

---

## ✅ User Decisions Locked

- **Budget:** Free-only; avoid paid tiers for V1.
- **Provider stack:** Primary MET Norway; fallback NOAA/NWS for US; Open-Meteo only for dev/testing.
- **Normalization:** All providers must map into `{ temp, precip, wind, obs_time/forecast_time, lat/lon, source, confidence }`.
- **Reliability:** Add `sourcePriority` and `sourceHealth` flags so the system auto-fails over when a provider degrades.
- **Politeness:** Send a real `User-Agent` (app name + contact) to MET Norway; cache aggressively and use retry/backoff for all calls.

---

## Provider Comparison (To Be Completed)

| Provider | Cost | Update Freq | Coverage | "First at/after T" Support | Notes |
|----------|------|-------------|----------|---------------------------|-------|
| MET Norway (api.met.no) | Free | Nowcast ~5 min | Global | ✅ Nowcast gives near-term readings | Must include real User-Agent |
| NOAA/NWS (api.weather.gov) | Free | ~5-15 min | US-only | ✅ Forecast grid/observations | Implicit polite rate limits; cache |
| Open-Meteo | Free (non-commercial) | Hourly | Global | ❓ Hourly only | Use for dev/test; upgrade if commercial |

---

## Provider Interface

```typescript
// packages/shared/src/types/provider.ts

export interface WeatherReading {
  tempF_tenths: number;         // 853 = 85.3°F
  observedTimestamp: number;    // Unix timestamp of observation
  source: string;               // Provider name for audit trail
}

export interface ProviderHealth {
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  lastCheck: number;
  errorMessage?: string;
}

export interface WeatherProvider {
  readonly name: string;
  
  /**
   * Get forecasted temperature for a location at a future time.
   * Used for setting market thresholds.
   */
  getForecast(
    latitude: number,
    longitude: number,
    timestamp: number
  ): Promise<number>; // Returns tempF_tenths
  
  /**
   * Get the first actual temperature reading at or after the given time.
   * Used for market settlement.
   * 
   * CRITICAL: Must return the FIRST reading >= timestamp, not interpolated.
   */
  getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number
  ): Promise<WeatherReading>;
  
  /**
   * Check if the provider API is responding normally.
   */
  healthCheck(): Promise<ProviderHealth>;
}
```

---

## Folder Structure

```
packages/
└── shared/
    └── src/
        └── providers/
            ├── index.ts                 # Export factory
            ├── interface.ts             # WeatherProvider interface
            ├── met-no.ts                # MET Norway adapter
            ├── nws.ts                   # NOAA/NWS adapter
            ├── open-meteo.ts            # Dev/testing adapter
            ├── cached-provider.ts       # Caching wrapper
            └── fallback-provider.ts     # Fallback wrapper
```

---

## Tasks

### 1.1 Define Provider Interface
- [ ] Create `interface.ts` with `WeatherProvider` type
- [ ] Define `WeatherReading` and `ProviderHealth` types
- [ ] Document the "first reading at/after T" requirement clearly

### 1.2 Implement MET Norway Adapter
- [ ] Use Nowcast product for near-term readings (~5 min cadence)
- [ ] Add required User-Agent header (app + contact email)
- [ ] Implement `getForecast()` and `getFirstReadingAtOrAfter()` mapping to normalized schema
- [ ] Implement `healthCheck()` with latency + error tracking
- [ ] Write unit tests with mocked responses

### 1.3 Implement NOAA/NWS Adapter (US-only fallback)
- [ ] Use forecast grid/observation endpoints
- [ ] Implement polite caching/backoff to respect implicit limits
- [ ] Implement `healthCheck()`
- [ ] Write unit tests

### 1.4 Implement Open-Meteo Adapter (dev/testing)
- [ ] Keep for local/dev usage; document non-commercial terms
- [ ] Implement basic forecast + first-reading mapping (hourly limits noted)
- [ ] Write unit tests

### 1.5 Build Caching Layer
- [ ] Create `CachedProvider` wrapper class
- [ ] Cache forecasts for 60–300s (configurable)
- [ ] Cache historical readings for 24 hours (they never change)
- [ ] Use Redis for distributed caching

### 1.6 Build Fallback Layer
- [ ] Create `FallbackProvider` wrapper
- [ ] Try primary provider first
- [ ] On failure, try backup
- [ ] Log all fallback events for monitoring

### 1.7 Build Comparison Test Script
- [ ] Query same location/time from all providers
- [ ] Compare:
  - Response latency
  - Data freshness
  - "First at/after" behavior accuracy
  - Rate limit behavior
- [ ] Output comparison report

### 1.8 Integrate with Scheduler/Settler
- [ ] Create provider factory in `packages/shared`
- [ ] Configure via environment variable
- [ ] Export for use by services

---

## Open-Meteo Implementation Notes

**Forecast API:**
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=40.7128
  &longitude=-74.0060
  &hourly=temperature_2m
  &temperature_unit=fahrenheit
  &timezone=UTC
```

**Historical API (for settlement):**
```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude=40.7128
  &longitude=-74.0060
  &start_date=2024-01-15
  &end_date=2024-01-15
  &hourly=temperature_2m
  &temperature_unit=fahrenheit
```

⚠️ **Challenge:** Open-Meteo provides hourly data. For "first reading at/after T", we may need to:
1. Fetch the hour containing T
2. Return that hour's reading as the "first available"
3. Document this limitation clearly

This may not be precise enough for 5-minute cadence markets. Use as backup only for dev/testing; upgrade plan if commercial use is needed.

---

## MET Norway Implementation Notes

- Use the **Nowcast** product for near-term precipitation/wind/temp with ~5-minute updates.
- Required headers: set a descriptive `User-Agent` with app name + contact email.
- Expect occasional 429s during severe weather; implement exponential backoff and respect caching TTLs.
- Map fields into the normalized schema and tag with `source = "met-no"` and a confidence value.

---

## NOAA/NWS (US) Implementation Notes

- Use `api.weather.gov` for forecasts, alerts, and observations.
- Rate limits are informal; treat as "be polite" with caching and backoff.
- Good for alerts + short-term grid forecasts; scope to US markets only.

---

## Fallback + Health Model

```typescript
type NormalizedReading = {
  temp: number;
  precip: number;
  wind: number;
  obsTime: number;
  latitude: number;
  longitude: number;
  source: string;
  confidence: number; // 0-1
};

interface ProviderState {
  priority: number; // lower = more preferred
  health: 'green' | 'yellow' | 'red';
}

// Selection logic
const providers = [metNo, nws, openMeteo];
const active = providers
  .filter((p) => p.state.health !== 'red')
  .sort((a, b) => a.state.priority - b.state.priority);

const reading = await firstSuccessful(active, (p) => p.getFirstReadingAtOrAfter(...));
```

- Cache reads for 60–300s to avoid hammering providers and to keep settlement inputs reproducible.
- Log provider latency/errors to feed the `health` flag.

---

## Temperature Conversion

```typescript
// Always work in Fahrenheit tenths internally
function celsiusToFahrenheitTenths(celsius: number): number {
  const fahrenheit = (celsius * 9/5) + 32;
  return Math.round(fahrenheit * 10); // 85.3°F -> 853
}

function fahrenheitTenthsToDisplay(tenths: number): number {
  return Math.round(tenths / 10); // 853 -> 85 for display
}
```

---

## Timezone Handling

**Rule:** All timestamps in the system are **Unix timestamps (UTC)**.

- Store: Unix timestamp (seconds since epoch)
- Display: Convert to local time for the city
- API calls: Convert to ISO 8601 or Unix as required by provider

```typescript
// packages/shared/src/utils/time.ts

import { format, utcToZonedTime } from 'date-fns-tz';

export function formatLocalTime(
  timestamp: number,
  timezone: string
): string {
  const date = new Date(timestamp * 1000);
  const zonedDate = utcToZonedTime(date, timezone);
  return format(zonedDate, 'MMM d, h:mm a', { timeZone: timezone });
}
```

---

## Caching Strategy

```typescript
// packages/shared/src/providers/cached-provider.ts

export class CachedProvider implements WeatherProvider {
  constructor(
    private provider: WeatherProvider,
    private redis: Redis
  ) {}
  
  async getForecast(lat: number, lon: number, ts: number): Promise<number> {
    const key = `forecast:${lat}:${lon}:${ts}`;
    const cached = await this.redis.get(key);
    if (cached) return parseInt(cached, 10);
    
    const result = await this.provider.getForecast(lat, lon, ts);
    await this.redis.setex(key, 300, result.toString()); // 5 min TTL (configurable)
    return result;
  }
  
  async getFirstReadingAtOrAfter(
    lat: number, 
    lon: number, 
    ts: number
  ): Promise<WeatherReading> {
    const key = `reading:${lat}:${lon}:${ts}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    const result = await this.provider.getFirstReadingAtOrAfter(lat, lon, ts);
    // Cache historical readings for 24 hours (they never change)
    await this.redis.setex(key, 86400, JSON.stringify(result));
    return result;
  }
}
```

---

## Acceptance Criteria

- [ ] `WeatherProvider` interface defined and documented
- [ ] MET Norway adapter works with proper User-Agent + caching
- [ ] NOAA/NWS adapter works for US markets with polite rate limiting
- [ ] Open-Meteo adapter available for dev/testing with documented limits
- [ ] Caching reduces redundant API calls (60–300s TTL configurable)
- [ ] Fallback triggers correctly on primary failure
- [ ] Comparison script outputs clear report
- [ ] All temperature values stored as Fahrenheit tenths

---

## Dependencies

- **Epic 0:** Needs shared package structure
- **Needed by Epic 4:** Scheduler uses `getForecast()`, Settler uses `getFirstReadingAtOrAfter()`

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Interface design | 1 hour |
| MET Norway adapter | 5 hours |
| NOAA/NWS adapter | 5 hours |
| Open-Meteo adapter (dev) | 2 hours |
| Caching layer | 2 hours |
| Fallback layer | 2 hours |
| Comparison script | 2 hours |
| Testing | 3 hours |
| **Total** | **~22 hours** |

---

## Risks

| Risk | Mitigation |
|------|------------|
| MET Norway throttles requests | Real User-Agent + backoff + caching |
| NOAA/NWS limits undocumented | Conservative concurrency + caching |
| Open-Meteo hourly data too coarse | Use only for dev/testing; rely on MET Norway/NOAA in prod |
| Provider goes down during market | Fallback + cancel/refund flow |
| Timezone bugs | All internal timestamps in UTC |

---

## Test Report Template

After running comparison script, output:

```
=== Weather Provider Comparison Report ===
Date: 2024-01-15
Test Location: New York City (40.7128, -74.0060)

MET NORWAY (api.met.no):
  - Forecast latency: 234ms
  - Nowcast latency: 310ms
  - Update frequency: ~5 minutes
  - "First at/after 14:00" returned: 14:00:00Z reading (nowcast bucket)
  - Rating: Suitable for V1 (free)

NOAA/NWS (api.weather.gov):
  - Forecast latency: 260ms
  - Observation latency: 410ms
  - Update frequency: ~5-15 minutes
  - "First at/after 14:00" returned: 14:05:00Z observation
  - Rating: Good US fallback; be polite on rate limits

OPEN-METEO (dev/test):
  - Forecast latency: 200ms
  - Historical latency: 360ms
  - Update frequency: Hourly
  - "First at/after 14:00" returned: 14:00 hourly value
  - Rating: Dev/testing only; hourly precision

RECOMMENDATION:
  Primary: MET Norway
  Fallback: NOAA/NWS for US; Open-Meteo for dev
```

