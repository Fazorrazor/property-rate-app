import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const adminSession = request.cookies.get('admin_session')?.value;

  const isAuthPath = pathname.startsWith('/login');
  const isBypass = searchParams.has('superseded') || searchParams.has('logout') || searchParams.has('expired');

  // Check 10-minute session expiration at Edge/Middleware layer
  if (adminSession) {
    const parts = adminSession.split(':');
    if (parts.length >= 3) {
      const createdAt = Number(parts[2]);
      if (!isNaN(createdAt) && Date.now() - createdAt > 10 * 60 * 1000) {
        const res = NextResponse.redirect(new URL('/login?expired=true', request.url));
        res.cookies.delete('admin_session');
        return res;
      }
    }
  }

  // If trying to access protected route without session
  if (!isAuthPath && !adminSession) {
    return NextResponse.redirect(new URL('/login?expired=true', request.url));
  }

  // If already authenticated and accessing login without bypass flag
  if (isAuthPath && adminSession && !isBypass) {
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
