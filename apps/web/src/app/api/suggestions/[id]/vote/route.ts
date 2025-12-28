import { NextRequest, NextResponse } from 'next/server';
import { getWalletFromRequest } from '@/lib/auth-helpers';
import { castVote, removeVote } from '@/lib/voting';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/suggestions/[id]/vote
 * Cast a vote for a suggestion
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get wallet from request
    const wallet = await getWalletFromRequest(request);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      );
    }

    // Cast vote (uses Serializable isolation)
    await castVote(wallet, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Handle duplicate vote
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Already voted for this suggestion' },
          { status: 400 }
        );
      }

      if (error.message === 'Suggestion not found') {
        return NextResponse.json(
          { error: 'Suggestion not found' },
          { status: 404 }
        );
      }

      if (error.message === 'Suggestion is not open for voting') {
        return NextResponse.json(
          { error: 'Suggestion is not open for voting' },
          { status: 400 }
        );
      }
    }

    console.error('Error casting vote:', error);
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suggestions/[id]/vote
 * Remove a vote from a suggestion
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get wallet from request
    const wallet = await getWalletFromRequest(request);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      );
    }

    // Remove vote
    await removeVote(wallet, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Vote not found') {
      return NextResponse.json(
        { error: 'Vote not found' },
        { status: 404 }
      );
    }

    console.error('Error removing vote:', error);
    return NextResponse.json(
      { error: 'Failed to remove vote' },
      { status: 500 }
    );
  }
}
