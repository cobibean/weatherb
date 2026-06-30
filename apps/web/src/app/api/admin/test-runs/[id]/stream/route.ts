/**
 * Test Run Stream API - Server-Sent Events (SSE)
 *
 * Provides real-time updates for test run progress via SSE.
 * Used by the admin monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication via cookie
    const auth = await requireAdminAuth();
    if (!auth.authenticated) {
      return new Response(auth.error, { status: 401 });
    }

    const { id: testRunId } = await params;

    // Create readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let intervalId: NodeJS.Timeout | null = null;
        let isClosed = false;

        // Helper to safely enqueue data
        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(data));
            } catch {
              // Stream was closed, stop polling
              isClosed = true;
              if (intervalId) clearInterval(intervalId);
            }
          }
        };

        try {
          // Poll function to check test run status
          const pollTestRun = async () => {
            if (isClosed) return; // Skip if closed
            
            try {
              const testRun = await db.testRun.findUnique({
                where: { id: testRunId },
                include: {
                  markets: {
                    select: {
                      id: true,
                      contractMarketId: true, // Need this to match bets
                      resolveTime: true,
                      isSettled: true,
                      settledAt: true,
                      outcome: true,
                      cityName: true,
                      thresholdTemp: true,
                      actualTemp: true,
                      createdAt: true,
                    },
                    orderBy: {
                      resolveTime: 'asc',
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
              
              // Extract bets from results JSON
              type BetData = {
                contractMarketId: number;
                wallet: string;
                isYes: boolean;
                amount: string;
                transactionHash: string;
              };
              const results = testRun?.results as { bets?: BetData[] } | null;
              const allBets = results?.bets || [];

              if (!testRun) {
                // Test run not found, close stream
                safeEnqueue(`data: ${JSON.stringify({ error: 'Test run not found' })}\n\n`);
                isClosed = true;
                if (intervalId) clearInterval(intervalId);
                try { controller.close(); } catch { /* already closed */ }
                return;
              }

              // Send update
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
                cityName: testRun.suggestion?.customCityName || 'Unknown City',
                markets: testRun.markets.map(m => {
                  // Find bets for this market
                  const marketBets = allBets.filter(b => b.contractMarketId === m.contractMarketId);
                  const yesBet = marketBets.find(b => b.isYes);
                  const noBet = marketBets.find(b => !b.isYes);
                  
                  return {
                    id: m.id,
                    contractMarketId: m.contractMarketId,
                    resolveTime: m.resolveTime.toISOString(),
                    isSettled: m.isSettled,
                    outcome: m.outcome,
                    city: m.cityName,
                    threshold: Math.round(m.thresholdTemp / 10),
                    actualTemp: m.actualTemp ? Math.round(m.actualTemp / 10) : undefined,
                    settledAt: m.settledAt?.toISOString(),
                    createdAt: m.createdAt.toISOString(),
                    // Bet data
                    bets: {
                      yes: yesBet ? { amount: yesBet.amount, wallet: yesBet.wallet.slice(0, 6) + '...' + yesBet.wallet.slice(-4) } : null,
                      no: noBet ? { amount: noBet.amount, wallet: noBet.wallet.slice(0, 6) + '...' + noBet.wallet.slice(-4) } : null,
                    },
                  };
                }),
              };

              safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);

              // Close stream if test complete
              if (testRun.status !== 'RUNNING') {
                isClosed = true;
                if (intervalId) clearInterval(intervalId);
                try { controller.close(); } catch { /* already closed */ }
              }
            } catch (error) {
              console.error('[TestRunStream] Poll error:', error);
              safeEnqueue(`data: ${JSON.stringify({ error: 'Polling failed' })}\n\n`);
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
