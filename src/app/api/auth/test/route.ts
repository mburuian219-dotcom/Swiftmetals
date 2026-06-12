import { NextResponse } from "next/server";
import { isFirebaseAdminReady } from "@/lib/firebaseAdmin";

export async function GET() {
  return NextResponse.json({
    firebaseAdminReady: isFirebaseAdminReady(),
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  });
}