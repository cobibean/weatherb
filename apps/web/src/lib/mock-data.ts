import type { Market } from '@weatherb/shared/types';

/**
 * Mock market data for UI development
 * Replace with real contract data when ready
 * 
 * Uses fixed timestamps to avoid SSR hydration mismatch.
 * In production, these would come from the blockchain/API.
 */

// Fixed base time for consistent SSR/client rendering
// This represents "4 hours from a fixed reference point"
const MOCK_BASE_TIME = new Date('2025-12-22T12:00:00Z').getTime();

export const mockMarkets: Market[] = [
  {
    id: '1',
    cityId: 'nyc',
    cityName: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    thresholdF_tenths: 720, // 72.0°F
    resolveTime: MOCK_BASE_TIME + 4 * 60 * 60 * 1000, // 4 hours from base
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt('1000000000000000000000'), // 1000 FLR
    noPool: BigInt('500000000000000000000'),   // 500 FLR
  },
  {
    id: '2',
    cityId: 'la',
    cityName: 'Los Angeles',
    latitude: 34.0522,
    longitude: -118.2437,
    thresholdF_tenths: 780, // 78.0°F
    resolveTime: MOCK_BASE_TIME + 6 * 60 * 60 * 1000, // 6 hours from base
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt('750000000000000000000'),  // 750 FLR
    noPool: BigInt('900000000000000000000'),   // 900 FLR
  },
  {
    id: '3',
    cityId: 'chi',
    cityName: 'Chicago',
    latitude: 41.8781,
    longitude: -87.6298,
    thresholdF_tenths: 450, // 45.0°F
    resolveTime: MOCK_BASE_TIME + 2 * 60 * 60 * 1000, // 2 hours from base
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt('300000000000000000000'),  // 300 FLR
    noPool: BigInt('300000000000000000000'),   // 300 FLR (50/50!)
  },
  {
    id: '4',
    cityId: 'miami',
    cityName: 'Miami',
    latitude: 25.7617,
    longitude: -80.1918,
    thresholdF_tenths: 850, // 85.0°F
    resolveTime: MOCK_BASE_TIME + 8 * 60 * 60 * 1000, // 8 hours from base
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt('2000000000000000000000'), // 2000 FLR
    noPool: BigInt('400000000000000000000'),   // 400 FLR (YES heavy!)
  },
  {
    id: '5',
    cityId: 'seattle',
    cityName: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    thresholdF_tenths: 550, // 55.0°F
    resolveTime: MOCK_BASE_TIME + 3 * 60 * 60 * 1000, // 3 hours from base
    currency: 'FLR',
    status: 'open',
    yesPool: BigInt('150000000000000000000'),  // 150 FLR
    noPool: BigInt('850000000000000000000'),   // 850 FLR (NO heavy!)
  },
];
