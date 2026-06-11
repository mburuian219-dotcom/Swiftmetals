import { NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  // CRITICAL: Skip during Next.js build time
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ authenticated: false, building: true });
  }
  
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    
    // Ensure admin is initialized before using
    if (!admin || !admin.auth) {
      console.error("Firebase Admin not properly initialized");
      return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
    }
    
    const decoded = await admin.auth().verifyIdToken(token);

    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role ?? "staff",
      authenticated: true,
    });
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}