/**
 * Simple integration test to verify test setup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

describe('Simple Integration Test', () => {
  it('should work with Decimal', () => {
    const decimal = new Prisma.Decimal('15.5');
    expect(decimal.toString()).toBe('15.5');
  });

  it('should work with mocking', () => {
    const mockFn = vi.fn().mockReturnValue('mocked');
    expect(mockFn()).toBe('mocked');
  });
});