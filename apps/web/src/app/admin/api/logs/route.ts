import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { getLogs } from '@/lib/admin-data';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action');
    const wallet = searchParams.get('wallet');

    const result = await getLogs({ 
      page, 
      limit, 
      ...(action && { action }),
      ...(wallet && { wallet }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}

