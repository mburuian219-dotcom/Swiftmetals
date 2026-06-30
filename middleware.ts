import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Check BOTH session and token cookies for compatibility
  const session = request.cookies.get("session")?.value;
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Use session first, fallback to token
  const authToken = session || token;

  console.log('🔍 Middleware check:', {
    path: pathname,
    hasSession: !!session,
    hasToken: !!token,
    isAuthenticated: !!authToken,
  });

  // Allow access to authentication page without auth
  if (pathname.startsWith("/auth") || pathname.startsWith("/authentication")) {
    // If user has auth and tries to go to auth page, redirect to admin
    if (authToken) {
      console.log('✅ Has auth on auth page, redirecting to /admin');
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (!authToken) {
      console.log('🔒 No auth, redirecting to /auth');
      return NextResponse.redirect(new URL("/auth", request.url));
    }
    console.log('✅ Auth found, allowing access to admin');
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!authToken) {
      console.log('🔒 No auth, redirecting to /auth');
      return NextResponse.redirect(new URL("/auth", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};