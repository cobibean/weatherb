import { getAdminSession } from './admin-session';

/**
 * Result of admin authentication check
 */
export type AdminAuthResult =
  | { authenticated: true; wallet: string }
  | { authenticated: false; error: string };

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
