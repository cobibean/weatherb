import { NextResponse } from 'next/server';
import { readDatabaseReadiness } from '@/lib/database-readiness';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const database = await readDatabaseReadiness();
  return NextResponse.json(
    { scope: 'database', ...database, checkedAt: new Date().toISOString() },
    { status: database.status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
