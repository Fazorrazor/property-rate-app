import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const adminSession = request.cookies.get('admin_session')?.value;

  const isAuthPath = pathname.startsWith('/login');
  const isSuperseded = searchParams.has('superseded') || searchParams.has('logout');

  // If trying to access protected route without session
  if (!isAuthPath && !adminSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If already authenticated and accessing login without superseded flag
  if (isAuthPath && adminSession && !isSuperseded) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
