import { NextResponse } from 'next/server';
import { verifyLiquidityWorkerRequest } from '@/lib/liquidity/auth';
import { runLiquidityTick } from '@/lib/liquidity/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<{ marketId: string }> }): Promise<NextResponse> {
  if (!verifyLiquidityWorkerRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { marketId } = await context.params;
  const id = Number(marketId);
  if (!/^(0|[1-9]\d*)$/.test(marketId) || !Number.isSafeInteger(id))
    return NextResponse.json({ error: 'Invalid market ID' }, { status: 400 });
  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 128)
    return NextResponse.json({ error: 'Unexpected body' }, { status: 400 });
  const raw = await request.text();
  if (raw && raw.trim() !== '{}') return NextResponse.json({ error: 'Unexpected body' }, { status: 400 });
  try {
    const result = await runLiquidityTick(`market:${id}`);
    return NextResponse.json(result, { status: result.status === 'failed' || result.errors > 0 ? 503 : result.status === 'busy' ? 409 : result.status === 'in_flight' ? 202 : 200 });
  } catch {
    return NextResponse.json({ error: 'Liquidity service unavailable' }, { status: 503 });
  }
}
