import { NextRequest, NextResponse } from 'next/server';
import { validateAndUseMagicLink } from '@/lib/magic-links';

/**
 * Magic Link Handler
 *
 * Processes magic link tokens from emails to perform admin actions.
 * Redirects to a confirmation page showing the result.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Get user wallet from session if available (optional)
    // For now, we'll just pass undefined since magic links work without auth
    const userWallet = undefined;

    // Validate and use the magic link
    const result = await validateAndUseMagicLink(token, userWallet);

    if (!result.valid) {
      // Redirect to error page with error message
      const errorUrl = new URL('/magic', baseUrl);
      errorUrl.searchParams.set('status', 'error');
      errorUrl.searchParams.set('message', result.error || 'Invalid link');
      return NextResponse.redirect(errorUrl);
    }

    // Redirect to success page with details
    const successUrl = new URL('/magic', baseUrl);
    successUrl.searchParams.set('status', 'success');
    successUrl.searchParams.set('action', result.action || '');

    if (result.suggestion) {
      // Include city name in the success message
      const cityName = result.suggestion.customCityName || 'the city';
      successUrl.searchParams.set('city', cityName);
      successUrl.searchParams.set('suggestionId', result.suggestion.id);
    }

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[MagicLink API] Error processing token:', error);

    // Redirect to generic error page
    const errorUrl = new URL('/magic', baseUrl);
    errorUrl.searchParams.set('status', 'error');
    errorUrl.searchParams.set('message', 'An unexpected error occurred');
    return NextResponse.redirect(errorUrl);
  }
}
