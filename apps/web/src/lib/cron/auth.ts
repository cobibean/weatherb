import { NextResponse } from 'next/server';

/**
 * Verify that a request is from Vercel Cron.
 * In development, allows manual testing without auth.
 * In production, checks the Authorization header against CRON_SECRET.
 */
export function verifyCronRequest(request: Request): boolean {
  // In development, allow manual testing
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET is auto-set by Vercel for cron jobs
  if (!cronSecret) {
    console.warn('CRON_SECRET not set - rejecting cron request');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Return a 401 Unauthorized response for invalid cron requests.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

