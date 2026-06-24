import { NextResponse } from "next/server";
import { isFirebaseAdminReady, getFirebaseAuth } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    const isReady = isFirebaseAdminReady();
    
    const envStatus = {
      projectId: process.env.FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing',
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing',
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
      adminEmails: process.env.NEXT_PUBLIC_ADMIN_EMAILS ? '✅ Set' : '❌ Missing',
      adminEmailsCount: process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').length || 0,
    };

    let connectivityTest: { status: string; error?: string } = { 
      status: 'Not tested' 
    };
    
    if (isReady) {
      try {
        const auth = getFirebaseAuth();
        await auth.getUser('test-uid').catch((e: any) => {
          if (e.code === 'auth/user-not-found') {
            connectivityTest = { status: '✅ Connected to Firebase' };
          } else {
            connectivityTest = { 
              status: '⚠️ Firebase error', 
              error: e.message 
            };
          }
        });
      } catch (e: any) {
        connectivityTest = { 
          status: '❌ Cannot reach Firebase', 
          error: e.message 
        };
      }
    }

    return NextResponse.json({
      status: 'Diagnostic Complete',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || 'Not Vercel',
      },
      firebaseAdmin: {
        isReady,
        envStatus,
        connectivity: connectivityTest,
      },
      adminEmails: {
        raw: process.env.NEXT_PUBLIC_ADMIN_EMAILS,
        parsed: process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [],
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'Error',
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}