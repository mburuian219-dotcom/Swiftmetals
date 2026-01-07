// src/app/api/test-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  const userRole = request.headers.get('x-user-role');

  return NextResponse.json({
    authenticated: !!userId,
    userId,
    userEmail,
    userRole,
    headers: Object.fromEntries(request.headers.entries()),
  });
}