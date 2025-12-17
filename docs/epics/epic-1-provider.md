# Epic 1 — Weather Provider Research + Adapter Layer

> **Goal:** Select a weather data provider for V1 and build an abstraction layer that makes switching providers painless.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary provider | **Open-Meteo** | Free, no API key required, good global coverage |
| Backup provider | **Tomorrow.io** | Paid but reliable, minute-level granularity |
| Caching | **Redis with 1-min TTL for forecasts** | Reduce API calls, stay under rate limits |
| Fallback strategy | **Primary → Backup → Fail** | Don't cascade endlessly |

---

## ⚠️ Get This Answered From User

| Question | Why It Matters | Options |
|----------|----------------|---------|
| **Budget for weather API?** | Tomorrow.io is $0-99/mo, others vary | Free only / $50/mo / $100/mo |
| **Coverage priority?** | Some providers better in certain regions | Global / US-focused / EU-focused |
| **Acceptable latency for "first reading"?** | How stale can the reading be? | Real-time only / ≤5 min delay OK / ≤15 min delay OK |

---

## Provider Comparison (To Be Completed)

| Provider | Cost | Update Freq | Coverage | "First at/after T" Support | Notes |
|----------|------|-------------|----------|---------------------------|-------|
| Open-Meteo | Free | Hourly | Global | ❓ Need to test | No API key |
| Tomorrow.io | $0-99/mo | 1-min | Global | ✅ Likely | Minute-level historical |
| OpenWeatherMap | $0-40/mo | Hourly | Global | ❓ | Popular, well-documented |
| WeatherAPI | $0-35/mo | ~15 min | Global | ❓ | Good free tier |

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
            ├── open-meteo.ts            # Open-Meteo adapter
            ├── tomorrow-io.ts           # Tomorrow.io adapter
            ├── cached-provider.ts       # Caching wrapper
            └── fallback-provider.ts     # Fallback wrapper
```

---

## Tasks

### 1.1 Define Provider Interface
- [ ] Create `interface.ts` with `WeatherProvider` type
- [ ] Define `WeatherReading` and `ProviderHealth` types
- [ ] Document the "first reading at/after T" requirement clearly

### 1.2 Implement Open-Meteo Adapter
- [ ] Research Open-Meteo API for historical data access
- [ ] Implement `getForecast()` using forecast endpoint
- [ ] Implement `getFirstReadingAtOrAfter()` — this is the tricky one
- [ ] Implement `healthCheck()`
- [ ] Handle timezone conversions properly
- [ ] Write unit tests with mocked responses

### 1.3 Implement Tomorrow.io Adapter
- [ ] Research Tomorrow.io timeline API for minute-level data
- [ ] Implement same interface
- [ ] Handle API key authentication
- [ ] Write unit tests

### 1.4 Build Caching Layer
- [ ] Create `CachedProvider` wrapper class
- [ ] Cache forecasts with 1-minute TTL (they don't change fast)
- [ ] Cache historical readings with 24-hour TTL (they never change)
- [ ] Use Redis for distributed caching

### 1.5 Build Fallback Layer
- [ ] Create `FallbackProvider` wrapper
- [ ] Try primary provider first
- [ ] On failure, try backup
- [ ] Log all fallback events for monitoring

### 1.6 Build Comparison Test Script
- [ ] Query same location/time from all providers
- [ ] Compare:
  - Response latency
  - Data freshness
  - "First at/after" behavior accuracy
  - Rate limit behavior
- [ ] Output comparison report

### 1.7 Integrate with Scheduler/Settler
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

This may not be precise enough for 5-minute cadence markets. **Tomorrow.io may be required for sub-hourly resolution.**

---

## Tomorrow.io Implementation Notes

**Timeline API (supports minute-level):**
```
GET https://api.tomorrow.io/v4/timelines
  ?location=40.7128,-74.0060
  &fields=temperature
  &timesteps=1m
  &startTime=2024-01-15T14:00:00Z
  &endTime=2024-01-15T15:00:00Z
  &apikey=YOUR_KEY
```

✅ This can provide true minute-level data for accurate "first at/after T" semantics.

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
    await this.redis.setex(key, 60, result.toString()); // 1 min TTL
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
- [ ] Open-Meteo adapter works for forecast and historical data
- [ ] Tomorrow.io adapter works (even if unused in V1)
- [ ] Caching reduces redundant API calls
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
| Open-Meteo adapter | 4 hours |
| Tomorrow.io adapter | 4 hours |
| Caching layer | 2 hours |
| Fallback layer | 2 hours |
| Comparison script | 2 hours |
| Testing | 3 hours |
| **Total** | **~18 hours** |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Open-Meteo hourly data too coarse | Use Tomorrow.io for settlement |
| Rate limits on free tiers | Aggressive caching |
| Provider goes down during market | Fallback + cancel/refund flow |
| Timezone bugs | All internal timestamps in UTC |

---

## Test Report Template

After running comparison script, output:

```
=== Weather Provider Comparison Report ===
Date: 2024-01-15
Test Location: New York City (40.7128, -74.0060)

OPEN-METEO:
  - Forecast latency: 234ms
  - Historical latency: 456ms
  - Update frequency: Hourly
  - "First at/after 14:00" returned: 14:00 reading (hourly bucket)
  - Rating: Suitable for forecasts, NOT for 5-min settlement

TOMORROW.IO:
  - Forecast latency: 189ms
  - Historical latency: 312ms
  - Update frequency: 1-minute
  - "First at/after 14:00" returned: 14:00 reading (exact)
  - Rating: Suitable for all use cases

RECOMMENDATION:
  Primary: Tomorrow.io (if budget allows)
  Fallback: Open-Meteo (for forecasts only)
```

