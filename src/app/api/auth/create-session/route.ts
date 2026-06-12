import { NextRequest, NextResponse } from "next/server";
import { admin, isFirebaseAdminReady, getFirebaseAuth } from "@/lib/firebaseAdmin";

// List of admin emails from environment variable
const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',')?.map(email => email.trim().toLowerCase()) || [];

export async function POST(request: NextRequest) {
  try {
    // Check if Firebase Admin is ready
    if (!isFirebaseAdminReady()) {
      console.error('❌ Firebase Admin not ready');
      return NextResponse.json(
        { 
          error: "Authentication service is initializing. Please try again.",
          details: "Firebase Admin not ready"
        },
        { status: 503 }
      );
    }

    // Get Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    // Extract token
    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      const auth = getFirebaseAuth();
      decodedToken = await auth.verifyIdToken(idToken);
      console.log('✅ Token verified for user:', decodedToken.email);
    } catch (verifyError: any) {
      console.error('❌ Token verification failed:', verifyError.message);
      return NextResponse.json(
        { error: "Invalid or expired token", details: verifyError.message },
        { status: 401 }
      );
    }

    // Check if user is admin
    const userEmail = decodedToken.email?.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(userEmail || '');
    
    console.log('📋 Admin check:', {
      userEmail,
      isAdmin,
      adminList: ADMIN_EMAILS
    });

    if (!isAdmin) {
      console.error('❌ Access denied: User is not an admin', userEmail);
      return NextResponse.json(
        { 
          error: "Access denied. You do not have admin privileges.",
          details: "Only authorized admins can access this resource"
        },
        { status: 403 }
      );
    }

    // Create session cookie (2 hours)
    const expiresIn = 60 * 60 * 2 * 1000; // 2 hours in milliseconds

    let sessionCookie;
    try {
      const auth = getFirebaseAuth();
      sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
      console.log('✅ Session cookie created for admin:', userEmail);
    } catch (cookieError: any) {
      console.error('❌ Session cookie creation failed:', cookieError.message);
      return NextResponse.json(
        { error: "Failed to create session", details: cookieError.message },
        { status: 500 }
      );
    }

    // Set custom claims for admin (optional - stores role in Firebase)
    try {
      const auth = getFirebaseAuth();
      await auth.setCustomUserClaims(decodedToken.uid, { admin: true, role: 'admin' });
      console.log('✅ Custom claims set for user:', userEmail);
    } catch (claimsError: any) {
      console.warn('⚠️ Could not set custom claims:', claimsError.message);
      // Continue even if custom claims fail
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0],
      isAdmin: true,
      role: 'admin'
    });

    // Set HTTP-only cookie
    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });

    return response;
  } catch (error: any) {
    console.error("❌ CREATE SESSION ERROR:", error);
    return NextResponse.json(
      {
        error: "Session creation failed",
        details: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}