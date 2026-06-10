import { NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { uid, sessionId } = await req.json();

    await admin.firestore().collection("sessions").doc(sessionId).set({
      uid,
      revoked: false,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}