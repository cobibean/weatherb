import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWeatherProviderFromEnv } from '../factory';

describe('createWeatherProviderFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TOMORROW_IO_API_KEY = 'test';
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
