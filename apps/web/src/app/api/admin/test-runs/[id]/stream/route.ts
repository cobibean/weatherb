/**
 * Test Run Stream API - Server-Sent Events (SSE)
 *
 * Provides real-time updates for test run progress via SSE.
 * Used by the admin monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminWallet } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const verification = await verifyAdminWallet(authHeader.replace('Bearer ', ''));
    if (!verification.isValid) {
      return new Response('Invalid admin credentials', { status: 401 });
    }

    const { id: testRunId } = await params;

    // Create readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let intervalId: NodeJS.Timeout | null = null;

        try {
          // Poll function to check test run status
          const pollTestRun = async () => {
            try {
              const testRun = await db.testRun.findUnique({
                where: { id: testRunId },
                include: {
                  markets: {
                    select: {
                      id: true,
                      resolveTime: true,
                      cityName: true,
                      thresholdTemp: true,
                      createdAt: true,
                    },
                  },
                  suggestion: {
                    select: {
                      id: true,
                      customCityName: true,
                      latitude: true,
                      longitude: true,
                    },
                  },
                },
              });

              if (!testRun) {
                // Test run not found, close stream
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ error: 'Test run not found' })}\n\n`)
                );
                if (intervalId) clearInterval(intervalId);
                controller.close();
                return;
              }

              // Send update
              const sortedMarkets = [...testRun.markets].sort(
                (a, b) => a.resolveTime.getTime() - b.resolveTime.getTime()
              );
              const settledCount = Math.min(
                Math.max(testRun.marketsSettled, 0),
                sortedMarkets.length
              );

              const data = {
                id: testRun.id,
                status: testRun.status,
                createdAt: testRun.createdAt.toISOString(),
                completedAt: testRun.completedAt?.toISOString(),
                marketsCreated: testRun.marketsCreated,
                marketsSettled: testRun.marketsSettled,
                fundingAmount: testRun.fundingAmount.toString(),
                recoveredAmount: testRun.recoveredAmount?.toString(),
                netCost: testRun.netCost?.toString(),
                cityName: testRun.suggestion.customCityName,
                markets: sortedMarkets.map((m, index) => ({
                  id: m.id,
                  resolveTime: m.resolveTime.toISOString(),
                  isSettled: index < settledCount,
                  outcome: null,
                  city: m.cityName,
                  threshold: Math.round(m.thresholdTemp / 10),
                  createdAt: m.createdAt.toISOString(),
                })),
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              );

              // Close stream if test complete
              if (testRun.status !== 'RUNNING') {
                if (intervalId) clearInterval(intervalId);
                controller.close();
              }
            } catch (error) {
              console.error('[TestRunStream] Poll error:', error);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: 'Polling failed' })}\n\n`)
              );
            }
          };

          // Initial poll
          await pollTestRun();

          // Set up polling interval (every 10 seconds)
          intervalId = setInterval(pollTestRun, 10000);
        } catch (error) {
          console.error('[TestRunStream] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
    });
  } catch (error) {
    console.error('[TestRunStream] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create stream' },
      { status: 500 }
    );
  }
}
