import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminWritesEnabled, adminReadOnlyResponse } from '@/lib/admin-writes';

afterEach(() => vi.unstubAllEnvs());

describe('admin write gate', () => {
  it('is read-only unless explicitly enabled with the literal string true', () => {
    vi.stubEnv('ADMIN_WRITES_ENABLED', '');
    expect(adminWritesEnabled()).toBe(false);
    vi.stubEnv('ADMIN_WRITES_ENABLED', '1');
    expect(adminWritesEnabled()).toBe(false);
    vi.stubEnv('ADMIN_WRITES_ENABLED', 'true');
    expect(adminWritesEnabled()).toBe(true);
  });
  it('returns a 403 response', async () => {
    const response = adminReadOnlyResponse();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Admin panel is read-only' });
  });
});
