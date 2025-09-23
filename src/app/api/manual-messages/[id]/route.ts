// /src/app/api/manual-messages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ must await
  const messageId = Number(id);

  if (isNaN(messageId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const { action } = body; // expect { action: "mark_sent" } or "cancel"

  try {
    if (action === "mark_sent") {
      const updated = await prisma.manualMessageTask.update({
        where: { id: messageId },
        data: { status: "SENT", sentAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    if (action === "cancel") {
      const updated = await prisma.manualMessageTask.update({
        where: { id: messageId },
        data: { status: "CANCELED" },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /manual-messages/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update manual message" },
      { status: 500 }
    );
  }
}
