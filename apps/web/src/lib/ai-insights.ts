/**
 * AI Insights Service
 *
 * Generates intelligent insights for weekly reports using AI providers.
 * Supports multiple providers with automatic fallback.
 * Analyzes metrics and provides actionable recommendations.
 *
 * Providers:
 * - AI_PROVIDER_1_KEY: Primary (Claude recommended)
 * - AI_PROVIDER_2_KEY: Secondary fallback
 * - Fallback: Generic insights if all providers fail
 *
 * Features:
 * - Token usage limits for cost control
 * - Structured prompts for consistent output
 * - Error handling with graceful degradation
 * - Provider fallback chain
 */

import Anthropic from '@anthropic-ai/sdk';
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
const TEMPERATURE = 0.7; // Balance between creativity and consistency

// Provider configuration
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'; // Primary provider
const OPENAI_MODEL = 'gpt-4-turbo-preview'; // Fallback provider

// Initialize AI clients based on environment variables
const anthropic = process.env.AI_PROVIDER_1_KEY
  ? new Anthropic({ apiKey: process.env.AI_PROVIDER_1_KEY })
  : null;

const openai = process.env.AI_PROVIDER_2_KEY
  ? new OpenAI({ apiKey: process.env.AI_PROVIDER_2_KEY })
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
 * Generates AI insights from weekly metrics with provider fallback
 */
export async function generateWeeklyInsights({
  metrics,
  startDate,
  endDate,
}: AIInsightsParams): Promise<AIInsightsResult> {
  const prompt = buildInsightsPrompt(metrics, startDate, endDate);
  const systemPrompt = getSystemPrompt();

  // Try primary provider (Claude)
  if (anthropic) {
    const result = await tryClaudeProvider(systemPrompt, prompt);
    if (result.success) {
      return result;
    }
    console.warn('[AI Insights] Primary provider (Claude) failed, trying fallback');
  }

  // Try secondary provider (OpenAI)
  if (openai) {
    const result = await tryOpenAIProvider(systemPrompt, prompt);
    if (result.success) {
      return result;
    }
    console.warn('[AI Insights] Secondary provider (OpenAI) failed');
  }

  // All providers failed
  console.log('[AI Insights] All AI providers unavailable or failed');
  return {
    success: false,
    error: 'No AI providers configured or all providers failed',
  };
}

/**
 * Try generating insights with Claude (Primary Provider)
 */
async function tryClaudeProvider(
  systemPrompt: string,
  userPrompt: string
): Promise<AIInsightsResult> {
  try {
    if (!anthropic) {
      return { success: false, error: 'Claude not configured' };
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const insights = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : undefined;

    const tokensUsed =
      response.usage.input_tokens + response.usage.output_tokens;

    if (!insights) {
      return {
        success: false,
        error: 'No insights generated from Claude',
      };
    }

    console.log(`[AI Insights] Generated insights using Claude (${tokensUsed} tokens)`);

    return {
      success: true,
      insights,
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    };
  } catch (error) {
    console.error('[AI Insights] Claude provider error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Claude provider failed',
    };
  }
}

/**
 * Try generating insights with OpenAI (Fallback Provider)
 */
async function tryOpenAIProvider(
  systemPrompt: string,
  userPrompt: string
): Promise<AIInsightsResult> {
  try {
    if (!openai) {
      return { success: false, error: 'OpenAI not configured' };
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
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
        error: 'No insights generated from OpenAI',
      };
    }

    console.log(`[AI Insights] Generated insights using OpenAI (${tokensUsed} tokens)`);

    return {
      success: true,
      insights,
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    };
  } catch (error) {
    console.error('[AI Insights] OpenAI provider error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OpenAI provider failed',
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
