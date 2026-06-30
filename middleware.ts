import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Get the session cookie
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  // Define public routes (no authentication required)
  const publicRoutes = ['/auth', '/authentication'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Define protected routes (authentication required)
  const protectedRoutes = ['/admin', '/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Case 1: User is on a public route but has a session -> redirect to admin
  if (isPublicRoute && session) {
    console.log('✅ Authenticated user on public route, redirecting to /admin');
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Case 2: User is on a protected route but has NO session -> redirect to auth
  if (isProtectedRoute && !session) {
    console.log('🔒 Unauthenticated user on protected route, redirecting to /auth');
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Case 3: User is on a protected route and HAS session -> allow access
  if (isProtectedRoute && session) {
    console.log('✅ Authenticated user accessing protected route');
    return NextResponse.next();
  }

  // Case 4: User is on a public route and NO session -> allow access
  if (isPublicRoute && !session) {
    console.log('✅ Unauthenticated user on public route');
    return NextResponse.next();
  }

  // Default: Allow all other routes
  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};