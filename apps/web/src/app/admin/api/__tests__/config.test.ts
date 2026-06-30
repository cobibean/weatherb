import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the validation schema directly
const configUpdateSchema = z.object({
  cadence: z.number().min(1).max(60).optional(),
  testMode: z.boolean().optional(),
  dailyCount: z.number().min(1).max(5).optional(),
  bettingBuffer: z.number().min(60).max(3600).optional(),
});

describe('System Config Validation', () => {
  describe('cadence validation', () => {
    it('accepts valid cadence (1-60)', () => {
      expect(() => configUpdateSchema.parse({ cadence: 5 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ cadence: 1 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ cadence: 60 })).not.toThrow();
    });

    it('rejects cadence below 1', () => {
      expect(() => configUpdateSchema.parse({ cadence: 0 })).toThrow();
    });

    it('rejects cadence above 60', () => {
      expect(() => configUpdateSchema.parse({ cadence: 61 })).toThrow();
    });
  });

  describe('dailyCount validation', () => {
    it('accepts valid dailyCount (1-5)', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 1 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ dailyCount: 5 })).not.toThrow();
    });

    it('rejects dailyCount above 5 (max markets constraint)', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 6 })).toThrow();
    });

    it('rejects dailyCount below 1', () => {
      expect(() => configUpdateSchema.parse({ dailyCount: 0 })).toThrow();
    });
  });

  describe('bettingBuffer validation', () => {
    it('accepts valid buffer (60-3600 seconds)', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 600 })).not.toThrow(); // 10 min default
      expect(() => configUpdateSchema.parse({ bettingBuffer: 60 })).not.toThrow();
      expect(() => configUpdateSchema.parse({ bettingBuffer: 3600 })).not.toThrow();
    });

    it('rejects buffer below 60 seconds', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 30 })).toThrow();
    });

    it('rejects buffer above 3600 seconds', () => {
      expect(() => configUpdateSchema.parse({ bettingBuffer: 7200 })).toThrow();
    });
  });

  describe('testMode validation', () => {
    it('accepts boolean values', () => {
      expect(() => configUpdateSchema.parse({ testMode: true })).not.toThrow();
      expect(() => configUpdateSchema.parse({ testMode: false })).not.toThrow();
    });
  });

  describe('partial updates', () => {
    it('allows partial updates', () => {
      expect(() => configUpdateSchema.parse({ cadence: 5 })).not.toThrow();
      expect(() => configUpdateSchema.parse({})).not.toThrow();
    });

    it('allows multiple fields', () => {
      expect(() => configUpdateSchema.parse({
        cadence: 5,
        dailyCount: 3,
        testMode: true,
      })).not.toThrow();
    });
  });
});

