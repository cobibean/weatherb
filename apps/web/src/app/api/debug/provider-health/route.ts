import { NextResponse } from 'next/server';
import { getUpstashRedis, REDIS_KEYS } from '@/lib/cron';
import { readProviderHealth } from '@/lib/provider-health';
import { deriveProviderStatus } from '@/lib/admin-data';

/**
 * GET /api/debug/provider-health
 * 
 * Diagnostic endpoint for troubleshooting "always degraded" provider status.
 * 
 * Security: Only enabled in development or with CRON_SECRET header.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Security: Require CRON_SECRET header in production
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  
  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {},
    conclusion: '',
    recommendations: [] as string[],
  };

  // Check 1: Upstash environment variables
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  diagnostics.checks = {
    ...diagnostics.checks as Record<string, unknown>,
    upstashEnvVars: {
      UPSTASH_REDIS_REST_URL_set: !!upstashUrl,
      UPSTASH_REDIS_REST_TOKEN_set: !!upstashToken,
      UPSTASH_REDIS_REST_URL_length: upstashUrl?.length ?? 0,
      // Don't leak the actual values, just show if they look valid
      UPSTASH_REDIS_REST_URL_looks_valid: upstashUrl?.startsWith('https://') ?? false,
    },
  };

  if (!upstashUrl || !upstashToken) {
    (diagnostics.recommendations as string[]).push(
      'CRITICAL: Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel environment variables'
    );
  }

  // Check 2: Can we create a Redis client?
  const redis = getUpstashRedis();
  (diagnostics.checks as Record<string, unknown>).redisClientCreated = !!redis;

  // Check 3: Can we read from Redis?
  let rawHealthKey: unknown = null;
  let redisReadError: string | null = null;
  
  if (redis) {
    try {
      // Upstash auto-deserializes JSON, so this might be an object or string
      rawHealthKey = await redis.get<unknown>(REDIS_KEYS.PROVIDER_HEALTH);
      (diagnostics.checks as Record<string, unknown>).redisReadSuccess = true;
    } catch (error) {
      redisReadError = error instanceof Error ? error.message : String(error);
      (diagnostics.checks as Record<string, unknown>).redisReadSuccess = false;
      (diagnostics.checks as Record<string, unknown>).redisReadError = redisReadError;
    }
  }

  // Check 4: Key existence and value
  (diagnostics.checks as Record<string, unknown>).providerHealthKey = {
    keyName: REDIS_KEYS.PROVIDER_HEALTH,
    keyExists: rawHealthKey !== null,
    rawValueType: rawHealthKey === null ? 'null' : typeof rawHealthKey,
    rawValue: rawHealthKey,
  };

  if (rawHealthKey === null && redis) {
    (diagnostics.recommendations as string[]).push(
      'KEY MISSING: The weatherb:provider:health key does not exist. This means the cron jobs have never successfully written health data. Check Vercel logs for cron execution and errors.'
    );
  }

  // Check 5: Parsed health data
  const parsedHealth = await readProviderHealth();
  (diagnostics.checks as Record<string, unknown>).parsedHealth = parsedHealth;

  // Check 6: Derived status
  const nowMs = Date.now();
  const derivedStatus = deriveProviderStatus(parsedHealth, nowMs);
  (diagnostics.checks as Record<string, unknown>).derivedStatus = derivedStatus;

  // Check 7: Tomorrow.io provider env vars
  const weatherProviderEnv = {
    TOMORROW_IO_API_KEY_set: !!process.env.TOMORROW_IO_API_KEY,
  };
  (diagnostics.checks as Record<string, unknown>).weatherProviderEnv = weatherProviderEnv;

  if (!process.env.TOMORROW_IO_API_KEY) {
    (diagnostics.recommendations as string[]).push(
      'WEATHER PROVIDER ERROR: TOMORROW_IO_API_KEY is missing. Settlement and market creation will fail.'
    );
  }

  // Analyze the health data if it exists
  if (parsedHealth) {
    const lastSuccessMs = parsedHealth.lastSuccessAt ? Date.parse(parsedHealth.lastSuccessAt) : null;
    const lastErrorMs = parsedHealth.lastErrorAt ? Date.parse(parsedHealth.lastErrorAt) : null;
    
    const analysis: Record<string, unknown> = {
      lastSuccessAge: lastSuccessMs ? `${Math.round((nowMs - lastSuccessMs) / 60000)} minutes ago` : 'never',
      lastErrorAge: lastErrorMs ? `${Math.round((nowMs - lastErrorMs) / 60000)} minutes ago` : 'never',
      recentErrors: parsedHealth.recentErrors,
    };

    // Explain why status is what it is
    if (derivedStatus === 'degraded') {
      if (lastErrorMs && (nowMs - lastErrorMs) < 30 * 60 * 1000) {
        analysis.degradedReason = 'Last error was within 30 minutes';
      } else if (parsedHealth.recentErrors >= 3) {
        analysis.degradedReason = `recentErrors (${parsedHealth.recentErrors}) >= 3`;
      }
    } else if (derivedStatus === 'down') {
      analysis.downReason = lastSuccessMs 
        ? 'Last success was more than 24 hours ago'
        : 'No successful health record found';
    }

    (diagnostics.checks as Record<string, unknown>).healthAnalysis = analysis;
  }

  // Set conclusion
  if (!redis) {
    diagnostics.conclusion = 'UPSTASH NOT CONFIGURED: Redis client cannot be created. Provider health cannot be read or written.';
  } else if (rawHealthKey === null) {
    diagnostics.conclusion = 'KEY MISSING: Cron jobs have never written to the health key. Check if crons are running and completing successfully.';
  } else if (derivedStatus === 'degraded') {
    diagnostics.conclusion = 'DEGRADED: Health key exists but conditions trigger degraded status. See healthAnalysis for details.';
  } else if (derivedStatus === 'down') {
    diagnostics.conclusion = 'DOWN: No recent successful health records.';
  } else {
    diagnostics.conclusion = 'HEALTHY: Provider status is healthy.';
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
