import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET /api/payment ----------------
export async function GET() {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        sale: {
  include: {
    customer: true,
    saleitem: { include: { product: true } },
    payment: true, // ✅ so recalculation works consistently
  },
},

      },
      orderBy: { paidAt: "desc" },
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
        method: data.method,
        amount: Number(data.amount),
        referenceId: data.referenceId || null,
        status:
          data.method === "CHECK" && !data.checkDepositDate
            ? "PENDING"
            : "CLEARED",
        checkDate: data.checkDepositDate
          ? new Date(data.checkDepositDate)
          : null,
        paidAt: data.date ? new Date(data.date) : new Date(),
        note: data.note || null,
      },
      include: { sale: true },
    });

    // 2. Recalculate sale totals
    const allPayments = await prisma.payment.findMany({
      where: { saleId: Number(data.saleId) },
    });

    const totalPaid = allPayments
      .filter((p) => p.status === "CLEARED")
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = allPayments.filter((p) => p.status === "PENDING");
    const balance = newPayment.sale.amount - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0 && pendingPayments.length === 0) status = "PAID";
    else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

    // 3. Update sale status
    const updatedSale = await prisma.sale.update({
      where: { id: newPayment.saleId },
      data: { status },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    // 4. Return updated sale + payment info
    return NextResponse.json({
      payment: newPayment,
      sale: {
        ...updatedSale,
        balance,
        totalPaid,
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/payment error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}
