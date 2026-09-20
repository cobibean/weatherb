import { validateSettlementReading, SETTLEMENT_WINDOW_SECONDS } from '../utils/weather-timing';
import type { WeatherProvider, WeatherReading, ProviderHealth } from '../types/provider';

export interface TomorrowIoConfig {
  apiKey: string;
}

interface TomorrowIoRealtimeResponse {
  data: {
    time: string; // ISO 8601 timestamp
    values: {
      temperature: number; // Celsius
      humidity?: number;
      precipitationProbability?: number;
      [key: string]: unknown;
    };
  };
  location: {
    lat: number;
    lon: number;
  };
}

interface TomorrowIoForecastResponse {
  timelines: {
    minutely?: Array<{
      time: string;
      values: {
        temperature: number; // Celsius
        [key: string]: unknown;
      };
    }>;
    hourly?: Array<{
      time: string;
      values: {
        temperature: number; // Celsius
        [key: string]: unknown;
      };
    }>;
    daily?: Array<{
      time: string;
      values: {
        temperature: number; // Celsius
        [key: string]: unknown;
      };
    }>;
  };
  location: {
    lat: number;
    lon: number;
  };
}

/**
 * Tomorrow.io Weather Provider
 *
 * Uses Tomorrow.io API for both realtime and forecast data.
 * Free tier: 50 API calls/day
 *
 * API Endpoints:
 * - Realtime: GET /v4/weather/realtime (current conditions)
 * - Forecast: GET /v4/weather/forecast (hourly forecasts for next 5 days)
 *
 * @see https://docs.tomorrow.io/reference/weather-forecast
 */
export class TomorrowIoProvider implements WeatherProvider {
  readonly name = 'tomorrow-io';
  private apiKey: string;
  private realtimeUrl = 'https://api.tomorrow.io/v4/weather/realtime';
  private forecastUrl = 'https://api.tomorrow.io/v4/weather/forecast';

  constructor(config: TomorrowIoConfig) {
    if (!config.apiKey) {
      throw new Error('TomorrowIoProvider requires apiKey');
    }
    this.apiKey = config.apiKey;
  }

  /**
   * Convert Celsius to Fahrenheit tenths
   * Formula: (C × 9/5) + 32, then multiply by 10 and round
   * Example: 30.5°C → 86.9°F → 869 tenths
   */
  private celsiusToFahrenheitTenths(celsius: number): number {
    const fahrenheit = (celsius * 9) / 5 + 32;
    return Math.round(fahrenheit * 10);
  }

  /**
   * Fetch current temperature from Tomorrow.io Realtime API
   *
   * @param latitude Location latitude
   * @param longitude Location longitude
   * @returns Current temperature reading with timestamp
   */
  async getCurrentTemperature(latitude: number, longitude: number): Promise<WeatherReading> {
    const url = new URL(this.realtimeUrl);
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('apikey', this.apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Tomorrow.io Realtime API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data: TomorrowIoRealtimeResponse = await response.json();

    if (!data.data?.values?.temperature || !data.data?.time) {
      throw new Error(
        'Invalid response from Tomorrow.io Realtime API: missing temperature or time',
      );
    }

    const tempCelsius = data.data.values.temperature;
    const tempFTenths = this.celsiusToFahrenheitTenths(tempCelsius);
    const observedTimestamp = Math.floor(new Date(data.data.time).getTime() / 1000);

    return {
      tempF_tenths: tempFTenths,
      observedTimestamp,
      source: this.name,
    };
  }

  /**
   * Get temperature reading at or after target time.
   *
   * For Tomorrow.io, we use the Realtime API which gives current conditions.
   * This is called during settlement, which should happen shortly after the market's resolve time.
   *
   * Only observations within ten minutes after the target are accepted. Expired
   * targets are rejected before fetching realtime data; the worker cancels them.
   * This method does not substitute current conditions for historical observations.
   *
   * @param latitude Location latitude
   * @param longitude Location longitude
   * @param targetTimestamp Unix timestamp of when we want the temperature
   * @returns A validated observation within the settlement window
   */
  async getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    targetTimestamp: number,
  ): Promise<WeatherReading> {
    const now = Math.floor(Date.now() / 1000);
    if (now < targetTimestamp || now > targetTimestamp + SETTLEMENT_WINDOW_SECONDS) {
      throw new Error('Current weather cannot resolve this target time');
    }
    const reading = await this.getCurrentTemperature(latitude, longitude);
    validateSettlementReading(reading, targetTimestamp);

    return reading;
  }

  /**
   * Get forecast temperature for a future time.
   *
   * Uses Tomorrow.io Forecast API to get hourly forecasts.
   * Returns the temperature for the closest hourly forecast to the target time.
   *
   * @param latitude Location latitude
   * @param longitude Location longitude
   * @param targetTimestamp Unix timestamp of when we want the forecast
   * @returns Forecast temperature in tenths of °F
   */
  async getForecast(latitude: number, longitude: number, targetTimestamp: number): Promise<number> {
    const url = new URL(this.forecastUrl);
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('apikey', this.apiKey);
    // Request hourly timeline for accurate forecasts
    url.searchParams.set('timesteps', 'hourly');
    // Only get temperature field to minimize response size
    url.searchParams.set('fields', 'temperature');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Tomorrow.io Forecast API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data: TomorrowIoForecastResponse = await response.json();

    if (!data.timelines?.hourly || data.timelines.hourly.length === 0) {
      throw new Error('Invalid response from Tomorrow.io Forecast API: missing hourly timeline');
    }

    // Find the forecast closest to target time
    const targetDate = new Date(targetTimestamp * 1000);
    let closestForecast = data.timelines.hourly[0];
    let minDiff = Math.abs(new Date(closestForecast!.time).getTime() - targetDate.getTime());

    for (const forecast of data.timelines.hourly) {
      const forecastTime = new Date(forecast.time);
      const diff = Math.abs(forecastTime.getTime() - targetDate.getTime());

      if (diff < minDiff) {
        minDiff = diff;
        closestForecast = forecast;
      }

      // If we've passed the target time, we can stop searching
      if (forecastTime.getTime() > targetDate.getTime()) {
        break;
      }
    }

    if (!closestForecast?.values?.temperature) {
      throw new Error('No valid temperature forecast found');
    }

    const tempCelsius = closestForecast.values.temperature;
    const tempFTenths = this.celsiusToFahrenheitTenths(tempCelsius);

    console.log(
      `[Tomorrow.io] Forecast for ${new Date(targetTimestamp * 1000).toISOString()}: ` +
        `${tempFTenths / 10}°F (from ${closestForecast.time}, ${Math.floor(minDiff / 1000 / 60)} min away)`,
    );

    return tempFTenths;
  }

  /**
   * Health check for Tomorrow.io API.
   *
   * Makes a lightweight API call to verify the service is responding.
   * Uses a fixed location (NYC) to keep the test consistent.
   *
   * @returns Health status with latency and error information
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    const testLat = 40.7128; // NYC
    const testLon = -74.006;

    try {
      const url = new URL(this.realtimeUrl);
      url.searchParams.set('location', `${testLat},${testLon}`);
      url.searchParams.set('apikey', this.apiKey);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'red',
          latencyMs,
          lastCheck: Date.now(),
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data: TomorrowIoRealtimeResponse = await response.json();

      if (!data.data?.values?.temperature) {
        return {
          status: 'yellow',
          latencyMs,
          lastCheck: Date.now(),
          errorMessage: 'Missing temperature data in response',
        };
      }

      return {
        status: 'green',
        latencyMs,
        lastCheck: Date.now(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        status: 'red',
        latencyMs,
        lastCheck: Date.now(),
        errorMessage,
      };
    }
  }
}
