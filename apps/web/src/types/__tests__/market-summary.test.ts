import type { Market } from '@weatherb/shared/types';
import { describe, expect, it } from 'vitest';
import type { LiveMarketSummary, SettledMarketSummary } from '../market-summary';

describe('MarketSummaryData types', () => {
  it('should create valid settled market summary', () => {
    const market: Market = {
      id: '1',
      cityId: 'seattle',
      cityName: 'Seattle',
      latitude: 47.6062,
      longitude: -122.3321,
      resolveTime: 1735344000,
      thresholdF_tenths: 650,
      currency: 'FLR',
      status: 'resolved',
      yesPool: BigInt(100e18),
      noPool: BigInt(50e18),
      resolvedTempF_tenths: 680,
      observedTimestamp: 1735344100,
      outcome: true,
      resolutionTxHash: '0xabc123',
    };

    const summary: SettledMarketSummary = {
      type: 'settled',
      market,
      totalPool: BigInt(150e18),
      winningPool: BigInt(100e18),
      losingPool: BigInt(50e18),
      winnerSide: 'YES',
      feeAmount: BigInt(0.5e18),
      winningPoolPercentage: 66.67,
      numberOfBettors: { yes: 10, no: 5 },
    };

    expect(summary.type).toBe('settled');
    expect(summary.winnerSide).toBe('YES');
    expect(summary.winningPoolPercentage).toBeCloseTo(66.67, 2);
  });

  it('should create valid live market summary', () => {
    const market: Market = {
      id: '2',
      cityId: 'miami',
      cityName: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      resolveTime: 1735430400,
      thresholdF_tenths: 850,
      currency: 'FLR',
      status: 'open',
      yesPool: BigInt(200e18),
      noPool: BigInt(300e18),
    };

    const summary: LiveMarketSummary = {
      type: 'live',
      market,
      totalPool: BigInt(500e18),
      bettingDeadline: 1735429800,
      timeUntilClose: 86400,
      timeUntilResolve: 87000,
      impliedProbability: { yes: 40, no: 60 },
      currentMultiplier: { yes: 2.5, no: 1.67 },
    };

    expect(summary.type).toBe('live');
    expect(summary.impliedProbability.yes).toBe(40);
    expect(summary.currentMultiplier.yes).toBeCloseTo(2.5, 2);
  });
});
