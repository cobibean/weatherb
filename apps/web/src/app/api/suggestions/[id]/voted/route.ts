import { NextRequest, NextResponse } from 'next/server';
import { getWalletFromRequest } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/suggestions/[id]/voted
 * Check if current wallet has voted for this suggestion
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Get wallet from request
    const wallet = await getWalletFromRequest(request);
    if (!wallet) {
      return NextResponse.json({ voted: false });
    }

    // Check if vote exists
    const vote = await prisma.vote.findUnique({
      where: {
        wallet_suggestionId: {
          wallet,
          suggestionId: id,
        },
      },
    });

    return NextResponse.json({
      voted: !!vote,
      voteId: vote?.id,
    });
  } catch (error) {
    console.error('Error checking vote status:', error);
    return NextResponse.json(
      { error: 'Failed to check vote status' },
      { status: 500 }
    );
  }
}
