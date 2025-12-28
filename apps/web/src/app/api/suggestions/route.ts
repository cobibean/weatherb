import { NextRequest, NextResponse } from 'next/server';
import { listSuggestionsSchema, createSuggestionSchema } from '@/lib/validations/suggestion';
import { getSuggestions } from '@/lib/trending';
import { getWalletFromRequest } from '@/lib/auth-helpers';
import prisma from '@/lib/prisma';

/**
 * GET /api/suggestions
 * List suggestions with sorting and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query params
    const params = listSuggestionsSchema.parse({
      sort: searchParams.get('sort') || 'votes',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      status: searchParams.get('status') || undefined,
    });

    const suggestions = await getSuggestions(
      params.sort,
      params.page,
      params.limit
    );

    return NextResponse.json({
      suggestions,
      page: params.page,
      limit: params.limit,
      sort: params.sort,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error },
        { status: 400 }
      );
    }

    console.error('Error fetching suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suggestions
 * Create a new suggestion
 */
export async function POST(request: NextRequest) {
  try {
    // Get wallet from request
    const wallet = await getWalletFromRequest(request);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const input = createSuggestionSchema.parse(body);

    // Check for duplicate (same city + wallet within 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cityName = input.customCityName || '';

    const recentDuplicate = await prisma.suggestion.findFirst({
      where: {
        wallet,
        customCityName: cityName,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        { error: `You recently suggested ${cityName}. Please wait before suggesting again.` },
        { status: 400 }
      );
    }

    // Create suggestion
    const suggestion = await prisma.suggestion.create({
      data: {
        wallet,
        cityId: input.cityId,
        customCityName: input.customCityName,
        latitude: input.latitude,
        longitude: input.longitude,
        timeWindow: input.timeWindow,
        comment: input.comment,
        status: 'PENDING',
      },
      include: {
        city: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input', details: error },
        { status: 400 }
      );
    }

    console.error('Error creating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500 }
    );
  }
}
