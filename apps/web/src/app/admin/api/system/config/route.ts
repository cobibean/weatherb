import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { getSystemConfig, updateSystemConfig } from '@/lib/admin-data';

const updateConfigSchema = z.object({
  cadence: z.number().int().min(1).max(60).optional(),
  testMode: z.boolean().optional(),
  dailyCount: z.number().int().min(1).max(5).optional(),
  bettingBuffer: z.number().int().min(60).max(3600).optional(), // 1 minute to 1 hour
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getSystemConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = updateConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const oldConfig = await getSystemConfig();
    const updateData: {
      cadence?: number;
      testMode?: boolean;
      dailyCount?: number;
      bettingBuffer?: number;
    } = {};
    
    if (parseResult.data.cadence !== undefined) updateData.cadence = parseResult.data.cadence;
    if (parseResult.data.testMode !== undefined) updateData.testMode = parseResult.data.testMode;
    if (parseResult.data.dailyCount !== undefined) updateData.dailyCount = parseResult.data.dailyCount;
    if (parseResult.data.bettingBuffer !== undefined) updateData.bettingBuffer = parseResult.data.bettingBuffer;
    
    const newConfig = await updateSystemConfig(updateData);

    // Log changes
    const changes: Record<string, { old: number | boolean; new: number | boolean }> = {};
    for (const [key, value] of Object.entries(parseResult.data)) {
      if (value !== undefined && oldConfig[key as keyof typeof oldConfig] !== value) {
        changes[key] = {
          old: oldConfig[key as keyof typeof oldConfig] as number | boolean,
          new: value,
        };
      }
    }

    if (Object.keys(changes).length > 0) {
      await logAdminAction(session.wallet, 'UPDATE_CONFIG', { changes } as object);
    }

    return NextResponse.json(newConfig);
  } catch (error) {
    console.error('Update config error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

