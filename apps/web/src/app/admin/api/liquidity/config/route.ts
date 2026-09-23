import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getLiquidityConfig, LiquidityConfigError, saveLiquidityConfig } from '@/lib/liquidity/admin-config';
import { updateConfigSchema } from '@/lib/liquidity/config';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminAuth();
  if (!auth.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await getLiquidityConfig()); }
  catch { return NextResponse.json({ error: 'Liquidity configuration unavailable' }, { status: 503 }); }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireAdminAuth();
  if (!auth.authenticated) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);
  if (!origin || origin !== requestUrl.origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
    return NextResponse.json({ error: 'JSON required' }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json({ error: 'Request too large' }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const input = updateConfigSchema.safeParse(parsed);
  if (!input.success) return NextResponse.json({ error: 'Invalid liquidity settings' }, { status: 400 });
  try { return NextResponse.json(await saveLiquidityConfig(auth.wallet, input.data)); }
  catch (error) {
    if (error instanceof LiquidityConfigError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Liquidity configuration unavailable' }, { status: 503 });
  }
}
