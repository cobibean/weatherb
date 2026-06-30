import { NextRequest, NextResponse } from 'next/server';
import { createPendingSession, isAdminWallet, getAdminWallets } from '@/lib/admin-session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Debug logging for admin auth
    const adminWallets = getAdminWallets();
    console.log('[Admin Auth Debug]', {
      inputWallet: wallet,
      inputNormalized: wallet.toLowerCase(),
      adminWalletsEnv: process.env.ADMIN_WALLETS ? `set (${process.env.ADMIN_WALLETS.length} chars)` : 'NOT SET',
      adminWalletsParsed: adminWallets,
      isMatch: adminWallets.includes(wallet.toLowerCase()),
    });

    // Check if wallet is in allowlist
    if (!isAdminWallet(wallet)) {
      console.log('[Admin Auth] Wallet not authorized:', wallet);
      return NextResponse.json(
        { error: 'Wallet not authorized' },
        { status: 403 }
      );
    }

    // Create pending session with nonce
    const { nonce, sessionId } = await createPendingSession(wallet);

    return NextResponse.json({ nonce, sessionId });
  } catch (error) {
    console.error('Auth init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize authentication' },
      { status: 500 }
    );
  }
}

