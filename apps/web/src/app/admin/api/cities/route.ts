import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { getCities, createCity, toggleCityActive } from '@/lib/admin-data';

const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
});

const toggleCitySchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cities = await getCities();
    return NextResponse.json({ cities });
  } catch (error) {
    console.error('Get cities error:', error);
    return NextResponse.json({ error: 'Failed to get cities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createCitySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const city = await createCity(parseResult.data);

    await logAdminAction(session.wallet, 'CREATE_CITY', {
      cityId: city.id,
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: city.timezone,
    });

    return NextResponse.json({ city });
  } catch (error) {
    console.error('Create city error:', error);
    return NextResponse.json({ error: 'Failed to create city' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = toggleCitySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const city = await toggleCityActive(parseResult.data.id, parseResult.data.isActive);

    await logAdminAction(
      session.wallet,
      parseResult.data.isActive ? 'ACTIVATE_CITY' : 'DEACTIVATE_CITY',
      { cityId: city.id, name: city.name }
    );

    return NextResponse.json({ city });
  } catch (error) {
    console.error('Toggle city error:', error);
    return NextResponse.json({ error: 'Failed to update city' }, { status: 500 });
  }
}

