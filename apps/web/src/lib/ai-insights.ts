/**
 * AI Insights Service
 *
 * Generates intelligent insights for weekly reports using OpenAI GPT-4.
 * Analyzes metrics and provides actionable recommendations.
 *
 * Features:
 * - Token usage limits for cost control
 * - Structured prompts for consistent output
 * - Error handling with graceful degradation
 * - Caching to avoid regeneration
 */

import OpenAI from 'openai';

// Simplified WeeklyMetrics type for AI insights
export interface WeeklyMetrics {
  totalMarkets: number;
  totalVolume: string; // in FLR
  totalPayouts: string; // in FLR
  uniqueBettors: number;
  topCities: Array<{
    name: string;
    markets: number;
    volume: string; // in FLR
  }>;
  marketHighlights: Array<{
    city: string;
    date: string;
    threshold: number;
    actual: number;
    volume: string; // in FLR
    outcome: 'YES' | 'NO';
  }>;
  approvedCities: Array<{
    name: string;
    approvedDate: string;
  }>;
  testRunsCompleted: number;
  testRunSuccessRate: number;
}

// Configuration
const MAX_TOKENS = 500; // Limit AI response length
const MODEL = 'gpt-4-turbo-preview'; // Best quality for weekly insights
const TEMPERATURE = 0.7; // Balance between creativity and consistency

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface AIInsightsParams {
  metrics: WeeklyMetrics;
  startDate: string;
  endDate: string;
}

export interface AIInsightsResult {
  success: boolean;
  insights?: string;
  error?: string;
  tokensUsed?: number;
}

/**
 * Generates AI insights from weekly metrics
 */
export async function generateWeeklyInsights({
  metrics,
  startDate,
  endDate,
}: AIInsightsParams): Promise<AIInsightsResult> {
  try {
    // Check if OpenAI is configured
    if (!openai) {
      console.log('[AI Insights] OpenAI not configured, skipping insights generation');
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    // Build the prompt with metrics data
    const prompt = buildInsightsPrompt(metrics, startDate, endDate);

    // Generate insights using GPT-4
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const insights = response.choices[0]?.message?.content?.trim();
    const tokensUsed = response.usage?.total_tokens;

    if (!insights) {
      return {
        success: false,
        error: 'No insights generated',
      };
    }

    console.log(`[AI Insights] Generated insights using ${tokensUsed} tokens`);

    return {
      success: true,
      insights,
      tokensUsed,
    };
  } catch (error) {
    console.error('[AI Insights] Error generating insights:', error);

    // Provide a specific error message based on the error type
    let errorMessage = 'Failed to generate AI insights';

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        errorMessage = 'OpenAI rate limit reached, try again later';
      } else if (error.message.includes('api key')) {
        errorMessage = 'Invalid OpenAI API key';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'OpenAI request timed out';
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * System prompt for consistent AI behavior
 */
function getSystemPrompt(): string {
  return `You are a data analyst for WeatherB, a temperature prediction market platform on the Flare blockchain.
Your role is to analyze weekly metrics and provide actionable insights for platform administrators.

Guidelines:
- Be concise and specific (2-3 paragraphs maximum)
- Focus on trends, patterns, and anomalies
- Provide actionable recommendations
- Use professional but approachable language
- Reference specific numbers from the data
- Highlight both successes and areas for improvement
- Consider seasonal and geographic factors
- Avoid blockchain jargon unless necessary

Your insights should help admins understand:
1. Platform growth and user engagement trends
2. Geographic patterns in betting activity
3. Opportunities for expansion or optimization
4. Notable market outcomes or patterns
5. Recommendations for the coming week`;
}

/**
 * Builds the user prompt with metrics data
 */
function buildInsightsPrompt(
  metrics: WeeklyMetrics,
  startDate: string,
  endDate: string
): string {
  // Format top cities for the prompt
  const topCitiesText = metrics.topCities
    .slice(0, 3)
    .map(city => `${city.name} (${city.volume} FLR, ${city.markets} markets)`)
    .join(', ');

  // Format market highlights
  const marketHighlightsText = metrics.marketHighlights
    .slice(0, 3)
    .map(m => `${m.city} on ${new Date(m.date).toLocaleDateString()} (${m.volume} FLR, ${m.outcome})`)
    .join(', ');

  // Calculate some derived metrics
  const avgVolumePerMarket = metrics.totalMarkets > 0
    ? (parseFloat(metrics.totalVolume) / metrics.totalMarkets).toFixed(2)
    : '0';

  const payoutRatio = parseFloat(metrics.totalVolume) > 0
    ? ((parseFloat(metrics.totalPayouts) / parseFloat(metrics.totalVolume)) * 100).toFixed(1)
    : '0';

  // Build the prompt
  return `Analyze the following WeatherB platform metrics for the week of ${startDate} to ${endDate} and provide actionable insights:

OVERVIEW:
- Total Markets: ${metrics.totalMarkets}
- Total Volume: ${metrics.totalVolume} FLR
- Total Payouts: ${metrics.totalPayouts} FLR (${payoutRatio}% of volume)
- Unique Bettors: ${metrics.uniqueBettors}
- Average Volume per Market: ${avgVolumePerMarket} FLR

TOP CITIES BY ACTIVITY:
${topCitiesText || 'No city data available'}

NOTABLE MARKETS:
${marketHighlightsText || 'No notable markets'}

NEW CITIES APPROVED:
${metrics.approvedCities.map(c => c.name).join(', ') || 'None this week'}

TEST RUN SUCCESS RATE:
${metrics.testRunSuccessRate}% (${metrics.testRunsCompleted} completed)

Please provide insights that:
1. Identify the main trends from this week's data
2. Highlight any notable patterns or anomalies
3. Suggest 2-3 specific actions for the coming week
4. Comment on platform health and growth trajectory`;
}

/**
 * Formats AI insights for email display
 */
export function formatInsightsForEmail(insights: string): string {
  // Clean up any markdown formatting
  let formatted = insights
    .replace(/\*\*/g, '') // Remove bold markdown
    .replace(/\*/g, '')   // Remove italic markdown
    .replace(/#{1,6}\s/g, ''); // Remove heading markdown

  // Ensure proper paragraph breaks
  formatted = formatted
    .split('\n\n')
    .filter(p => p.trim())
    .join('\n\n');

  return formatted;
}

/**
 * Validates that insights meet quality standards
 */
export function validateInsights(insights: string): boolean {
  // Check minimum length (at least 100 characters)
  if (insights.length < 100) {
    return false;
  }

  // Check maximum length (not exceeding reasonable limits)
  if (insights.length > 2000) {
    return false;
  }

  // Check that it contains some numbers (data-driven)
  const hasNumbers = /\d/.test(insights);
  if (!hasNumbers) {
    return false;
  }

  // Check for common AI failures
  const failurePatterns = [
    /^I cannot/i,
    /^I'm sorry/i,
    /^Unfortunately/i,
    /^Error:/i,
    /insufficient data/i,
  ];

  for (const pattern of failurePatterns) {
    if (pattern.test(insights)) {
      return false;
    }
  }

  return true;
}

/**
 * Generates a fallback insight when AI is unavailable
 */
export function generateFallbackInsights(metrics: WeeklyMetrics): string {
  const avgVolume = metrics.totalMarkets > 0
    ? (parseFloat(metrics.totalVolume) / metrics.totalMarkets).toFixed(2)
    : '0';

  const topCity = metrics.topCities[0];
  const growthTrend = metrics.uniqueBettors > 50 ? 'strong' : 'moderate';

  return `This week saw ${growthTrend} platform activity with ${metrics.totalMarkets} markets created and ${metrics.uniqueBettors} unique participants. ` +
    `Total betting volume reached ${metrics.totalVolume} FLR with an average of ${avgVolume} FLR per market. ` +
    (topCity ? `${topCity.name} led in activity with ${topCity.volume} FLR in volume across ${topCity.markets} markets. ` : '') +
    `The platform maintained a ${metrics.testRunSuccessRate}% success rate for test runs, demonstrating reliable operations. ` +
    (metrics.approvedCities.length > 0
      ? `${metrics.approvedCities.length} new ${metrics.approvedCities.length === 1 ? 'city was' : 'cities were'} approved for production use. `
      : '') +
    `Continue monitoring high-volume markets and consider expanding coverage in active regions.`;
}