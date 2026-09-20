import type { Market, Suggestion, SuggestionStatus, TimeWindow, WorkerLease, WorkerRun } from '@prisma/client';
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

describe('worker operations schema', () => {
  it('exposes settlement tracking and worker models', () => {
    const market: Pick<
      Market,
      'settlementAttempts' | 'settlementTxHash' | 'settlementSubmittedAt' | 'settlementMessageId'
    > = {
      settlementAttempts: 0,
      settlementTxHash: null,
      settlementSubmittedAt: null,
      settlementMessageId: null,
    };
    const run: Pick<WorkerRun, 'kind' | 'status'> = { kind: 'settle-sweep', status: 'running' };
    const lease: Pick<WorkerLease, 'id' | 'holder'> = { id: 'settler:0xabc', holder: 'run-1' };
    expect([market, run, lease]).toHaveLength(3);
  });
});
