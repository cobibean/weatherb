import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWeatherProviderFromEnv } from '../factory';

describe('createWeatherProviderFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Set to open-meteo to avoid MET_NO_USER_AGENT requirement
    process.env.WEATHER_PROVIDER = 'open-meteo';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates provider with default stack', () => {
    const provider = createWeatherProviderFromEnv();
    expect(provider).toBeDefined();
    expect(provider.name).toBeDefined();
  });

  it('has required methods', () => {
    const provider = createWeatherProviderFromEnv();
    expect(typeof provider.getForecast).toBe('function');
    expect(typeof provider.getFirstReadingAtOrAfter).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });
});
