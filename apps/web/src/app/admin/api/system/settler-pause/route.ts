import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { toggleSettlerPause, getSystemConfig } from '@/lib/admin-data';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settlerPaused } = body;

    if (typeof settlerPaused !== 'boolean') {
      return NextResponse.json({ error: 'settlerPaused must be a boolean' }, { status: 400 });
    }

    const oldConfig = await getSystemConfig();
    await toggleSettlerPause(settlerPaused);

    // Log the action
    await logAdminAction(session.wallet, settlerPaused ? 'PAUSE_SETTLEMENT' : 'RESUME_SETTLEMENT', {
      oldValue: oldConfig.settlerPaused,
      newValue: settlerPaused,
    });

    return NextResponse.json({ success: true, settlerPaused });
  } catch (error) {
    console.error('Settler pause toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle settler pause state' }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getSystemConfig();
    return NextResponse.json({ settlerPaused: config.settlerPaused });
  } catch (error) {
    console.error('Get settler pause state error:', error);
    return NextResponse.json({ error: 'Failed to get settler pause state' }, { status: 500 });
  }
}

