import { NextResponse } from 'next/server';
import { readDatabaseReadiness } from '@/lib/database-readiness';

/** Fail before weather/RPC/transaction work when storage is unhealthy or automation paused. */
export async function automationReadinessResponse(
  kind: 'scheduler' | 'settler',
): Promise<NextResponse | null> {
  const readiness = await readDatabaseReadiness();
  if (readiness.status !== 'ready') {
    return NextResponse.json(
      { success: false, error: 'Database is not ready', database: readiness.status },
      { status: 503 },
    );
  }
  if (readiness[kind] === 'paused') {
    return NextResponse.json({ success: true, skipped: true, reason: `${kind} is paused` });
  }
  return null;
}
