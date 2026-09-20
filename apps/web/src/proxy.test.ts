import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

describe('Admin request proxy', () => {
  it.each(['/admin', '/admin/markets', '/admin/api/system/config'])(
    'redirects unauthenticated requests to %s with a return path',
    (pathname) => {
      const response = proxy(new NextRequest(`http://localhost${pathname}`));
      expect(response?.status).toBe(307);
      const destination = new URL(response!.headers.get('location')!);
      expect(destination.pathname).toBe('/admin/login');
      expect(destination.searchParams.get('redirect')).toBe(pathname);
    },
  );

  it.each(['/admin/login', '/admin/api/auth/init', '/admin/api/auth/verify'])(
    'allows the public authentication route %s',
    (pathname) => {
      const response = proxy(new NextRequest(`http://localhost${pathname}`));
      expect(response?.headers.get('x-middleware-next')).toBe('1');
      expect(response?.headers.get('location')).toBeNull();
    },
  );

  it('passes a session cookie through for full server-side validation', () => {
    const response = proxy(
      new NextRequest('http://localhost/admin', {
        headers: { cookie: 'admin_session=local-test-session' },
      }),
    );
    expect(response?.headers.get('x-middleware-next')).toBe('1');
  });

  it('matches admin routes without intercepting public routes', () => {
    for (const url of ['/admin', '/admin/markets', '/admin/api/system/config']) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
    for (const url of ['/', '/api/health', '/administrator']) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  });
});
