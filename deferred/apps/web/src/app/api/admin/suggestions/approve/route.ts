import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/lib/admin-auth';
import { logAdminAction } from '@/lib/admin-log';
import { startTestWindow } from '@/lib/test-runner';
import prisma from '@/lib/prisma';

/**
 * Request body validation schema
 */
const ApproveRequestSchema = z.object({
  suggestionId: z.string().min(1, 'suggestionId is required'),
});

/**
 * POST /api/admin/suggestions/approve
 *
 * Approve a suggestion and start its test window.
 *
 * Requirements:
 * - Must be authenticated as admin
 * - Suggestion must exist and be PENDING
 * - No existing test run must be RUNNING for this suggestion
 *
 * On success:
 * - Creates a TestRun record
 * - Updates suggestion status to APPROVED
 * - Logs admin action
 *
 * @returns Test run ID on success
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
    const parseResult = ApproveRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parseResult.error.issues[0]?.message}` },
        { status: 400 }
      );
    }

    const { suggestionId } = parseResult.data;

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

    // 4. Check if suggestion is PENDING
    if (suggestion.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Suggestion is not PENDING (current status: ${suggestion.status})` },
        { status: 400 }
      );
    }

    // 5. Check if there's already a running test for this suggestion
    const existingTest = await prisma.testRun.findFirst({
      where: {
        suggestionId,
        status: 'RUNNING',
      },
    });

    if (existingTest) {
      return NextResponse.json(
        { error: 'Suggestion already has a running test' },
        { status: 400 }
      );
    }

    // 6. Start test window (creates TestRun and updates suggestion status)
    const testRun = await startTestWindow(suggestionId);

    // 7. Log admin action
    await logAdminAction(auth.wallet, 'APPROVE_SUGGESTION', {
      suggestionId,
      testRunId: testRun.id,
    });

    return NextResponse.json({
      success: true,
      testRunId: testRun.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('=== APPROVE SUGGESTION ERROR ===');
    console.error('Message:', errorMessage);
    console.error('Stack:', errorStack);
    console.error('================================');

    return NextResponse.json(
      {
        error: 'Failed to approve suggestion',
      },
      { status: 500 }
    );
  }
}
