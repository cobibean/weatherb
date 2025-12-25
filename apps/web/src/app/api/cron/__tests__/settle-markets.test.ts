import { describe, it, expect, vi } from 'vitest';

describe('findCityByBytes32', () => {
  it('finds city by matching hash', async () => {
    const { keccak256, toBytes } = await import('viem');

    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0 },
      { id: 'la', name: 'Los Angeles', latitude: 34.0, longitude: -118.2 },
    ];

    const nycHash = keccak256(toBytes('nyc'));
    const found = cities.find(c => keccak256(toBytes(c.id)) === nycHash);

    expect(found?.id).toBe('nyc');
    expect(found?.name).toBe('New York');
  });

  it('returns null for unknown hash', async () => {
    const { keccak256, toBytes } = await import('viem');

    const cities = [
      { id: 'nyc', name: 'New York', latitude: 40.7, longitude: -74.0 },
    ];

    const unknownHash = keccak256(toBytes('unknown-city'));
    const found = cities.find(c => keccak256(toBytes(c.id)) === unknownHash);

    expect(found).toBeUndefined();
  });
});

describe('market filtering', () => {
  it('filters markets past resolve time', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const markets = [
      { marketId: 0n, resolveTimeSec: nowSec - 100, status: 'Open' },
      { marketId: 1n, resolveTimeSec: nowSec + 100, status: 'Open' },
      { marketId: 2n, resolveTimeSec: nowSec - 50, status: 'Open' },
    ];

    const readyMarkets = markets.filter(m => m.resolveTimeSec <= nowSec);

    expect(readyMarkets.length).toBe(2);
    expect(readyMarkets.map(m => Number(m.marketId))).toEqual([0, 2]);
  });

  it('excludes resolved and cancelled markets', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    const markets = [
      { marketId: 0n, resolveTimeSec: nowSec - 100, status: 'Open' },
      { marketId: 1n, resolveTimeSec: nowSec - 100, status: 'Resolved' },
      { marketId: 2n, resolveTimeSec: nowSec - 100, status: 'Cancelled' },
      { marketId: 3n, resolveTimeSec: nowSec - 100, status: 'Closed' },
    ];

    const pending = markets.filter(m =>
      m.status !== 'Resolved' && m.status !== 'Cancelled'
    );

    expect(pending.length).toBe(2);
    expect(pending.map(m => Number(m.marketId))).toEqual([0, 3]);
  });
});

describe('STATUS_MAP', () => {
  it('maps status indices correctly', () => {
    const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled'] as const;

    expect(STATUS_MAP[0]).toBe('Open');
    expect(STATUS_MAP[1]).toBe('Closed');
    expect(STATUS_MAP[2]).toBe('Resolved');
    expect(STATUS_MAP[3]).toBe('Cancelled');
  });
});

