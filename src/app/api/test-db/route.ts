import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const count = await prisma.customer.count();
    return NextResponse.json({ success: true, customerCount: count });
  } catch (err: any) {
    console.error("Database connection error:", err);
    return NextResponse.json(
      { 
        success: false, 
        error: err.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
