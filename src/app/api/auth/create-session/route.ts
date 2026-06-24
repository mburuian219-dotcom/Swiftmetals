import { NextRequest, NextResponse } from "next/server";
import { admin, isFirebaseAdminReady, getFirebaseAuth } from "@/lib/firebaseAdmin";

// List of admin emails from environment variable
const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',')?.map(email => email.trim().toLowerCase()) || [];

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let errorStage = 'initialization';
  
  try {
    // Log request details (without sensitive data)
    console.log('🔍 Session creation request received:', {
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url,
      method: request.method,
    });

    // Check if Firebase Admin is ready
    errorStage = 'firebase_admin_check';
    console.log('🔍 Checking Firebase Admin readiness...');
    
    if (!isFirebaseAdminReady()) {
      console.error('❌ Firebase Admin not ready - Check initialization');
      console.error('Environment variables present:', {
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      });
      
      return NextResponse.json(
        { 
          error: "Authentication service is initializing. Please try again.",
          details: "Firebase Admin not ready",
          stage: errorStage,
        },
        { status: 503 }
      );
    }

    // Get Authorization header
    errorStage = 'auth_header_check';
    const authHeader = request.headers.get("authorization");

    console.log('🔍 Auth header present:', !!authHeader);
    console.log('🔍 Auth header starts with Bearer:', authHeader?.startsWith("Bearer "));

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error('❌ Invalid auth header:', authHeader?.substring(0, 20) + '...');
      return NextResponse.json(
        { 
          error: "Missing or invalid Authorization header",
          details: "Authorization header must be a Bearer token",
          stage: errorStage,
        },
        { status: 401 }
      );
    }

    // Extract token
    errorStage = 'token_extraction';
    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken) {
      console.error('❌ Token extraction failed - empty token');
      return NextResponse.json(
        { 
          error: "Missing token",
          details: "No token found after Bearer prefix",
          stage: errorStage,
        },
        { status: 401 }
      );
    }

    console.log('🔍 Token extracted successfully. Token length:', idToken.length);
    console.log('🔍 Token preview:', idToken.substring(0, 20) + '...');

    // Verify Firebase ID token
    errorStage = 'token_verification';
    let decodedToken;
    try {
      const auth = getFirebaseAuth();
      
      // Verify with additional error handling
      console.log('🔍 Attempting to verify token with Firebase...');
      decodedToken = await auth.verifyIdToken(idToken, true); // true = check revoked
      
      console.log('✅ Token verified successfully:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        authTime: decodedToken.auth_time ? new Date(decodedToken.auth_time * 1000).toISOString() : 'N/A',
        issuedAt: decodedToken.iat ? new Date(decodedToken.iat * 1000).toISOString() : 'N/A',
        expiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000).toISOString() : 'N/A',
      });
    } catch (verifyError: any) {
      console.error('❌ Token verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        stack: verifyError.stack,
      });
      
      // Provide more specific error messages
      let errorMessage = "Invalid or expired token";
      let statusCode = 401;
      
      if (verifyError.code === 'auth/id-token-expired') {
        errorMessage = "Token has expired. Please sign in again.";
      } else if (verifyError.code === 'auth/id-token-revoked') {
        errorMessage = "Token has been revoked. Please sign in again.";
      } else if (verifyError.code === 'auth/argument-error') {
        errorMessage = "Invalid token format. Please sign in again.";
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: verifyError.message,
          code: verifyError.code,
          stage: errorStage,
        },
        { status: statusCode }
      );
    }

    // Check if user is admin
    errorStage = 'admin_check';
    const userEmail = decodedToken.email?.toLowerCase();
    
    console.log('🔍 Admin email check:', {
      userEmail,
      isEmailPresent: !!userEmail,
      adminList: ADMIN_EMAILS,
      adminListLength: ADMIN_EMAILS.length,
      matches: ADMIN_EMAILS.includes(userEmail || ''),
    });

    if (!userEmail) {
      console.error('❌ No email in token:', decodedToken);
      return NextResponse.json(
        { 
          error: "User email not found in token",
          details: "Token does not contain an email address",
          stage: errorStage,
        },
        { status: 400 }
      );
    }

    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    if (!isAdmin) {
      console.error('❌ Access denied: User is not an admin:', {
        userEmail,
        adminList: ADMIN_EMAILS,
      });
      return NextResponse.json(
        { 
          error: "Access denied. You do not have admin privileges.",
          details: `User ${userEmail} is not in the admin list`,
          stage: errorStage,
        },
        { status: 403 }
      );
    }

    // Create session cookie
    errorStage = 'session_cookie_creation';
    const expiresIn = 60 * 60 * 2 * 1000; // 2 hours in milliseconds

    let sessionCookie;
    try {
      const auth = getFirebaseAuth();
      console.log('🔍 Creating session cookie with expiry:', expiresIn);
      sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
      console.log('✅ Session cookie created. Length:', sessionCookie.length);
    } catch (cookieError: any) {
      console.error('❌ Session cookie creation failed:', {
        message: cookieError.message,
        code: cookieError.code,
        stack: cookieError.stack,
      });
      return NextResponse.json(
        { 
          error: "Failed to create session",
          details: cookieError.message,
          code: cookieError.code,
          stage: errorStage,
        },
        { status: 500 }
      );
    }

    // Set custom claims
    errorStage = 'custom_claims';
    try {
      const auth = getFirebaseAuth();
      console.log('🔍 Setting custom claims for user:', decodedToken.uid);
      await auth.setCustomUserClaims(decodedToken.uid, { admin: true, role: 'admin' });
      console.log('✅ Custom claims set successfully');
    } catch (claimsError: any) {
      console.warn('⚠️ Could not set custom claims:', {
        message: claimsError.message,
        code: claimsError.code,
        // Continue even if custom claims fail
      });
    }

    // Create response
    errorStage = 'response_creation';
    const response = NextResponse.json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0],
      isAdmin: true,
      role: 'admin',
      timestamp: new Date().toISOString(),
    });

    // Set HTTP-only cookie
    errorStage = 'cookie_setting';
    try {
      response.cookies.set("session", sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: expiresIn / 1000,
        // Add domain if needed for subdomains
        // domain: process.env.COOKIE_DOMAIN || undefined,
      });
      console.log('✅ Session cookie set in response');
    } catch (cookieSetError: any) {
      console.error('❌ Failed to set cookie in response:', {
        message: cookieSetError.message,
        stack: cookieSetError.stack,
      });
      // Continue - the response still has the cookie data
    }

    const duration = Date.now() - startTime;
    console.log('✅ Session creation completed successfully:', {
      user: userEmail,
      uid: decodedToken.uid,
      duration: `${duration}ms`,
    });

    return response;

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error("❌ CRITICAL: Session creation failed at stage:", errorStage);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name,
      stage: errorStage,
      duration: `${duration}ms`,
    });

    // Check for specific error types
    let statusCode = 500;
    let errorMessage = "Session creation failed";
    let errorDetails = error.message || "Internal server error";

    if (error.code === 'auth/insufficient-permission') {
      statusCode = 403;
      errorMessage = "Insufficient permissions";
      errorDetails = "Firebase Admin SDK permissions may not be properly configured";
    } else if (error.code === 'auth/internal-error') {
      statusCode = 500;
      errorMessage = "Firebase internal error";
      errorDetails = "Check Firebase configuration and network connectivity";
    } else if (error.message?.includes('ENV')) {
      statusCode = 500;
      errorMessage = "Environment configuration error";
      errorDetails = "Check Firebase environment variables are properly set";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        stage: errorStage,
        code: error.code || 'unknown',
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}

// Add health check endpoint
export async function GET(request: NextRequest) {
  try {
    const isReady = isFirebaseAdminReady();
    const envCheck = {
      hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasAdminEmails: !!process.env.NEXT_PUBLIC_ADMIN_EMAILS,
      adminEmailsCount: ADMIN_EMAILS.length,
      adminEmails: ADMIN_EMAILS,
    };

    console.log('🔍 Health check:', { isReady, envCheck });

    return NextResponse.json({
      status: 'ok',
      firebaseAdminReady: isReady,
      environment: process.env.NODE_ENV,
      envCheck,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}