import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';

const cancelMarketSchema = z.object({
  marketId: z.number().int().nonnegative(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = cancelMarketSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { marketId } = parseResult.data;

    // Log the action (contract call would happen here in production)
    await logAdminAction(session.wallet, 'CANCEL_MARKET', { marketId });

    // TODO: Call contract cancelMarket function
    // This requires:
    // 1. Admin wallet to be the contract owner
    // 2. Private key to sign transaction
    // For now, we just log and return success

    return NextResponse.json({ 
      success: true, 
      marketId,
      message: 'Market cancellation logged. Contract call pending implementation.' 
    });
  } catch (error) {
    console.error('Cancel market error:', error);
    return NextResponse.json({ error: 'Failed to cancel market' }, { status: 500 });
  }
}

