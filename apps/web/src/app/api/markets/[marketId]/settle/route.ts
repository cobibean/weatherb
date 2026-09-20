import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { automationReadinessResponse } from '@/lib/cron/readiness';
import { createContractClients, unauthorizedResponse, verifyCronRequest } from '@/lib/cron';
import { requireRestartContract } from '@/lib/cron/market-state';
import { settleMarket } from '@/lib/cron/settlement';

type RouteParams = { params: Promise<{ marketId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  if (!verifyCronRequest(request)) return unauthorizedResponse();
  const readiness = await automationReadinessResponse('settler');
  if (readiness) return readiness;
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
    await requireRestartContract(clients.publicClient, address);
    const result = await settleMarket(clients, address, BigInt(marketId));
    const status =
      result.action === 'pending' ? 409 : result.action === 'in_flight' ? 202 : 200;
    return NextResponse.json({ success: status === 200, result }, { status });
  } catch (error) {
    console.error(`[SettleMarket] Market ${marketId} failed:`, error);
    return NextResponse.json(
      { success: false, error: 'Settlement or reconciliation failed; retry required' },
      { status: 503 },
    );
  }
}
