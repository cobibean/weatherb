import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { togglePause, getSystemConfig } from '@/lib/admin-data';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isPaused } = body;

    if (typeof isPaused !== 'boolean') {
      return NextResponse.json({ error: 'isPaused must be a boolean' }, { status: 400 });
    }

    const oldConfig = await getSystemConfig();
    await togglePause(isPaused);

    // Log the action
    await logAdminAction(session.wallet, isPaused ? 'PAUSE_BETTING' : 'RESUME_BETTING', {
      oldValue: oldConfig.isPaused,
      newValue: isPaused,
    });

    // TODO: Call contract pause/unpause function
    // This would require the admin wallet to be the contract owner
    // For now, we just update the database state

    return NextResponse.json({ success: true, isPaused });
  } catch (error) {
    console.error('Pause toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle pause state' }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getSystemConfig();
    return NextResponse.json({ isPaused: config.isPaused });
  } catch (error) {
    console.error('Get pause state error:', error);
    return NextResponse.json({ error: 'Failed to get pause state' }, { status: 500 });
  }
}

