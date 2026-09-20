import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin-session', () => ({
  getAdminSession: async () => ({ wallet: '0xadmin', sessionId: 's' }),
  logAdminAction: vi.fn(),
}));
const data = vi.hoisted(() => ({
  toggleSettlerPause: vi.fn(),
  togglePause: vi.fn(),
  getSystemConfig: vi.fn(async () => ({ settlerPaused: true, isPaused: true })),
}));
vi.mock('@/lib/admin-data', () => data);

import { POST as settlerPause } from '../system/settler-pause/route';
import { POST as pause } from '../system/pause/route';

const json = (url: string, body: object) =>
  new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => vi.stubEnv('ADMIN_WRITES_ENABLED', ''));
afterEach(() => vi.unstubAllEnvs());

describe('admin write routes in read-only mode', () => {
  it('refuse settlement pause toggles with 403 and do not write', async () => {
    const response = await settlerPause(
      json('/admin/api/system/settler-pause', { settlerPaused: false }),
    );
    expect(response.status).toBe(403);
    expect(data.toggleSettlerPause).not.toHaveBeenCalled();
  });
  it('refuse betting pause toggles with 403', async () => {
    expect((await pause(json('/admin/api/system/pause', { isPaused: false }))).status).toBe(403);
    expect(data.togglePause).not.toHaveBeenCalled();
  });
  it('allow writes when explicitly enabled', async () => {
    vi.stubEnv('ADMIN_WRITES_ENABLED', 'true');
    expect(
      (await settlerPause(json('/admin/api/system/settler-pause', { settlerPaused: false }))).status,
    ).toBe(200);
    expect(data.toggleSettlerPause).toHaveBeenCalledWith(false);
  });
});
