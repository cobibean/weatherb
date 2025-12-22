import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'admin_session';

export function middleware(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except /admin/login and /admin/api/auth)
  if (pathname.startsWith('/admin')) {
    // Allow login page and auth API routes
    if (
      pathname === '/admin/login' ||
      pathname.startsWith('/admin/api/auth')
    ) {
      return NextResponse.next();
    }

    // Check for session cookie
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionId) {
      // Redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Note: Full session validation happens in the layout/page components
    // Middleware just checks for cookie presence for performance
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

