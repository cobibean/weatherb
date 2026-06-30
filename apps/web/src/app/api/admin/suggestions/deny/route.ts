import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-log';
import prisma from '@/lib/prisma';

/**
 * Request body validation schema
 */
const DenyRequestSchema = z.object({
  suggestionId: z.string().min(1, 'suggestionId is required'),
  reason: z.string().optional(),
});

/**
 * POST /api/admin/suggestions/deny
 *
 * Deny a suggestion and mark it as REJECTED.
 *
 * Requirements:
 * - Must be authenticated as admin
 * - Suggestion must exist
 *
 * On success:
 * - Updates suggestion status to REJECTED
 * - Logs admin action with optional reason
 *
 * @returns Success status
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin authentication
    const auth = await requireAdminAuth();
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parseResult = DenyRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parseResult.error.errors[0]?.message}` },
        { status: 400 }
      );
    }

    const { suggestionId, reason } = parseResult.data;

    // 3. Check if suggestion exists
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    // 4. Update suggestion status to REJECTED
    await prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'REJECTED' },
    });

    // 5. Log admin action
    await logAdminAction(auth.wallet, 'DENY_SUGGESTION', {
      suggestionId,
      reason,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error denying suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to deny suggestion' },
      { status: 500 }
    );
  }
}
