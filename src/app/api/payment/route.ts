import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET /api/payment ----------------
export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        sale: true, // ✅ works because relation exists in schema
      },
      orderBy: { paidAt: "desc" }, // ✅ replaced createdAt with paidAt
    });
    return NextResponse.json(payments);
  } catch (err) {
    console.error("GET /api/payment error:", err);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// ---------------- POST /api/payment ----------------
export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.saleId || !data.amount || !data.method) {
      return NextResponse.json(
        { error: "saleId, amount, and method are required" },
        { status: 400 }
      );
    }

    // 1. Create payment
    const newPayment = await prisma.payment.create({
      data: {
        sale: { connect: { id: Number(data.saleId) } },
        method: data.method, // ✅ method instead of paymentType
        amount: Number(data.amount),
        note: data.note || null, // ✅ note instead of reference
      },
      include: { sale: true },
    });

    // 2. Recalculate sale payments total
    const payments = await prisma.payment.findMany({
      where: { saleId: Number(data.saleId) },
      select: { amount: true },
    });
    const totalPaid = payments.reduce(
      (sum: number, p: { amount: number }) => sum + p.amount,
      0
    );

    // 3. Update sale status
    let newStatus: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
    if (totalPaid === newPayment.sale.amount) newStatus = "PAID";
    else if (totalPaid > 0 && totalPaid < newPayment.sale.amount)
      newStatus = "PARTIAL";

    await prisma.sale.update({
      where: { id: newPayment.saleId },
      data: { status: newStatus },
    });

    return NextResponse.json(newPayment, { status: 201 });
  } catch (err) {
    console.error("POST /api/payment error:", err);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
