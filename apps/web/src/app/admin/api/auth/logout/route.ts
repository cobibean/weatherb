import { NextResponse } from 'next/server';
import { clearAdminSession, getAdminSession, logAdminAction } from '@/lib/admin-session';

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    
    if (session) {
      await logAdminAction(session.wallet, 'LOGOUT', { sessionId: session.sessionId });
    }

    await clearAdminSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if logging fails
    await clearAdminSession().catch(() => {});
    return NextResponse.json({ success: true });
  }
}

