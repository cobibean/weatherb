import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ cookieGet: vi.fn(), cookieSet: vi.fn(), find: vi.fn(), del: vi.fn(), update: vi.fn(), verify: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mock.cookieGet, set: mock.cookieSet, delete: vi.fn() }) }));
vi.mock('viem', async (importOriginal) => ({ ...(await importOriginal<typeof import('viem')>()), verifyMessage: mock.verify }));
vi.mock('@/lib/prisma', () => ({ default: { adminSession: { findUnique: mock.find, delete: mock.del, updateMany: mock.update } } }));
import { getAdminSession, verifyAndActivateSession } from '@/lib/admin-session';
import { verifyAdminWallet } from '@/lib/admin-auth';

const wallet = '0x0000000000000000000000000000000000000001';
const pending = { id: 'session', wallet, nonce: 'nonce', authenticatedAt: null, expiresAt: new Date(Date.now() + 60_000) };

describe('verified admin session boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('ADMIN_WALLETS', wallet);
    mock.cookieGet.mockReturnValue({ value: 'session' });
    mock.find.mockResolvedValue({ ...pending, expiresAt: new Date(Date.now() + 60_000) });
    mock.verify.mockResolvedValue(true);
    mock.update.mockResolvedValue({ count: 1 });
    mock.del.mockResolvedValue({});
  });

  it('denies a pending ID via cookie and bearer', async () => {
    expect(await getAdminSession()).toBeNull();
    expect(await verifyAdminWallet('session')).toMatchObject({ isValid: false });
  });

  it('activates a valid nonce once and rejects a replayed activation', async () => {
    expect(await verifyAndActivateSession('session', '0x1234', wallet)).toEqual({ success: true });
    expect(mock.cookieSet).toHaveBeenCalledTimes(1);
    mock.update.mockResolvedValue({ count: 0 });
    expect((await verifyAndActivateSession('session', '0x1234', wallet)).success).toBe(false);
    expect(mock.cookieSet).toHaveBeenCalledTimes(1);
  });

  it('denies expired, removed and forged sessions', async () => {
    mock.find.mockResolvedValue({ ...pending, authenticatedAt: new Date(), expiresAt: new Date(Date.now() - 1) });
    expect(await getAdminSession()).toBeNull();
    expect((await verifyAdminWallet('session')).isValid).toBe(false);
    mock.find.mockResolvedValue({ ...pending, authenticatedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) });
    vi.stubEnv('ADMIN_WALLETS', '');
    expect(await getAdminSession()).toBeNull();
    expect((await verifyAdminWallet('session')).isValid).toBe(false);
    mock.find.mockResolvedValue(null);
    expect(await getAdminSession()).toBeNull();
    expect((await verifyAdminWallet('forged')).isValid).toBe(false);
  });
});
