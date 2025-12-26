import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    systemConfig: {},
    city: {},
    adminLog: {},
  },
}));

import { deriveProviderStatus, mapMarketStatus } from '@/lib/admin-data';

describe('admin data helpers', () => {
  describe('mapMarketStatus', () => {
    it('returns Closed when betting deadline has passed', () => {
      const status = mapMarketStatus(0, 100, 101);
      expect(status).toBe('Closed');
    });

    it('returns Open when betting deadline has not passed', () => {
      const status = mapMarketStatus(0, 200, 100);
      expect(status).toBe('Open');
    });

    it('returns Resolved for resolved status', () => {
      const status = mapMarketStatus(2, 0, 0);
      expect(status).toBe('Resolved');
    });
  });

  describe('deriveProviderStatus', () => {
    it('returns degraded when health data is missing', () => {
      const status = deriveProviderStatus(null, Date.now());
      expect(status).toBe('degraded');
    });

    it('returns healthy for recent successes without errors', () => {
      const now = Date.now();
      const status = deriveProviderStatus(
        { lastSuccessAt: new Date(now - 10 * 60 * 1000).toISOString(), recentErrors: 0 },
        now
      );
      expect(status).toBe('healthy');
    });

    it('returns down when last success is stale', () => {
      const now = Date.now();
      const status = deriveProviderStatus(
        { lastSuccessAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), recentErrors: 0 },
        now
      );
      expect(status).toBe('down');
    });

    it('returns degraded when recent errors exist', () => {
      const now = Date.now();
      const status = deriveProviderStatus(
        { lastSuccessAt: new Date(now - 5 * 60 * 1000).toISOString(), recentErrors: 3 },
        now
      );
      expect(status).toBe('degraded');
    });

    it('returns degraded when last error is recent', () => {
      const now = Date.now();
      const status = deriveProviderStatus(
        {
          lastSuccessAt: new Date(now - 5 * 60 * 1000).toISOString(),
          lastErrorAt: new Date(now - 10 * 60 * 1000).toISOString(),
          recentErrors: 1,
        },
        now
      );
      expect(status).toBe('degraded');
    });
  });
});
