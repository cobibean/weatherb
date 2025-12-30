import prisma from './prisma';
import { getAdminSession, isAdminWallet } from './admin-session';

/**
 * Result of admin authentication check
 */
export type AdminAuthResult =
  | { authenticated: true; wallet: string }
  | { authenticated: false; error: string };

export type AdminTokenVerification =
  | { isValid: true; wallet: string }
  | { isValid: false; error: string };

/**
 * Verify admin authentication from session cookie
 *
 * This helper is used in API routes that require admin privileges.
 * It checks for a valid admin session and returns the authenticated wallet.
 *
 * @returns Authentication result with wallet or error
 *
 * @example
 * ```ts
 * const auth = await requireAdminAuth();
 * if (!auth.authenticated) {
 *   return NextResponse.json({ error: auth.error }, { status: 401 });
 * }
 * // Use auth.wallet for logging
 * ```
 */
export async function requireAdminAuth(): Promise<AdminAuthResult> {
  const session = await getAdminSession();

  if (!session) {
    return {
      authenticated: false,
      error: 'Not authenticated',
    };
  }

  return {
    authenticated: true,
    wallet: session.wallet,
  };
}

/**
 * Verify an admin token (session id) for API routes that use bearer auth.
 */
export async function verifyAdminWallet(token: string): Promise<AdminTokenVerification> {
  if (!token) {
    return { isValid: false, error: 'Missing token' };
  }

  const session = await prisma.adminSession.findUnique({
    where: { id: token },
  });

  if (!session) {
    return { isValid: false, error: 'Session not found' };
  }

  if (new Date() > session.expiresAt) {
    await prisma.adminSession.delete({ where: { id: token } }).catch(() => {});
    return { isValid: false, error: 'Session expired' };
  }

  if (!isAdminWallet(session.wallet)) {
    await prisma.adminSession.delete({ where: { id: token } }).catch(() => {});
    return { isValid: false, error: 'Wallet not authorized' };
  }

  return { isValid: true, wallet: session.wallet };
}
