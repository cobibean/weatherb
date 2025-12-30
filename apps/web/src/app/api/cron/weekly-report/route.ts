/**
 * Weekly Report Cron Job - Epic 8
 * Runs every Monday at 9:00 AM UTC to send weekly summary emails
 *
 * Cron schedule: 0 9 * * 1 (At 09:00 on Monday)
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { collectWeeklyMetrics } from '@/lib/metrics';
import { sendWeeklySummaryEmail } from '@/lib/email';
import {
  generateWeeklyInsights,
  generateFallbackInsights,
  formatInsightsForEmail,
  validateInsights
} from '@/lib/ai-insights';

// Validate cron secret for security
function validateCronSecret(headersList: Headers): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[WeeklyReport] CRON_SECRET not configured');
    return true; // Allow in development
  }

  const authHeader = headersList.get('authorization');
  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  console.log('[WeeklyReport] Starting weekly report generation');

  try {
    // Validate the request is from Vercel Cron
    const headersList = await headers();
    if (!validateCronSecret(headersList)) {
      console.error('[WeeklyReport] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if email is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('[WeeklyReport] RESEND_API_KEY not configured, skipping email');
      return NextResponse.json({
        success: true,
        message: 'Email not configured',
        duration: Date.now() - startTime,
      });
    }

    if (!process.env.ADMIN_EMAIL) {
      console.warn('[WeeklyReport] ADMIN_EMAIL not configured, skipping email');
      return NextResponse.json({
        success: true,
        message: 'Admin email not configured',
        duration: Date.now() - startTime,
      });
    }

    // Collect weekly metrics
    console.log('[WeeklyReport] Collecting weekly metrics...');
    const metrics = await collectWeeklyMetrics();

    // Log summary of collected metrics
    console.log('[WeeklyReport] Metrics collected:', {
      dateRange: `${metrics.startDate} - ${metrics.endDate}`,
      totalMarkets: metrics.totalMarkets,
      totalVolume: metrics.totalVolume,
      uniqueBettors: metrics.uniqueBettors,
      topCitiesCount: metrics.topCities.length,
      approvedCitiesCount: metrics.approvedCities.length,
      marketHighlightsCount: metrics.marketHighlights.length,
    });

    // Generate AI insights
    console.log('[WeeklyReport] Generating AI insights...');
    let aiInsights: string | undefined;

    // Convert metrics to format expected by AI service
    const aiMetrics = {
      totalMarkets: metrics.totalMarkets,
      totalVolume: metrics.totalVolume,
      totalPayouts: metrics.totalPayouts,
      uniqueBettors: metrics.uniqueBettors,
      topCities: metrics.topCities.map(city => ({
        name: city.name,
        markets: city.markets,
        volume: city.volume,
      })),
      marketHighlights: metrics.marketHighlights.map(m => ({
        city: m.city,
        date: m.date,
        threshold: m.threshold,
        actual: m.actual,
        volume: m.volume,
        outcome: m.outcome,
      })),
      approvedCities: metrics.approvedCities,
      testRunsCompleted: 0, // Will be added in actual metrics collection
      testRunSuccessRate: 100, // Will be calculated from actual data
    };

    const insightsResult = await generateWeeklyInsights({
      metrics: aiMetrics,
      startDate: metrics.startDate,
      endDate: metrics.endDate,
    });

    if (insightsResult.success && insightsResult.insights) {
      // Validate and format the insights
      if (validateInsights(insightsResult.insights)) {
        aiInsights = formatInsightsForEmail(insightsResult.insights);
        console.log('[WeeklyReport] AI insights generated successfully');
      } else {
        console.warn('[WeeklyReport] AI insights failed validation, using fallback');
        aiInsights = generateFallbackInsights(aiMetrics);
      }
    } else {
      // Use fallback insights if AI generation failed
      console.warn('[WeeklyReport] AI generation failed, using fallback insights');
      aiInsights = generateFallbackInsights(aiMetrics);
    }

    // Add AI insights to metrics
    const metricsWithInsights = {
      ...metrics,
      aiInsights,
    };

    // Send the weekly summary email
    console.log('[WeeklyReport] Sending weekly summary email...');
    const emailResult = await sendWeeklySummaryEmail(metricsWithInsights);

    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[WeeklyReport] Completed successfully in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Weekly report sent successfully',
      metrics: {
        totalMarkets: metrics.totalMarkets,
        totalVolume: metrics.totalVolume,
        uniqueBettors: metrics.uniqueBettors,
        dateRange: `${metrics.startDate} - ${metrics.endDate}`,
      },
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[WeeklyReport] Error generating weekly report:', error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      },
      { status: 500 }
    );
  }
}

// Support POST for manual testing via admin panel
export async function POST(request: Request) {
  console.log('[WeeklyReport] Manual trigger via POST');

  try {
    // Check for admin authentication
    // In a production environment, you would verify admin session here
    const body = await request.json().catch(() => ({}));

    if (body.adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Reuse GET handler logic
    return GET(request);
  } catch (error) {
    console.error('[WeeklyReport] Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}