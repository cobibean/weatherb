import { NextResponse } from 'next/server';
import { readDatabaseReadiness } from '@/lib/database-readiness';
import { readWorkerStatus } from '@/lib/worker-status';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const database = await readDatabaseReadiness();
  const worker = database.status === 'ready' ? await readWorkerStatus().catch(() => null) : null;
  return NextResponse.json(
    { scope: 'database', ...database, worker, checkedAt: new Date().toISOString() },
    { status: database.status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
