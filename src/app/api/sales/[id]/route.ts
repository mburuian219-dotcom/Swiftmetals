import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // ✅ must await in Next.js 15
    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    const body = await req.json();

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { payments: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ Add new payment if provided (instead of overwriting all)
    if (body.payment) {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          amount: Number(body.payment.amount),
          method: body.payment.method,
          referenceId: body.payment.referenceId || null,
          checkDate: body.payment.checkDepositDate
            ? new Date(body.payment.checkDepositDate)
            : null,
          paidAt: body.payment.date ? new Date(body.payment.date) : new Date(),
        },
      });
    }

    // ✅ Recalculate totals
    const totalPaid = await prisma.payment.aggregate({
      where: { saleId: sale.id },
      _sum: { amount: true },
    });

    const paid = totalPaid._sum.amount || 0;
    const balance = sale.amount - paid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0) status = "PAID";
    else if (paid > 0) status = "PARTIAL";

    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status,
        checkDepositDate: body.checkDepositDate
          ? new Date(body.checkDepositDate)
          : sale.checkDepositDate,
        paymentMethod: body.payment?.method ?? sale.paymentMethod,
      },
      include: {
        customer: true,
        saleItems: { include: { product: true } },
        payments: true,
      },
    });

    return NextResponse.json({
      ...updatedSale,
      balance,
      totalPaid: paid,
    });
  } catch (error: any) {
    console.error("❌ Update Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sale" },
      { status: 500 }
    );
  }
}
