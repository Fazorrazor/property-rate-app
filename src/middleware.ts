import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const tokenParam = searchParams.get('token');
  const isPortalAccessOnly = request.cookies.get('portal_access_only')?.value === 'true' || Boolean(tokenParam);
  const authSession = request.cookies.get('auth_session')?.value || tokenParam;

  // Handle Tokenized Direct Access (Instant Citizen Login via SMS deep link)
  if (tokenParam) {
    const requestHeaders = new Headers(request.headers);
    const existingCookie = requestHeaders.get('cookie') || '';
    requestHeaders.set('cookie', `${existingCookie ? existingCookie + '; ' : ''}auth_session=${tokenParam}; portal_access_only=true`);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    response.cookies.set('auth_session', tokenParam, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    response.cookies.set('portal_access_only', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
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
