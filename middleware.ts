import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Allow authentication page
  if (pathname.startsWith("/authentication")) {
    return NextResponse.next();
  }

  // Protect ALL admin routes automatically
  const isAdminRoute = pathname.startsWith("/admin");

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  // No token → redirect
  if (!token) {
    return NextResponse.redirect(
      new URL("/authentication", request.url)
    );
  }

  try {
    // Verify Firebase token
    await admin.auth().verifyIdToken(token);

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(
      new URL("/authentication", request.url)
    );
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};