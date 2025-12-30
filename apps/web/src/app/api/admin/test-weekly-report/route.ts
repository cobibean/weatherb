/**
 * Admin endpoint to manually trigger and test the weekly report
 * This allows admins to generate a test weekly report without waiting for the cron
 */

import { NextResponse } from 'next/server';
import { collectWeeklyMetrics, getMetricsForDateRange } from '@/lib/metrics';
import { sendWeeklySummaryEmail } from '@/lib/email';

/**
 * GET /api/admin/test-weekly-report
 *
 * Query params:
 * - sendEmail: boolean - whether to actually send the email (default: false)
 * - customRange: boolean - use custom date range instead of last week
 * - startDate: ISO date string - custom start date
 * - endDate: ISO date string - custom end date
 */
export async function GET(request: Request) {
  try {
    // Check admin authentication
    // TODO: Replace with proper admin auth check
    const isAdmin = true; // For now, allow for testing

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sendEmail = searchParams.get('sendEmail') === 'true';
    const customRange = searchParams.get('customRange') === 'true';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    console.log('[TestWeeklyReport] Starting test report generation', {
      sendEmail,
      customRange,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    let metrics;

    if (customRange && startDateStr && endDateStr) {
      // Use custom date range
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }

      if (startDate > endDate) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }

      console.log('[TestWeeklyReport] Using custom date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      metrics = await getMetricsForDateRange(startDate, endDate);
    } else {
      // Use default previous week
      console.log('[TestWeeklyReport] Using default previous week range');
      metrics = await collectWeeklyMetrics();
    }

    // Add test indicator to the metrics
    const testMetrics = {
      ...metrics,
      aiInsights: '🧪 This is a test weekly report. In production, this section will contain AI-generated insights about market trends and patterns.',
    };

    console.log('[TestWeeklyReport] Metrics collected:', {
      dateRange: `${testMetrics.startDate} - ${testMetrics.endDate}`,
      totalMarkets: testMetrics.totalMarkets,
      totalVolume: testMetrics.totalVolume,
      uniqueBettors: testMetrics.uniqueBettors,
    });

    let emailResult = null;
    if (sendEmail) {
      console.log('[TestWeeklyReport] Sending test email...');
      emailResult = await sendWeeklySummaryEmail(testMetrics);
      console.log('[TestWeeklyReport] Email result:', emailResult);
    }

    return NextResponse.json({
      success: true,
      message: sendEmail ? 'Test report generated and emailed' : 'Test report generated (email not sent)',
      metrics: testMetrics,
      emailResult,
    });
  } catch (error) {
    console.error('[TestWeeklyReport] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/test-weekly-report
 *
 * Request body:
 * - sendEmail: boolean
 * - customRange: boolean
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Convert POST body to query params for GET handler
    const params = new URLSearchParams();
    if (body.sendEmail) params.set('sendEmail', 'true');
    if (body.customRange) params.set('customRange', 'true');
    if (body.startDate) params.set('startDate', body.startDate);
    if (body.endDate) params.set('endDate', body.endDate);

    const url = new URL(request.url);
    url.search = params.toString();

    // Call GET handler with modified URL
    return GET(new Request(url.toString()));
  } catch (error) {
    console.error('[TestWeeklyReport] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body',
      },
      { status: 400 }
    );
  }
}