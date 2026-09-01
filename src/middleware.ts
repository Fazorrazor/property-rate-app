import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authSession = request.cookies.get('auth_session')?.value;

  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/properties') ||
    pathname.startsWith('/receipts') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/checkout');

  const isAuthPath =
    pathname.startsWith('/auth/welcome') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/verify');

  // Root redirect
  if (pathname === '/') {
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
