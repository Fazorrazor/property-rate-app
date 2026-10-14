import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const tokenParam = searchParams.get('token');
  const isPortalAccessOnly = request.cookies.get('portal_access_only')?.value === 'true' || Boolean(tokenParam);
  const authSession = request.cookies.get('auth_session')?.value || tokenParam;

  // Handle Tokenized Direct Access (route through /auth/access for validation)
  if (tokenParam) {
    if (pathname.startsWith('/auth/access')) {
      return NextResponse.next();
    }
    const accessUrl = new URL('/auth/access', request.url);
    accessUrl.searchParams.set('token', tokenParam);
    return NextResponse.redirect(accessUrl);
  }

  const hasDirectDeepLink = Boolean(tokenParam || searchParams.get('accountNumber') || searchParams.get('propertyId'));

  // Disallow user profile/settings and legacy auth routes
  const isAuthOrProfilePath =
    pathname.startsWith('/profile') ||
    pathname.startsWith('/auth/welcome') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/verify');

  if (isAuthOrProfilePath) {
    const acc = searchParams.get('accountNumber') || searchParams.get('propertyId');
    if (acc) {
      return NextResponse.redirect(new URL(`/dashboard?accountNumber=${encodeURIComponent(acc)}`, request.url));
    }
    return NextResponse.redirect(new URL('/checkout', request.url));
  }

  // Root redirect
  if (pathname === '/') {
    if (hasDirectDeepLink) {
      const targetUrl = new URL('/dashboard', request.url);
      searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));
      return NextResponse.redirect(targetUrl);
    }
    return NextResponse.redirect(new URL('/checkout', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/properties/:path*',
    '/receipts/:path*',
    '/profile/:path*',
    '/checkout/:path*',
    '/auth/:path*',
  ],
};
