import { describe, it, expect } from 'vitest';
import {
  calculateMarketSummary,
  formatTemperatureDisplay,
  getMarketQuestion,
  getOutcomeMessage,
} from '../market-summary-utils';
import type { Market } from '@weatherb/shared/types';

describe('market summary utilities', () => {
  it('should calculate settled market summary', () => {
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
      totalFees: BigInt(2e18),
      resolvedTempF_tenths: 680,
      observedTimestamp: 1735344100,
      outcome: true,
    };

    const summary = calculateMarketSummary(market); // 1% fee

    expect(summary.type).toBe('settled');
    if (summary.type === 'settled') {
      expect(summary.winnerSide).toBe('YES');
      expect(summary.winningPool).toBe(BigInt(100e18));
      expect(summary.losingPool).toBe(BigInt(50e18));
      expect(summary.feeAmount).toBe(BigInt(2e18)); // Recorded fee, not a default 1%
      expect(summary.winningPoolPercentage).toBeCloseTo(66.67, 1);
    }
  });

  it('should calculate live market summary', () => {
    const now = Date.now();
    const resolveTime = now + 86400000; // 24 hours from now

    const market: Market = {
      id: '2',
      cityId: 'miami',
      cityName: 'Miami',
      latitude: 25.7617,
      longitude: -80.1918,
      resolveTime: resolveTime / 1000,
      thresholdF_tenths: 850,
      currency: 'FLR',
      status: 'open',
      yesPool: BigInt(200e18),
      noPool: BigInt(300e18),
    };

    const summary = calculateMarketSummary(market);

    expect(summary.type).toBe('live');
    if (summary.type === 'live') {
      expect(summary.impliedProbability.yes).toBe(40);
      expect(summary.impliedProbability.no).toBe(60);
      expect(summary.currentMultiplier.yes).toBeCloseTo(2.5, 2);
      expect(summary.currentMultiplier.no).toBeCloseTo(1.67, 2);
    }
  });

  it('should format temperature display', () => {
    expect(formatTemperatureDisplay(850)).toBe('85°F');
    expect(formatTemperatureDisplay(723)).toBe('72°F');
    expect(formatTemperatureDisplay(1000)).toBe('100°F');
  });

  it('should get market question', () => {
    const question = getMarketQuestion('Seattle', 650, new Date('2024-12-27T12:00:00Z'));
    expect(question).toBe('Will Seattle hit ≥65°F on Dec 27?');
  });

  it('should get outcome message', () => {
    expect(getOutcomeMessage('resolved', true)).toBe('YES Won');
    expect(getOutcomeMessage('resolved', false)).toBe('NO Won');
    expect(getOutcomeMessage('cancelled')).toBe('Cancelled');
    expect(getOutcomeMessage('noWinners')).toBe('No Winners');
  });
});
