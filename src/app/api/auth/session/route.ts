import { NextRequest, NextResponse } from "next/server";
import { admin, isFirebaseAdminReady, getFirebaseAuth } from "../../../../lib/firebaseAdmin";

// List of admin emails from environment variable
const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',')?.map(email => email.trim().toLowerCase()) || [];

export async function GET(request: NextRequest) {
  try {
    // Get session cookie
    const sessionCookie = request.cookies.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { authenticated: false, error: "No session found" },
        { status: 401 }
      );
    }

    // Check if Firebase Admin is ready
    if (!isFirebaseAdminReady()) {
      console.error('❌ Firebase Admin not ready');
      return NextResponse.json(
        { authenticated: false, error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Verify session cookie
    let decodedToken;
    try {
      const auth = getFirebaseAuth();
      decodedToken = await auth.verifySessionCookie(sessionCookie, true);
      console.log('✅ Session verified for user:', decodedToken.email);
    } catch (verifyError: any) {
      console.error('❌ Session verification failed:', verifyError.message);
      return NextResponse.json(
        { authenticated: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userEmail = decodedToken.email?.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail || '');

    if (!isAdmin) {
      console.error('❌ Session user is not an admin:', userEmail);
      return NextResponse.json(
        { authenticated: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Return user info
    return NextResponse.json({
      authenticated: true,
      isAdmin: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0],
        role: 'admin'
      },
    });
  } catch (error: any) {
    console.error("❌ SESSION CHECK ERROR:", error);
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}