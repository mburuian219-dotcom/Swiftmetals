import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { taskId, phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Missing phone or message" },
        { status: 400 }
      );
    }

    const result = await sendSMS(phone, message);

    // 🚫 Blacklist handling
    if (result.blacklist) {
      console.warn(`⚠️ User ${phone} is blacklisted`);

      if (taskId) {
        await prisma.manualMessageTask.update({
          where: { id: taskId },
          data: {
            status: "BLACKLISTED",
            failureReason: "User in blacklist",
          },
        });
      }

      return NextResponse.json(
        { error: "User is blacklisted", blacklist: true, result },
        { status: 403 }
      );
    }

    // ✅ Success flow
    if (taskId) {
      await prisma.manualMessageTask.update({
        where: { id: taskId },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("❌ API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
