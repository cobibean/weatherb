import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/suggestions/[id]
 * Get single suggestion by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const suggestion = await prisma.suggestion.findUnique({
      where: { id },
      include: {
        city: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Error fetching suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestion' },
      { status: 500 }
    );
  }
}
