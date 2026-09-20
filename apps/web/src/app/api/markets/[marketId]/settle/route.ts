import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { createContractClients, unauthorizedResponse, verifyWorkerRequest } from '@/lib/cron';
import { withSignerLease } from '@/lib/cron/lease';
import { requireRestartContract } from '@/lib/cron/market-state';
import { settleMarket, type SettlementResult } from '@/lib/cron/settlement';
import { recordWorkerRun, redactError, triggerFromRequest } from '@/lib/cron/worker-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const LEASE_SECONDS = 280;

type RouteParams = { params: Promise<{ marketId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!verifyWorkerRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) {
    if (readiness.status === 200)
      await recordWorkerRun('settle-market', triggerFromRequest(request), async () => ({
        status: 'skipped',
        summary: await readiness.clone().json(),
      }));
    return readiness;
  }
  const { marketId } = await params;
  if (!/^\d+$/.test(marketId) || !Number.isSafeInteger(Number(marketId))) {
    return NextResponse.json({ success: false, error: 'Invalid marketId' }, { status: 400 });
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
    const outcome = await recordWorkerRun<{
      marketId: string;
      result?: SettlementResult;
      busy?: boolean;
    }>('settle-market', triggerFromRequest(request), async (runId) => {
      const held = await withSignerLease(lease, runId, LEASE_SECONDS, async () => {
        await requireRestartContract(clients.publicClient, address);
        return settleMarket(clients, address, BigInt(marketId));
      });
      if (!held.acquired) return { status: 'busy', summary: { marketId, busy: true } };
      const result = held.value;
      return {
        status:
          result.action === 'pending' || result.action === 'in_flight' ? 'skipped' : 'succeeded',
        summary: { marketId, result },
      };
    });
    if (outcome.status === 'busy')
      return NextResponse.json({ success: false, busy: true }, { status: 409 });
    const result = outcome.summary.result!;
    const status = result.action === 'pending' ? 409 : result.action === 'in_flight' ? 202 : 200;
    return NextResponse.json({ success: status === 200, result }, { status });
  } catch (error) {
    console.error(`[SettleMarket] Market ${marketId} failed:`, redactError(error));
    return NextResponse.json(
      { success: false, error: 'Settlement or reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
