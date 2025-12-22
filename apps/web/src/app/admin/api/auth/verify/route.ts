import { NextRequest, NextResponse } from 'next/server';
import { verifyAndActivateSession, logAdminAction } from '@/lib/admin-session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { sessionId, signature, wallet } = body;

    if (!sessionId || !signature || !wallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await verifyAndActivateSession(sessionId, signature, wallet);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 401 }
      );
    }

    // Log the login action
    await logAdminAction(wallet, 'LOGIN', { sessionId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify signature' },
      { status: 500 }
    );
  }
}

