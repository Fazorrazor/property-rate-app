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

  const isInternalAppPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/receipts');

  // Enforce portal containment: SMS token users cannot browse internal app areas
  if (isPortalAccessOnly && isInternalAppPath) {
    return NextResponse.redirect(new URL('/checkout', request.url));
  }

  const hasDirectDeepLink = Boolean(tokenParam || searchParams.get('accountNumber') || searchParams.get('propertyId'));

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    (pathname.startsWith('/properties') && !hasDirectDeepLink) ||
    pathname.startsWith('/receipts') ||
    pathname.startsWith('/profile');

  const isAuthPath =
    pathname.startsWith('/auth/welcome') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/verify');

  // Root redirect
  if (pathname === '/') {
    if (isPortalAccessOnly) {
      return NextResponse.redirect(new URL('/checkout', request.url));
    }
    if (authSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/auth/welcome', request.url));
    }
  }

  // If trying to access protected route without session
  if (isProtectedPath && !authSession) {
    const response = NextResponse.redirect(new URL('/auth/welcome', request.url));
    return response;
  }

  // If already authenticated and accessing login/welcome
  if (isAuthPath && authSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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
