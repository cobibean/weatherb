import { NextRequest, NextResponse } from 'next/server';
import { listSuggestionsSchema } from '@/lib/validations/suggestion';
import { getSuggestions } from '@/lib/trending';

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
