import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { cancelMarketOnChain } from '@/lib/admin-contract';

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

    // Call contract to cancel market
    let txHash: string;
    try {
      txHash = await cancelMarketOnChain(marketId);
    } catch (contractError) {
      console.error('Contract call failed:', contractError);
      const errorMessage = contractError instanceof Error ? contractError.message : 'Unknown contract error';

      // Check for common errors
      if (errorMessage.includes('NotOwner') || errorMessage.includes('Admin key does not match contract owner')) {
        return NextResponse.json(
          { error: 'Admin wallet is not the contract owner' },
          { status: 403 }
        );
      }
      if (errorMessage.includes('InvalidStatus')) {
        return NextResponse.json(
          { error: 'Market is not cancellable in its current status' },
          { status: 400 }
        );
      }
      if (errorMessage.includes('InvalidMarket')) {
        return NextResponse.json(
          { error: 'Market does not exist' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Contract call failed', details: errorMessage },
        { status: 500 }
      );
    }

    // Log the successful action
    await logAdminAction(session.wallet, 'CANCEL_MARKET', { marketId, txHash });

    return NextResponse.json({
      success: true,
      marketId,
      txHash,
      message: 'Market cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel market error:', error);
    return NextResponse.json({ error: 'Failed to cancel market' }, { status: 500 });
  }
}
