import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
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

  if (!isProtected) {
    return NextResponse.next();
  }

  // No token → redirect
  if (!token) {
    return NextResponse.redirect(new URL("/authentication", req.url));
  }

  // Validate token via your API
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/auth/session`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/authentication", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/authentication", req.url));
  }
}
