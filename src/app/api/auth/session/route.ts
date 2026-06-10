import { NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    // Prefer cookie OR header fallback
    const authHeader = request.headers.get("Authorization");

    let token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.split("Bearer ")[1]
        : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(token);

    // OPTIONAL: attach session info from Firestore later
    return NextResponse.json({
      uid: decoded.uid,
      email: decoded.email,
      authenticated: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 401 }
    );
  }
}