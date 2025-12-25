import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
});

describe('City Validation', () => {
  describe('name validation', () => {
    it('accepts valid city names', () => {
      expect(() => createCitySchema.parse({
        name: 'New York',
        latitude: 40.7,
        longitude: -74.0,
        timezone: 'America/New_York',
      })).not.toThrow();
    });

    it('rejects empty names', () => {
      expect(() => createCitySchema.parse({
        name: '',
        latitude: 40.7,
        longitude: -74.0,
        timezone: 'America/New_York',
      })).toThrow();
    });
  });

  describe('coordinate validation', () => {
    it('accepts valid coordinates', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
      })).not.toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 90,
        longitude: 180,
        timezone: 'UTC',
      })).not.toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: -90,
        longitude: -180,
        timezone: 'UTC',
      })).not.toThrow();
    });

    it('rejects invalid latitude', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 91,
        longitude: 0,
        timezone: 'UTC',
      })).toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: -91,
        longitude: 0,
        timezone: 'UTC',
      })).toThrow();
    });

    it('rejects invalid longitude', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 181,
        timezone: 'UTC',
      })).toThrow();

      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: -181,
        timezone: 'UTC',
      })).toThrow();
    });
  });

  describe('timezone validation', () => {
    it('accepts valid timezone strings', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: 'America/New_York',
      })).not.toThrow();
    });

    it('rejects empty timezone', () => {
      expect(() => createCitySchema.parse({
        name: 'Test',
        latitude: 0,
        longitude: 0,
        timezone: '',
      })).toThrow();
    });
  });
});

