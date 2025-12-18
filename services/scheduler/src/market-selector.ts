import { z } from 'zod';

import type IORedis from 'ioredis';
import { CITIES, type City } from '@weatherb/shared/constants';
import { keccak256, toBytes, type Hex } from 'viem';

export type MarketConfig = {
  city: City;
  cityIdBytes32: Hex;
  resolveTimeSec: number;
};

export type MarketSelectionParams = {
  redis: IORedis;
  dailyMarketCount: number;
  baseTimeSec: number;
  spacingSeconds: number;
  cities?: readonly City[];
};

const redisNumberSchema = z.coerce.number().int().nonnegative();

export function forecastTenthsToThresholdTenths(forecastTempF_tenths: number): number {
  return Math.round(forecastTempF_tenths / 10) * 10;
}

export function cityIdToBytes32(cityId: string): Hex {
  return keccak256(toBytes(cityId));
}

export async function selectMarketsForDay(params: MarketSelectionParams): Promise<MarketConfig[]> {
  const cities = params.cities ?? CITIES;
  if (cities.length === 0) throw new Error('No cities configured');
  if (params.dailyMarketCount > 5) throw new Error('DAILY_MARKET_COUNT must be <= 5');

  const key = 'weatherb:scheduler:cityIndex';
  const currentRaw = await params.redis.get(key);
  const startIndex = currentRaw ? redisNumberSchema.parse(currentRaw) : 0;

  const configs: MarketConfig[] = [];
  for (let i = 0; i < params.dailyMarketCount; i += 1) {
    const city = cities[(startIndex + i) % cities.length]!;
    const resolveTimeSec = params.baseTimeSec + (i + 1) * params.spacingSeconds;
    configs.push({
      city,
      cityIdBytes32: cityIdToBytes32(city.id),
      resolveTimeSec,
    });
  }

  await params.redis.set(key, String(startIndex + params.dailyMarketCount));
  return configs;
}
