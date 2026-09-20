import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { verifyCronRequest, unauthorizedResponse, createContractClients } from '@/lib/cron';
import { reconcileMarkets, requireRestartContract } from '@/lib/cron/market-state';
import { settleMarket } from '@/lib/cron/settlement';

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyCronRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) return readiness;
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
    await requireRestartContract(clients.publicClient, address);
    const pending = await reconcileMarkets(clients.publicClient, address);
    const results = [];
    const errors = [];
    for (const id of pending) {
      try {
        results.push(await settleMarket(clients, address, id));
      } catch (error) {
        console.error(`[Settler] Market ${id} failed:`, error);
        errors.push({
          marketId: id.toString(),
          error: 'Settlement or reconciliation failed; retry required',
        });
      }
    }
    return NextResponse.json(
      {
        success: errors.length === 0,
        settled: results.filter((r) => r.action === 'settled').length,
        cancelled: results.filter((r) => r.action === 'cancelled').length,
        pending: results.filter((r) => r.action === 'pending').length,
        failed: errors.length,
        results,
        errors,
      },
      { status: errors.length ? 503 : 200 },
    );
  } catch (error) {
    console.error('[Settler] Reconciliation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Settlement reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
