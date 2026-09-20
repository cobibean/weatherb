import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyWorkerRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import {
  readMarket,
  reconcileOutstandingMarkets,
  requireRestartContract,
} from '@/lib/cron/market-state';
import { settleMarket, type SettlementResult } from '@/lib/cron/settlement';
import { ensureSettlementScheduled } from '@/lib/cron/settlement-schedule';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type SweepSummary = {
  settled: number;
  cancelled: number;
  pending: number;
  inFlight: number;
  reconciled: number;
  failed: number;
  results: SettlementResult[];
  errors: { marketId: string; error: string }[];
};

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) {
    if (readiness.status === 200)
      await recordWorkerRun('settle-sweep', triggerFromRequest(request), async () => ({
        status: 'skipped',
        summary: await readiness.clone().json(),
      }));
    return readiness;
  }
  const rpcUrl = process.env.RPC_URL;
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;
  if (!rpcUrl || !address || !privateKey)
    return NextResponse.json(
      { success: false, error: 'Missing settlement configuration' },
      { status: 500 },
    );
  try {
    const clients = createContractClients({ rpcUrl, privateKey });
    const lease = `settler:${clients.walletClient.account!.address.toLowerCase()}`;
    const outcome = await recordWorkerRun<Partial<SweepSummary> & { busy?: boolean }>(
      'settle-sweep',
      triggerFromRequest(request),
      async (runId) => {
        const result = await withSignerLease(lease, runId, LEASE_SECONDS, async () => {
          await requireRestartContract(clients.publicClient, address);
          const pending = await reconcileOutstandingMarkets(clients.publicClient, address);
          const summary: SweepSummary = {
            settled: 0, cancelled: 0, pending: 0, inFlight: 0, reconciled: 0, failed: 0,
            results: [], errors: [],
          };
          for (const id of pending) {
            try {
              const result = await settleMarket(clients, address, id);
              summary.results.push(result);
              if (result.action === 'settled') summary.settled++;
              else if (result.action === 'cancelled') summary.cancelled++;
              else if (result.action === 'in_flight') summary.inFlight++;
              else if (result.action === 'reconciled') summary.reconciled++;
              else {
                summary.pending++;
                const market = await readMarket(clients.publicClient, address, id);
                await ensureSettlementScheduled(id, Number(market.resolveTime)).catch((error) =>
                  console.warn('[Settler] Could not schedule delivery:', redactError(error)),
                );
              }
            } catch (error) {
              console.error(`[Settler] Market ${id} failed:`, redactError(error));
              summary.failed++;
              summary.errors.push({ marketId: id.toString(), error: redactError(error) });
            }
          }
          return summary;
        });
        if (!result.acquired) return { status: 'busy', summary: { busy: true } };
        return {
          status: result.value.failed ? 'failed' : 'succeeded',
          summary: result.value,
          error: result.value.failed ? `${result.value.failed} market(s) failed` : undefined,
        };
      },
    );
    if (outcome.status === 'busy')
      return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const summary = outcome.summary as SweepSummary;
    return NextResponse.json(
      { success: summary.failed === 0, ...summary },
      { status: summary.failed ? 503 : 200 },
    );
  } catch (error) {
    console.error('[Settler] Reconciliation failed:', redactError(error));
    return NextResponse.json(
      { success: false, error: 'Settlement reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
