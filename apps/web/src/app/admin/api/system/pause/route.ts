import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { togglePause, getSystemConfig } from '@/lib/admin-data';
import { setPausedOnChain, getContractPausedState } from '@/lib/admin-contract';

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

    // Call contract to pause/unpause
    let txHash: string;
    try {
      txHash = await setPausedOnChain(isPaused);
    } catch (contractError) {
      console.error('Contract call failed:', contractError);
      const errorMessage = contractError instanceof Error ? contractError.message : 'Unknown contract error';

      // Check for common errors
      if (errorMessage.includes('OwnableUnauthorizedAccount')) {
        return NextResponse.json(
          { error: 'Admin wallet is not the contract owner' },
          { status: 403 }
        );
      }
      if (errorMessage.includes('EnforcedPause') || errorMessage.includes('ExpectedPause')) {
        return NextResponse.json(
          { error: `Contract is already ${isPaused ? 'paused' : 'unpaused'}` },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Contract call failed', details: errorMessage },
        { status: 500 }
      );
    }

    // Update database state to match contract
    await togglePause(isPaused);

    // Log the action
    await logAdminAction(session.wallet, isPaused ? 'PAUSE_BETTING' : 'RESUME_BETTING', {
      oldValue: oldConfig.isPaused,
      newValue: isPaused,
      txHash,
    });

    return NextResponse.json({ success: true, isPaused, txHash });
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

    // Get state from both database and contract
    const config = await getSystemConfig();
    let contractPaused: boolean | null = null;

    try {
      contractPaused = await getContractPausedState();
    } catch {
      // Contract call failed - return database state only
      console.warn('Could not fetch contract paused state');
    }

    return NextResponse.json({
      isPaused: config.isPaused,
      contractPaused,
      synced: contractPaused === null ? null : config.isPaused === contractPaused,
    });
  } catch (error) {
    console.error('Get pause state error:', error);
    return NextResponse.json({ error: 'Failed to get pause state' }, { status: 500 });
  }
}

