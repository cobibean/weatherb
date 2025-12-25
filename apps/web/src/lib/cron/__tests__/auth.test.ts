import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyCronRequest, unauthorizedResponse } from '../auth';

describe('verifyCronRequest', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true in development mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const request = new Request('http://localhost/api/cron/test');
    expect(verifyCronRequest(request)).toBe(true);
  });

  it('returns true with valid CRON_SECRET', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).CRON_SECRET = 'test-secret-123';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { 'Authorization': 'Bearer test-secret-123' },
    });

    expect(verifyCronRequest(request)).toBe(true);
  });

  it('returns false with invalid secret', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).CRON_SECRET = 'correct-secret';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { 'Authorization': 'Bearer wrong-secret' },
    });

    expect(verifyCronRequest(request)).toBe(false);
  });

  it('returns false with missing header', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).CRON_SECRET = 'test-secret';

    const request = new Request('http://localhost/api/cron/test');
    expect(verifyCronRequest(request)).toBe(false);
  });
});

describe('unauthorizedResponse', () => {
  it('returns 401 status', () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
  });
});
