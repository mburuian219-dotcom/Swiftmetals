import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Validation
    if (!data.saleId || !data.totalAmount || !data.invoiceNumber || !data.generatedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: String(data.invoiceNumber),
        saleId: Number(data.saleId),
        totalAmount: Number(data.totalAmount),
        amountPaid: Number(data.amountPaid ?? 0),
        balance: Number(data.balance ?? data.totalAmount),
        status: (data.status?.toUpperCase() as "UNPAID" | "PAID" | "PARTIAL") || "UNPAID",
        generatedBy: Number(data.generatedBy),
        updatedAt: new Date(), // ✅ required field
      },
    });

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (err: any) {
    console.error("❌ [API] Failed to create invoice:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
