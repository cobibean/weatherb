import type { Suggestion, SuggestionStatus, TimeWindow } from '@prisma/client';
import { describe, expect, it } from 'vitest';

describe('Schema Types', () => {
  it('should have correct Suggestion type', () => {
    const suggestion: Suggestion = {
      id: 'test',
      cityId: null,
      customCityName: 'Test',
      latitude: 40.7,
      longitude: -74.0,
      timeWindow: 'MORNING',
      comment: 'Test comment',
      wallet: '0xtest',
      status: 'PENDING',
      voteCount: 0,
      recentVoteCount: 0,
      lastVoteAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(suggestion).toBeDefined();
  });

  it('should have correct enum types', () => {
    const status: SuggestionStatus = 'PENDING';
    const window: TimeWindow = 'AFTERNOON';
    expect(status).toBe('PENDING');
    expect(window).toBe('AFTERNOON');
  });
});
