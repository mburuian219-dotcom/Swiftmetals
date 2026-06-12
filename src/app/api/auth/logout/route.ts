import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    
    // Clear the session cookie
    response.cookies.set("session", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });
    
    // Clear the auth state cookie
    response.cookies.set("auth-state", "", {
      httpOnly: false,
      expires: new Date(0),
      path: "/",
    });
    
    return response;
  } catch (error: any) {
    console.error("LOGOUT ERROR:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}