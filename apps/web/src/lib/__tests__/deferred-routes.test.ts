import { describe, it, expect } from 'vitest';
import * as route0 from '@/app/api/magic/[token]/route';
import * as route1 from '@/app/api/magic/cleanup/route';
import * as route2 from '@/app/api/admin/test-runs/[id]/stream/route';
import * as route3 from '@/app/api/admin/test-weekly-report/route';
import * as route4 from '@/app/api/admin/suggestions/top/route';
import * as route5 from '@/app/api/admin/suggestions/approve/route';
import * as route6 from '@/app/api/admin/suggestions/deny/route';
import * as route7 from '@/app/api/suggestions/route';
import * as route8 from '@/app/api/suggestions/[id]/route';
import * as route9 from '@/app/api/suggestions/[id]/vote/route';
import * as route10 from '@/app/api/suggestions/[id]/voted/route';
import * as route11 from '@/app/api/cron/weekly-report/route';
import * as route12 from '@/app/api/cron/update-trending/route';
import * as route13 from '@/app/api/debug/test-sheets/route';

describe('Deferred API entry points', () => {
  it('api/magic/[token]/route.ts', async () => {
    for (const handler of Object.values(route0)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/magic/cleanup/route.ts', async () => {
    for (const handler of Object.values(route1)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/admin/test-runs/[id]/stream/route.ts', async () => {
    for (const handler of Object.values(route2)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/admin/test-weekly-report/route.ts', async () => {
    for (const handler of Object.values(route3)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/admin/suggestions/top/route.ts', async () => {
    for (const handler of Object.values(route4)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/admin/suggestions/approve/route.ts', async () => {
    for (const handler of Object.values(route5)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/admin/suggestions/deny/route.ts', async () => {
    for (const handler of Object.values(route6)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/suggestions/route.ts', async () => {
    for (const handler of Object.values(route7)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/suggestions/[id]/route.ts', async () => {
    for (const handler of Object.values(route8)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/suggestions/[id]/vote/route.ts', async () => {
    for (const handler of Object.values(route9)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/suggestions/[id]/voted/route.ts', async () => {
    for (const handler of Object.values(route10)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/cron/weekly-report/route.ts', async () => {
    for (const handler of Object.values(route11)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/cron/update-trending/route.ts', async () => {
    for (const handler of Object.values(route12)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
  it('api/debug/test-sheets/route.ts', async () => {
    for (const handler of Object.values(route13)) {
      const response = handler();
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'This feature is unavailable during the Arc restart.',
      });
    }
  });
});
