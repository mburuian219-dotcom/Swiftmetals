import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Check for session cookie (not token)
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  console.log('🔍 Middleware check:', {
    path: pathname,
    hasSession: !!session,
    sessionValue: session?.substring(0, 20) + '...',
  });

  // Allow access to authentication page without session
  if (pathname.startsWith("/auth") || pathname.startsWith("/authentication")) {
    // If user has session and tries to go to auth page, redirect to admin
    if (session) {
      console.log('✅ Has session on auth page, redirecting to /admin');
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Protect admin routes - require session
  if (pathname.startsWith("/admin")) {
    if (!session) {
      console.log('🔒 No session, redirecting to /auth');
      return NextResponse.redirect(new URL("/auth", request.url));
    }
    console.log('✅ Session found, allowing access to admin');
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      console.log('🔒 No session, redirecting to /auth');
      return NextResponse.redirect(new URL("/auth", request.url));
    }
    return NextResponse.next();
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