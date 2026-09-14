import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, internal Next.js assets, open API webhooks, and public system/auth routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/system') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    const response = NextResponse.next();
    response.headers.set('ngrok-skip-browser-warning', 'true');
    return response;
  }

  // Check auth session cookie
  const authToken = request.cookies.get('wap_auth_token')?.value;

  if (!authToken) {
    // Return 401 JSON for API calls instead of redirecting to HTML login page
    if (pathname.startsWith('/api/')) {
      const apiResponse = NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
      apiResponse.headers.set('ngrok-skip-browser-warning', 'true');
      return apiResponse;
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set('ngrok-skip-browser-warning', 'true');
    return redirectResponse;
  }

  const response = NextResponse.next();
  response.headers.set('ngrok-skip-browser-warning', 'true');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
