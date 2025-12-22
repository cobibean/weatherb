import { NextRequest, NextResponse } from 'next/server';
import { createPendingSession, isAdminWallet } from '@/lib/admin-session';

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

    // Check if wallet is in allowlist
    if (!isAdminWallet(wallet)) {
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

