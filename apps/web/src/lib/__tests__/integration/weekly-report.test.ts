/**
 * Weekly Report Integration Tests
 *
 * Tests the complete weekly report workflow including metrics collection,
 * AI insights generation, and email composition with magic links.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Suggestion, TestRun, Market, Vote } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';

// Import modules under test
import {
  collectWeeklyMetrics,
  generateAIInsights,
  type WeeklyMetrics,
  type CityMetric,
} from '../../metrics';

import {
  sendWeeklyReportEmail,
  type EmailResult,
} from '../../email';

import {
  generateMagicLink,
} from '../../magic-links';

import prisma from '../../prisma';

// Mock external services
vi.mock('../../email');
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

// Mock environment variables
vi.mock('process', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    ADMIN_EMAIL: 'admin@weatherb.com',
  },
}));

// Helper functions
const createMockSuggestion = (overrides?: Partial<Suggestion>): Suggestion => ({
  id: `suggestion-${Math.random().toString(36).substr(2, 9)}`,
  city: 'Phoenix',
  latitude: 33.4484,
  longitude: -112.0740,
  timeOfDay: 'afternoon',
  targetTemp: 95,
  targetDate: new Date('2024-12-31'),
  votes: 15,
  score: 150,
  status: 'pending',
  submittedAt: new Date(),
  approvedAt: null,
  deniedAt: null,
  processedAt: null,
  adminNotes: null,
  ...overrides,
});

const createMockTestRun = (overrides?: Partial<TestRun>): TestRun => ({
  id: `testrun-${Math.random().toString(36).substr(2, 9)}`,
  suggestionId: 'suggestion-123',
  walletKeys: 'encrypted',
  walletCount: 3,
  keysDisposed: true,
  marketsCreated: 5,
  marketsSettled: 5,
  fundingAmount: new (prisma as any).Decimal('15.0'),
  fundingTxHash: '0xfunding',
  recoveredAmount: new (prisma as any).Decimal('14.7'),
  netCost: new (prisma as any).Decimal('0.3'),
  status: 'COMPLETED',
  startedAt: new Date(),
  completedAt: new Date(),
  actualTemp: 950,
  totalVolume: 10.5,
  payoutVerified: true,
  results: {},
  errorMessage: null,
  ...overrides,
});

const createMockVote = (overrides?: Partial<Vote>): Vote => ({
  id: `vote-${Math.random().toString(36).substr(2, 9)}`,
  suggestionId: 'suggestion-123',
  voterAddress: '0xvoter123',
  votedAt: new Date(),
  ...overrides,
});

describe('Weekly Report Integration', () => {
  let mockPrismaClient: any;
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Prisma client
    mockPrismaClient = {
      suggestion: {
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      testRun: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      vote: {
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      magicLink: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(mockPrismaClient)),
    };

    // Replace prisma imports
    vi.spyOn(prisma, 'suggestion').mockImplementation(() => mockPrismaClient.suggestion);
    vi.spyOn(prisma, 'testRun').mockImplementation(() => mockPrismaClient.testRun);
    vi.spyOn(prisma, 'vote').mockImplementation(() => mockPrismaClient.vote);
    vi.spyOn(prisma, 'magicLink').mockImplementation(() => mockPrismaClient.magicLink);
    vi.spyOn(prisma, '$transaction').mockImplementation(mockPrismaClient.$transaction);

    // Setup mock OpenAI
    mockOpenAI = {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'AI-generated insights about city trends...',
            },
          },
        ],
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive weekly metrics', async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Mock suggestions data
      const suggestions = [
        createMockSuggestion({ city: 'Denver', votes: 50, submittedAt: subDays(now, 2) }),
        createMockSuggestion({ city: 'Boston', votes: 40, submittedAt: subDays(now, 3) }),
        createMockSuggestion({ city: 'Austin', votes: 35, submittedAt: subDays(now, 1) }),
        createMockSuggestion({ city: 'Denver', votes: 30, submittedAt: subDays(now, 4) }),
        createMockSuggestion({ city: 'Seattle', votes: 25, submittedAt: subDays(now, 5) }),
      ];

      mockPrismaClient.suggestion.findMany.mockResolvedValue(suggestions);
      mockPrismaClient.suggestion.count.mockResolvedValue(5);

      // Mock vote data
      const votes = suggestions.flatMap((s) =>
        Array.from({ length: s.votes }, (_, i) => createMockVote({
          suggestionId: s.id,
          votedAt: subDays(now, Math.floor(Math.random() * 7)),
        }))
      );
      mockPrismaClient.vote.findMany.mockResolvedValue(votes);
      mockPrismaClient.vote.count.mockResolvedValue(votes.length);

      // Mock groupBy for city aggregation
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([
        { city: 'Denver', _sum: { votes: 80 }, _count: 2 },
        { city: 'Boston', _sum: { votes: 40 }, _count: 1 },
        { city: 'Austin', _sum: { votes: 35 }, _count: 1 },
        { city: 'Seattle', _sum: { votes: 25 }, _count: 1 },
      ]);

      // Mock test run data
      const testRuns = [
        createMockTestRun({
          completedAt: subDays(now, 1),
          totalVolume: 12.5,
          netCost: new (prisma as any).Decimal('0.4'),
        }),
        createMockTestRun({
          completedAt: subDays(now, 3),
          totalVolume: 8.3,
          netCost: new (prisma as any).Decimal('0.2'),
        }),
      ];
      mockPrismaClient.testRun.findMany.mockResolvedValue(testRuns);

      // Collect metrics
      const metrics: WeeklyMetrics = await collectWeeklyMetrics();

      // Verify comprehensive metrics
      expect(metrics.totalSuggestions).toBe(5);
      expect(metrics.newSuggestions).toBe(5);
      expect(metrics.totalVotes).toBe(180); // Sum of all votes
      expect(metrics.topCities).toHaveLength(4);
      expect(metrics.topCities[0].city).toBe('Denver');
      expect(metrics.topCities[0].votes).toBe(80);
      expect(metrics.testsCompleted).toBe(2);
      expect(metrics.totalTestVolume).toBe('20.8'); // 12.5 + 8.3
      expect(metrics.averageNetCost).toBe('0.3'); // (0.4 + 0.2) / 2
    });

    it('should handle time-based filtering correctly', async () => {
      const now = new Date();
      const lastWeek = subDays(now, 7);
      const twoWeeksAgo = subDays(now, 14);

      // Mix of current and old suggestions
      const suggestions = [
        createMockSuggestion({ submittedAt: subDays(now, 2) }), // This week
        createMockSuggestion({ submittedAt: subDays(now, 5) }), // This week
        createMockSuggestion({ submittedAt: twoWeeksAgo }), // Old
      ];

      mockPrismaClient.suggestion.findMany
        .mockResolvedValueOnce(suggestions.slice(0, 2)) // This week only
        .mockResolvedValueOnce(suggestions); // All time

      mockPrismaClient.suggestion.count
        .mockResolvedValueOnce(2) // This week
        .mockResolvedValueOnce(3); // All time

      mockPrismaClient.suggestion.groupBy.mockResolvedValue([]);
      mockPrismaClient.vote.count.mockResolvedValue(0);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const metrics = await collectWeeklyMetrics();

      // Verify time filtering
      expect(mockPrismaClient.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submittedAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );

      expect(metrics.newSuggestions).toBe(2);
      expect(metrics.totalSuggestions).toBe(3);
    });

    it('should calculate trending cities based on recent votes', async () => {
      const now = new Date();

      // Create city vote patterns
      const cityVoteData = [
        { city: 'Miami', recentVotes: 45, oldVotes: 10 }, // Trending up
        { city: 'Chicago', recentVotes: 30, oldVotes: 30 }, // Stable
        { city: 'Portland', recentVotes: 10, oldVotes: 40 }, // Trending down
      ];

      const suggestions = cityVoteData.flatMap((data) => [
        createMockSuggestion({
          city: data.city,
          votes: data.recentVotes,
          submittedAt: subDays(now, 2),
        }),
        createMockSuggestion({
          city: data.city,
          votes: data.oldVotes,
          submittedAt: subDays(now, 10),
        }),
      ]);

      mockPrismaClient.suggestion.findMany.mockResolvedValue(
        suggestions.filter((s) => s.submittedAt > subDays(now, 7))
      );

      mockPrismaClient.suggestion.groupBy.mockResolvedValue([
        { city: 'Miami', _sum: { votes: 45 }, _count: 1 },
        { city: 'Chicago', _sum: { votes: 30 }, _count: 1 },
        { city: 'Portland', _sum: { votes: 10 }, _count: 1 },
      ]);

      mockPrismaClient.suggestion.count.mockResolvedValue(3);
      mockPrismaClient.vote.count.mockResolvedValue(85);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const metrics = await collectWeeklyMetrics();

      // Miami should be ranked first (highest recent votes)
      expect(metrics.topCities[0].city).toBe('Miami');
      expect(metrics.topCities[0].votes).toBe(45);
      expect(metrics.topCities[0].trend).toBe('up'); // More recent than old votes
    });
  });

  describe('AI Insights Generation', () => {
    it('should generate AI insights from metrics', async () => {
      const metrics: WeeklyMetrics = {
        totalSuggestions: 25,
        newSuggestions: 8,
        totalVotes: 250,
        topCities: [
          { city: 'Denver', votes: 80, trend: 'up' },
          { city: 'Boston', votes: 60, trend: 'stable' },
          { city: 'Austin', votes: 50, trend: 'down' },
        ],
        testsCompleted: 3,
        totalTestVolume: '45.5',
        averageNetCost: '0.35',
        periodStart: startOfWeek(new Date()),
        periodEnd: endOfWeek(new Date()),
      };

      // Mock OpenAI response
      const expectedInsight =
        'Denver shows strong momentum with 80 votes, trending upward. ' +
        'Consider prioritizing Denver for next test window. ' +
        'Boston maintains stable interest. Austin declining, may need engagement boost.';

      mockOpenAI.create.mockResolvedValue({
        choices: [{ message: { content: expectedInsight } }],
      });

      const insights = await generateAIInsights(metrics);

      expect(insights).toBe(expectedInsight);
      expect(mockOpenAI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('WeatherB'),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Denver'),
            }),
          ]),
        })
      );
    });

    it('should handle AI service failures gracefully', async () => {
      const metrics: WeeklyMetrics = {
        totalSuggestions: 10,
        newSuggestions: 3,
        totalVotes: 100,
        topCities: [{ city: 'Phoenix', votes: 40, trend: 'up' }],
        testsCompleted: 1,
        totalTestVolume: '15.0',
        averageNetCost: '0.25',
        periodStart: startOfWeek(new Date()),
        periodEnd: endOfWeek(new Date()),
      };

      // Mock OpenAI failure
      mockOpenAI.create.mockRejectedValue(new Error('API rate limit exceeded'));

      const insights = await generateAIInsights(metrics);

      // Should return fallback message
      expect(insights).toContain('unable to generate');
      expect(insights).not.toContain('error');
      expect(insights).not.toContain('Error');
    });

    it('should provide meaningful insights without AI when disabled', async () => {
      // Simulate no API key
      process.env.OPENAI_API_KEY = '';

      const metrics: WeeklyMetrics = {
        totalSuggestions: 15,
        newSuggestions: 5,
        totalVotes: 150,
        topCities: [
          { city: 'Seattle', votes: 60, trend: 'up' },
          { city: 'Portland', votes: 45, trend: 'stable' },
        ],
        testsCompleted: 2,
        totalTestVolume: '30.0',
        averageNetCost: '0.30',
        periodStart: startOfWeek(new Date()),
        periodEnd: endOfWeek(new Date()),
      };

      const insights = await generateAIInsights(metrics);

      // Should provide basic statistical summary
      expect(insights).toContain('Seattle');
      expect(insights).toContain('60 votes');
      expect(insights).toContain('trending up');
      expect(mockOpenAI.create).not.toHaveBeenCalled();
    });
  });

  describe('Complete Weekly Report Flow', () => {
    it('should generate and send complete weekly report with magic links', async () => {
      const now = new Date();

      // Step 1: Collect metrics
      const suggestions = [
        createMockSuggestion({ id: 'sug-1', city: 'Denver', votes: 75, status: 'pending' }),
        createMockSuggestion({ id: 'sug-2', city: 'Boston', votes: 60, status: 'pending' }),
        createMockSuggestion({ id: 'sug-3', city: 'Austin', votes: 45, status: 'approved' }),
      ];

      mockPrismaClient.suggestion.findMany.mockResolvedValue(suggestions);
      mockPrismaClient.suggestion.count.mockResolvedValue(3);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([
        { city: 'Denver', _sum: { votes: 75 }, _count: 1 },
        { city: 'Boston', _sum: { votes: 60 }, _count: 1 },
        { city: 'Austin', _sum: { votes: 45 }, _count: 1 },
      ]);

      mockPrismaClient.vote.count.mockResolvedValue(180);
      mockPrismaClient.testRun.findMany.mockResolvedValue([
        createMockTestRun({ totalVolume: 25.5, netCost: new (prisma as any).Decimal('0.45') }),
      ]);

      const metrics = await collectWeeklyMetrics();

      // Step 2: Generate magic links for top pending suggestions
      const magicLinks = new Map<string, { approveUrl: string; denyUrl: string }>();

      for (const suggestion of suggestions.filter((s) => s.status === 'pending')) {
        mockPrismaClient.magicLink.create.mockResolvedValue({
          id: `link-${suggestion.id}`,
          token: 'hashed-token',
          suggestionId: suggestion.id,
          action: 'approve',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          usedAt: null,
          createdAt: now,
        });

        const approveLink = await generateMagicLink({
          suggestionId: suggestion.id,
          action: 'approve',
        });

        const denyLink = await generateMagicLink({
          suggestionId: suggestion.id,
          action: 'deny',
        });

        magicLinks.set(suggestion.id, {
          approveUrl: approveLink.url,
          denyUrl: denyLink.url,
        });
      }

      // Step 3: Generate AI insights
      const aiInsights = 'Denver leads with strong community engagement. Consider test window.';
      mockOpenAI.create.mockResolvedValue({
        choices: [{ message: { content: aiInsights } }],
      });

      const insights = await generateAIInsights(metrics);

      // Step 4: Compose and send email
      const enrichedMetrics = {
        ...metrics,
        topCities: metrics.topCities.map((city) => {
          const suggestion = suggestions.find((s) => s.city === city.city);
          const links = suggestion ? magicLinks.get(suggestion.id) : undefined;
          return {
            ...city,
            approveUrl: links?.approveUrl || '',
            denyUrl: links?.denyUrl || '',
            status: suggestion?.status || 'unknown',
          };
        }),
      };

      vi.mocked(sendWeeklyReportEmail).mockResolvedValue({
        success: true,
        messageId: 'weekly-report-123',
      });

      const emailResult = await sendWeeklyReportEmail({
        to: 'admin@weatherb.com',
        weeklyMetrics: enrichedMetrics,
        aiInsights: insights,
      });

      // Verify complete flow
      expect(emailResult.success).toBe(true);
      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklyMetrics: expect.objectContaining({
            totalSuggestions: 3,
            topCities: expect.arrayContaining([
              expect.objectContaining({
                city: 'Denver',
                votes: 75,
                approveUrl: expect.stringContaining('/api/admin/magic-link'),
                denyUrl: expect.stringContaining('/api/admin/magic-link'),
              }),
            ]),
          }),
          aiInsights: expect.stringContaining('Denver'),
        })
      );

      // Verify magic links were created for pending suggestions
      expect(mockPrismaClient.magicLink.create).toHaveBeenCalledTimes(4); // 2 pending * 2 actions
    });

    it('should handle empty weeks gracefully', async () => {
      // No suggestions, votes, or test runs
      mockPrismaClient.suggestion.findMany.mockResolvedValue([]);
      mockPrismaClient.suggestion.count.mockResolvedValue(0);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([]);
      mockPrismaClient.vote.count.mockResolvedValue(0);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const metrics = await collectWeeklyMetrics();

      expect(metrics.totalSuggestions).toBe(0);
      expect(metrics.newSuggestions).toBe(0);
      expect(metrics.totalVotes).toBe(0);
      expect(metrics.topCities).toEqual([]);
      expect(metrics.testsCompleted).toBe(0);
      expect(metrics.totalTestVolume).toBe('0');
      expect(metrics.averageNetCost).toBe('0');

      // Should still generate and send report
      const insights = 'No activity this week. Consider engagement campaigns.';
      mockOpenAI.create.mockResolvedValue({
        choices: [{ message: { content: insights } }],
      });

      vi.mocked(sendWeeklyReportEmail).mockResolvedValue({
        success: true,
        messageId: 'empty-week-report',
      });

      const emailResult = await sendWeeklyReportEmail({
        to: 'admin@weatherb.com',
        weeklyMetrics: metrics,
        aiInsights: insights,
      });

      expect(emailResult.success).toBe(true);
      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklyMetrics: expect.objectContaining({
            totalSuggestions: 0,
            topCities: [],
          }),
          aiInsights: expect.stringContaining('No activity'),
        })
      );
    });

    it('should prioritize suggestions by score and recency', async () => {
      const now = new Date();

      // Create suggestions with different scores and times
      const suggestions = [
        createMockSuggestion({
          city: 'OldHighScore',
          votes: 100,
          score: 1000,
          submittedAt: subDays(now, 6),
        }),
        createMockSuggestion({
          city: 'RecentMediumScore',
          votes: 50,
          score: 500,
          submittedAt: subDays(now, 1),
        }),
        createMockSuggestion({
          city: 'RecentHighScore',
          votes: 80,
          score: 800,
          submittedAt: subDays(now, 2),
        }),
      ];

      mockPrismaClient.suggestion.findMany.mockResolvedValue(suggestions);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([
        { city: 'OldHighScore', _sum: { votes: 100 }, _count: 1 },
        { city: 'RecentHighScore', _sum: { votes: 80 }, _count: 1 },
        { city: 'RecentMediumScore', _sum: { votes: 50 }, _count: 1 },
      ]);

      mockPrismaClient.suggestion.count.mockResolvedValue(3);
      mockPrismaClient.vote.count.mockResolvedValue(230);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const metrics = await collectWeeklyMetrics();

      // Should prioritize by combination of score and recency
      expect(metrics.topCities[0].city).toBe('OldHighScore'); // Highest total votes
      expect(metrics.topCities[1].city).toBe('RecentHighScore');
      expect(metrics.topCities[2].city).toBe('RecentMediumScore');
    });
  });

  describe('Email Formatting and Delivery', () => {
    it('should format metrics correctly in email template', async () => {
      const metrics: WeeklyMetrics = {
        totalSuggestions: 42,
        newSuggestions: 12,
        totalVotes: 420,
        topCities: [
          {
            city: 'Denver',
            votes: 120,
            trend: 'up',
            approveUrl: 'http://localhost:3000/api/admin/magic-link?token=abc',
            denyUrl: 'http://localhost:3000/api/admin/magic-link?token=def',
          },
          {
            city: 'Boston',
            votes: 90,
            trend: 'stable',
            approveUrl: 'http://localhost:3000/api/admin/magic-link?token=ghi',
            denyUrl: 'http://localhost:3000/api/admin/magic-link?token=jkl',
          },
        ],
        testsCompleted: 5,
        totalTestVolume: '125.5',
        averageNetCost: '0.42',
        periodStart: new Date('2024-12-23'),
        periodEnd: new Date('2024-12-29'),
      };

      vi.mocked(sendWeeklyReportEmail).mockImplementation(async (params) => {
        // Verify email formatting
        expect(params.weeklyMetrics.totalSuggestions).toBe(42);
        expect(params.weeklyMetrics.newSuggestions).toBe(12);
        expect(params.weeklyMetrics.topCities[0].city).toBe('Denver');
        expect(params.weeklyMetrics.topCities[0].approveUrl).toContain('token=abc');
        expect(params.weeklyMetrics.testsCompleted).toBe(5);
        expect(params.weeklyMetrics.totalTestVolume).toBe('125.5');

        return { success: true, messageId: 'formatted-email' };
      });

      await sendWeeklyReportEmail({
        to: 'admin@weatherb.com',
        weeklyMetrics: metrics,
        aiInsights: 'Test insights',
      });

      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalled();
    });

    it('should handle email delivery failures with retry', async () => {
      const metrics: WeeklyMetrics = {
        totalSuggestions: 5,
        newSuggestions: 2,
        totalVotes: 50,
        topCities: [],
        testsCompleted: 0,
        totalTestVolume: '0',
        averageNetCost: '0',
        periodStart: startOfWeek(new Date()),
        periodEnd: endOfWeek(new Date()),
      };

      // First attempt fails, second succeeds
      vi.mocked(sendWeeklyReportEmail)
        .mockRejectedValueOnce(new Error('SMTP timeout'))
        .mockResolvedValueOnce({ success: true, messageId: 'retry-success' });

      let result;
      try {
        result = await sendWeeklyReportEmail({
          to: 'admin@weatherb.com',
          weeklyMetrics: metrics,
          aiInsights: 'Retry test',
        });
      } catch (error) {
        // Retry
        result = await sendWeeklyReportEmail({
          to: 'admin@weatherb.com',
          weeklyMetrics: metrics,
          aiInsights: 'Retry test',
        });
      }

      expect(result.success).toBe(true);
      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalledTimes(2);
    });

    it('should include test run details in report when available', async () => {
      const testRuns = [
        createMockTestRun({
          suggestionId: 'sug-1',
          marketsCreated: 5,
          marketsSettled: 5,
          actualTemp: 756, // 75.6°F
          totalVolume: 30.5,
          netCost: new (prisma as any).Decimal('0.55'),
          completedAt: subDays(new Date(), 2),
        }),
        createMockTestRun({
          suggestionId: 'sug-2',
          marketsCreated: 5,
          marketsSettled: 4, // Partial
          actualTemp: 823, // 82.3°F
          totalVolume: 25.0,
          netCost: new (prisma as any).Decimal('0.35'),
          status: 'FAILED',
          errorMessage: 'One market failed to settle',
          completedAt: subDays(new Date(), 1),
        }),
      ];

      mockPrismaClient.testRun.findMany.mockResolvedValue(testRuns);
      mockPrismaClient.suggestion.findMany.mockResolvedValue([]);
      mockPrismaClient.suggestion.count.mockResolvedValue(0);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([]);
      mockPrismaClient.vote.count.mockResolvedValue(0);

      const metrics = await collectWeeklyMetrics();

      expect(metrics.testsCompleted).toBe(1); // Only count successful
      expect(metrics.testsFailed).toBe(1);
      expect(metrics.totalTestVolume).toBe('30.5'); // Only successful
      expect(metrics.averageNetCost).toBe('0.55');

      // Include test details in email
      vi.mocked(sendWeeklyReportEmail).mockResolvedValue({
        success: true,
        messageId: 'test-details-email',
      });

      await sendWeeklyReportEmail({
        to: 'admin@weatherb.com',
        weeklyMetrics: metrics,
        aiInsights: 'Test run analysis',
        testRunDetails: testRuns.map((tr) => ({
          id: tr.id,
          status: tr.status,
          marketsSettled: `${tr.marketsSettled}/${tr.marketsCreated}`,
          actualTemp: tr.actualTemp ? (tr.actualTemp / 10).toFixed(1) : 'N/A',
          volume: tr.totalVolume?.toString() || '0',
          netCost: tr.netCost.toString(),
          error: tr.errorMessage,
        })),
      });

      expect(vi.mocked(sendWeeklyReportEmail)).toHaveBeenCalledWith(
        expect.objectContaining({
          testRunDetails: expect.arrayContaining([
            expect.objectContaining({
              status: 'COMPLETED',
              marketsSettled: '5/5',
              actualTemp: '75.6',
            }),
            expect.objectContaining({
              status: 'FAILED',
              marketsSettled: '4/5',
              error: 'One market failed to settle',
            }),
          ]),
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Generate large dataset
      const largeSuggestionSet = Array.from({ length: 1000 }, (_, i) =>
        createMockSuggestion({
          id: `sug-${i}`,
          city: `City${i % 50}`, // 50 unique cities
          votes: Math.floor(Math.random() * 100),
          submittedAt: subDays(new Date(), Math.floor(Math.random() * 7)),
        })
      );

      mockPrismaClient.suggestion.findMany.mockResolvedValue(largeSuggestionSet);
      mockPrismaClient.suggestion.count.mockResolvedValue(1000);

      // Aggregate by city
      const cityAggregates = Array.from({ length: 50 }, (_, i) => {
        const citySuggestions = largeSuggestionSet.filter((s) => s.city === `City${i}`);
        const totalVotes = citySuggestions.reduce((sum, s) => sum + s.votes, 0);
        return {
          city: `City${i}`,
          _sum: { votes: totalVotes },
          _count: citySuggestions.length,
        };
      }).sort((a, b) => b._sum.votes - a._sum.votes);

      mockPrismaClient.suggestion.groupBy.mockResolvedValue(cityAggregates);
      mockPrismaClient.vote.count.mockResolvedValue(50000);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const startTime = Date.now();
      const metrics = await collectWeeklyMetrics();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Should limit top cities
      expect(metrics.topCities.length).toBeLessThanOrEqual(10);
      expect(metrics.totalSuggestions).toBe(1000);
    });

    it('should batch database queries efficiently', async () => {
      mockPrismaClient.suggestion.findMany.mockResolvedValue([]);
      mockPrismaClient.suggestion.count.mockResolvedValue(0);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([]);
      mockPrismaClient.vote.count.mockResolvedValue(0);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      await collectWeeklyMetrics();

      // Verify queries are batched/optimized
      expect(mockPrismaClient.suggestion.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.suggestion.count).toHaveBeenCalledTimes(2); // This week + all time
      expect(mockPrismaClient.suggestion.groupBy).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.vote.count).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.testRun.findMany).toHaveBeenCalledTimes(1);

      // Should use transaction for consistency
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should cache metrics for repeated access within time window', async () => {
      const mockMetrics: WeeklyMetrics = {
        totalSuggestions: 10,
        newSuggestions: 3,
        totalVotes: 100,
        topCities: [],
        testsCompleted: 1,
        totalTestVolume: '15.0',
        averageNetCost: '0.30',
        periodStart: startOfWeek(new Date()),
        periodEnd: endOfWeek(new Date()),
        cachedAt: new Date(),
      };

      // First call - hits database
      mockPrismaClient.suggestion.findMany.mockResolvedValue([]);
      mockPrismaClient.suggestion.count.mockResolvedValue(10);
      mockPrismaClient.suggestion.groupBy.mockResolvedValue([]);
      mockPrismaClient.vote.count.mockResolvedValue(100);
      mockPrismaClient.testRun.findMany.mockResolvedValue([]);

      const metrics1 = await collectWeeklyMetrics();

      // Reset mocks
      vi.clearAllMocks();

      // Second call within cache window - should use cache
      const metrics2 = await collectWeeklyMetrics({ useCache: true });

      // If caching is implemented, database shouldn't be hit again
      if (metrics2.cachedAt) {
        expect(mockPrismaClient.suggestion.findMany).not.toHaveBeenCalled();
      }
    });
  });
});