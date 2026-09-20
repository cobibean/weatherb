import { CITIES } from '@weatherb/shared/constants';
import type { Market } from '@weatherb/shared/types';

/** Ten-minute fallback for older serialized data; live markets use their frozen deadline. */
export const BETTING_BUFFER_MS = 10 * 60 * 1000;
export const bettingCloseTime = (market: Market): number =>
  market.bettingDeadline ?? market.resolveTime - BETTING_BUFFER_MS;
export function canBet(market: Market, now: number): boolean {
  return now > 0 && market.status === 'open' && now < bettingCloseTime(market);
}
export function marketTime(market: Market, timestamp = market.resolveTime): string {
  const city = CITIES.find(
    (item) =>
      item.name === market.cityName ||
      (Math.abs(item.latitude - market.latitude) < 0.05 &&
        Math.abs(item.longitude - market.longitude) < 0.05),
  );
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: city?.timezone ?? 'UTC',
    timeZoneName: 'short',
  }).format(timestamp);
}
