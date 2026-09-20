import { describe, it, expect, beforeEach } from 'vitest';
import { castVote, removeVote } from '../voting';
import prisma from '../prisma';

describe('Voting System', () => {
  beforeEach(async () => {
    // Clean test data
    await prisma.vote.deleteMany();
    await prisma.suggestion.deleteMany();
  });

  it('should cast a vote and increment count', async () => {
    // Create test suggestion
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest',
        status: 'PENDING',
      },
    });

    await castVote('0xvoter', suggestion.id);

    const updated = await prisma.suggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updated?.voteCount).toBe(1);
    expect(updated?.recentVoteCount).toBe(1);
  });

  it('should prevent duplicate votes', async () => {
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest',
        status: 'PENDING',
      },
    });

    await castVote('0xvoter', suggestion.id);

    // Second vote should fail
    await expect(castVote('0xvoter', suggestion.id)).rejects.toThrow();
  });

  it('should handle concurrent votes correctly', async () => {
    const suggestion = await prisma.suggestion.create({
      data: {
        customCityName: 'Test City',
        latitude: 40.7128,
        longitude: -74.0060,
        wallet: '0xtest',
        status: 'PENDING',
      },
    });

    // Simulate 5 concurrent votes (realistic concurrency level)
    const votePromises = Array.from({ length: 5 }, (_, i) =>
      castVote(`0xvoter${i}`, suggestion.id)
    );

    await Promise.all(votePromises);

    const updated = await prisma.suggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updated?.voteCount).toBe(5);
    expect(updated?.recentVoteCount).toBe(5);
  }, 15000); // Increase timeout for retries
});
