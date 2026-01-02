import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  const protectedRoutes = [
    "/sales",
    "/staff",
    "/inventory",
    "/admin",
    "/reports",
  ];

  const isProtected = protectedRoutes.some(path =>
    req.nextUrl.pathname.startsWith(path)
  );

  // Not protected → allow
  if (!isProtected) {
    return NextResponse.next();
  }

  // Protected but no token → redirect
  if (!token) {
    return NextResponse.redirect(new URL("/authentication", req.url));
  }

  // Token exists → allow
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/sales/:path*",
    "/staff/:path*",
    "/inventory/:path*",
    "/admin/:path*",
    "/reports/:path*",
  ],
};
