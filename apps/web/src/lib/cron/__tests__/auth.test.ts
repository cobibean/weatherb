import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyCronRequest, verifyWorkerRequest, unauthorizedResponse } from '../auth';

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
    (process.env as Record<string, string | undefined>).CRON_SECRET = 'test';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { Authorization: 'Bearer test' },
    });

    expect(verifyCronRequest(request)).toBe(true);
  });

  it('returns false with invalid secret', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    (process.env as Record<string, string | undefined>).CRON_SECRET = 'correct';

    const request = new Request('http://localhost/api/cron/test', {
      headers: { Authorization: 'Bearer wrong-secret' },
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

describe('verifyWorkerRequest', () => {
  const authorized = (): Request =>
    new Request('http://localhost/api/cron/settle-markets', {
      headers: { authorization: 'Bearer test-secret' },
    });
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('rejects deployments that are not the settlement worker even with a valid secret', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', '');
    expect(verifyWorkerRequest(authorized())).toBe(false);
  });
  it('accepts the worker deployment with a valid secret', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', 'settler');
    expect(verifyWorkerRequest(authorized())).toBe(true);
  });
  it('still requires the bearer secret on the worker', () => {
    vi.stubEnv('WEATHERB_WORKER_ROLE', 'settler');
    expect(verifyWorkerRequest(new Request('http://localhost/api/cron/settle-markets'))).toBe(false);
  });
});
