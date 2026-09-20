import type { WeatherReading } from '../types/provider';

export const SETTLEMENT_WINDOW_SECONDS = 600;

/** Only an actual observation within the target window is settlement evidence. */
export function validateSettlementReading(
  reading: WeatherReading,
  target: number,
  now = Math.floor(Date.now() / 1000),
): void {
  if (
    !Number.isSafeInteger(target) ||
    !Number.isSafeInteger(reading.observedTimestamp) ||
    !Number.isSafeInteger(reading.tempF_tenths) ||
    reading.tempF_tenths < 0 ||
    reading.observedTimestamp < target ||
    reading.observedTimestamp > target + SETTLEMENT_WINDOW_SECONDS ||
    reading.observedTimestamp > now
  ) {
    throw new Error('Weather observation is outside the settlement window or unsupported');
  }
}
