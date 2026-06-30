import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, logAdminAction } from '@/lib/admin-session';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { TEST_CITIES } from '@weatherb/shared/constants';
import { recordProviderSuccess, recordProviderError } from '@/lib/provider-health';
import type { WeatherReading } from '@weatherb/shared/types';

/**
 * POST /admin/api/provider/test
 * 
 * Test the weather provider by fetching temperature for a random city.
 * Updates provider health status based on success/failure.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pick a random city from the test cities list
    const randomIndex = Math.floor(Math.random() * TEST_CITIES.length);
    const city = TEST_CITIES[randomIndex];
    if (!city) {
      return NextResponse.json({ error: 'No test cities available' }, { status: 500 });
    }

    // Get current timestamp (Unix seconds)
    const nowSec = Math.floor(Date.now() / 1000);

    // Create weather provider and fetch temperature
    const provider = createWeatherProviderFromEnv();
    let reading: WeatherReading;
    let success = false;

    try {
      reading = await provider.getFirstReadingAtOrAfter(
        city.latitude,
        city.longitude,
        nowSec
      );
      
      // Record success
      await recordProviderSuccess();
      success = true;

      // Log the successful test
      await logAdminAction(session.wallet, 'TEST_PROVIDER', {
        city: city.name,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
        temperature: reading.tempF_tenths,
        source: reading.source,
        success: true,
      });

      // Format temperature for display (convert from tenths to whole degrees)
      const tempF = reading.tempF_tenths / 10;
      const temperatureDisplay = `${tempF.toFixed(1)}°F`;

      return NextResponse.json({
        success: true,
        city: {
          name: city.name,
          country: city.country,
          latitude: city.latitude,
          longitude: city.longitude,
        },
        temperature: reading.tempF_tenths,
        temperatureDisplay,
        observedTimestamp: reading.observedTimestamp,
        source: reading.source,
      });
    } catch (error) {
      // Record error
      await recordProviderError();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the failed test
      await logAdminAction(session.wallet, 'TEST_PROVIDER', {
        city: city.name,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
        success: false,
        error: errorMessage,
      });

      return NextResponse.json(
        {
          success: false,
          city: {
            name: city.name,
            country: city.country,
            latitude: city.latitude,
            longitude: city.longitude,
          },
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Provider test error:', error);
    return NextResponse.json(
      { error: 'Failed to test provider', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
