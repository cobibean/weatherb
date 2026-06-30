import { NextRequest } from 'next/server';

/**
 * Get wallet address from request headers
 * In production, this would validate a session token
 * For now, we'll use a simple header-based approach
 */
export async function getWalletFromRequest(request: NextRequest): Promise<string | null> {
  // Check for wallet in header (set by client after wallet connect)
  const wallet = request.headers.get('x-wallet-address');

  if (!wallet) {
    return null;
  }

  // Normalize to lowercase
  return wallet.toLowerCase();
}
