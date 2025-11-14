import { NextResponse } from "next/server";
import { admin } from "@//lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid token" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];

    // Decode the token
    const decoded = await admin.auth().verifyIdToken(token);

    return NextResponse.json({
      email: decoded.email,
      uid: decoded.uid,
      message: "Authenticated",
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
