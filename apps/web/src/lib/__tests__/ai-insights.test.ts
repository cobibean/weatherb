import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI before importing the module that uses it
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    mockCreate, // Export for test access
  };
});

// Import the module after mocks are set up
import {
  generateWeeklyInsights,
  formatInsightsForEmail,
  validateInsights,
  generateFallbackInsights,
  type WeeklyMetrics,
} from '../ai-insights';

// Get mock function from the mocked module
const getMockCreate = () => (vi.mocked(import('openai')) as any).mockCreate;

describe('AI Insights Service', () => {
  const mockMetrics: WeeklyMetrics = {
    totalMarkets: 35,
    totalVolume: '5000.00',
    totalPayouts: '4950.00',
    uniqueBettors: 150,
    topCities: [
      { name: 'San Francisco', markets: 7, volume: '1200.00' },
      { name: 'New York', markets: 5, volume: '900.00' },
      { name: 'Los Angeles', markets: 5, volume: '800.00' },
    ],
    marketHighlights: [
      {
        city: 'San Francisco',
        date: '2024-01-02',
        threshold: 650,
        actual: 660,
        volume: '250.00',
        outcome: 'YES',
      },
    ],
    approvedCities: [
      { name: 'Chicago', approvedDate: '2024-01-03' },
      { name: 'Seattle', approvedDate: '2024-01-05' },
    ],
    testRunsCompleted: 10,
    testRunSuccessRate: 90,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable for OpenAI
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('generateWeeklyInsights', () => {
    it('should generate insights successfully', async () => {
      const mockInsights = `This week showed strong growth with 35 markets and 150 unique bettors.
        San Francisco led with $1,200 FLR in volume. The 99% payout ratio demonstrates healthy liquidity.
        Consider expanding coverage in high-volume cities.`;

      // Mock OpenAI response
      getMockCreate().mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: mockInsights,
            },
          },
        ],
        usage: {
          total_tokens: 200,
        },
      });

      const result = await generateWeeklyInsights({
        metrics: mockMetrics,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result.success).toBe(true);
      expect(result.insights).toBe(mockInsights);
      expect(result.tokensUsed).toBe(200);

      // Verify the API was called with proper parameters
      expect(getMockCreate()).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo-preview',
          max_tokens: 500,
          temperature: 0.7,
        })
      );
    });

    it('should handle OpenAI API errors', async () => {
      getMockCreate().mockRejectedValueOnce(new Error('rate limit exceeded'));

      const result = await generateWeeklyInsights({
        metrics: mockMetrics,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenAI rate limit reached, try again later');
    });

    it('should handle missing API key', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await generateWeeklyInsights({
        metrics: mockMetrics,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('OpenAI API key not configured');
    });

    it('should handle empty response from OpenAI', async () => {
      getMockCreate().mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      });

      const result = await generateWeeklyInsights({
        metrics: mockMetrics,
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No insights generated');
    });
  });

  describe('validateInsights', () => {
    it('should validate good insights', () => {
      const goodInsights = `This week showed strong growth with 35 markets and 150 unique bettors.
        San Francisco led with 1,200 FLR in volume. The platform is performing well.`;

      expect(validateInsights(goodInsights)).toBe(true);
    });

    it('should reject insights that are too short', () => {
      const shortInsights = 'Good week.';
      expect(validateInsights(shortInsights)).toBe(false);
    });

    it('should reject insights that are too long', () => {
      const longInsights = 'x'.repeat(2001);
      expect(validateInsights(longInsights)).toBe(false);
    });

    it('should reject insights without numbers', () => {
      const noNumbersInsights = 'This week showed strong growth with many markets and lots of bettors. Everything is going well.';
      expect(validateInsights(noNumbersInsights)).toBe(false);
    });

    it('should reject insights with error patterns', () => {
      const errorInsights = "I'm sorry, I cannot generate insights due to insufficient data.";
      expect(validateInsights(errorInsights)).toBe(false);
    });
  });

  describe('formatInsightsForEmail', () => {
    it('should remove markdown formatting', () => {
      const markdownInsights = `**Bold text** and *italic text* here.

      ## Heading

      Regular paragraph with **emphasis**.`;

      const formatted = formatInsightsForEmail(markdownInsights);

      expect(formatted).not.toContain('**');
      expect(formatted).not.toContain('*');
      expect(formatted).not.toContain('##');
      expect(formatted).toContain('Bold text and italic text here');
    });

    it('should preserve paragraph breaks', () => {
      const multiParagraph = `First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const formatted = formatInsightsForEmail(multiParagraph);

      expect(formatted.split('\n\n').length).toBe(3);
    });
  });

  describe('generateFallbackInsights', () => {
    it('should generate reasonable fallback insights', () => {
      const fallback = generateFallbackInsights(mockMetrics);

      expect(fallback).toContain('35 markets');
      expect(fallback).toContain('150 unique participants');
      expect(fallback).toContain('5000.00 FLR');
      expect(fallback).toContain('San Francisco');
      expect(fallback).toContain('90% success rate');
      expect(fallback).toContain('2 new cities were approved');
    });

    it('should handle empty metrics gracefully', () => {
      const emptyMetrics: WeeklyMetrics = {
        totalMarkets: 0,
        totalVolume: '0',
        totalPayouts: '0',
        uniqueBettors: 0,
        topCities: [],
        marketHighlights: [],
        approvedCities: [],
        testRunsCompleted: 0,
        testRunSuccessRate: 0,
      };

      const fallback = generateFallbackInsights(emptyMetrics);

      expect(fallback).toContain('moderate platform activity');
      expect(fallback).not.toContain('undefined');
      expect(fallback).not.toContain('null');
    });

    it('should handle single approved city correctly', () => {
      const metricsWithOneCity = {
        ...mockMetrics,
        approvedCities: [{ name: 'Chicago', approvedDate: '2024-01-03' }],
      };

      const fallback = generateFallbackInsights(metricsWithOneCity);

      expect(fallback).toContain('1 new city was approved');
      expect(fallback).not.toContain('cities were');
    });
  });
});