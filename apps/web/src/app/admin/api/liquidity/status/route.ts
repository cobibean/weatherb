import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getLiquidityStatus } from '@/lib/liquidity/status';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAdminAuth();
  if (!auth.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit') ?? '25';
  const limit = Number(rawLimit);
  if (!/^\d{1,3}$/.test(rawLimit) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  const cursor = url.searchParams.get('cursor') ?? undefined;
  if (cursor && !/^[A-Za-z0-9_-]{1,64}$/.test(cursor)) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  const positionCursor = url.searchParams.get('positionCursor') ?? undefined;
  if (positionCursor && !/^[A-Za-z0-9_-]{1,64}$/.test(positionCursor)) return NextResponse.json({ error: 'Invalid position cursor' }, { status: 400 });
  try { return NextResponse.json(await getLiquidityStatus(cursor, limit, positionCursor)); }
  catch { return NextResponse.json({ error: 'Liquidity status unavailable' }, { status: 503 }); }
}
