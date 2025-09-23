import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE /api/payments/[id]?saleId=123
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = Number(params.id);
    const { searchParams } = new URL(req.url);
    const saleId = Number(searchParams.get("saleId"));

    if (!paymentId || !saleId) {
      return NextResponse.json(
        { error: "Payment ID and Sale ID are required" },
        { status: 400 }
      );
    }

    // Delete the payment
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    // Recalculate totals after deletion
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        payments: true,
        customer: true,
        saleItems: { include: { product: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const totalPaid = sale.payments
      .filter((p) => p.id !== paymentId) // ensure deleted payment isn't counted
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = sale.amount - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0) status = "PAID";
    else if (totalPaid > 0) status = "PARTIAL";

    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: { status },
      include: {
        payments: true,
        customer: true,
        saleItems: { include: { product: true } },
      },
    });

    return NextResponse.json({
      ...updatedSale,
      balance,
      totalPaid,
    });
  } catch (error: any) {
    console.error("❌ Delete Payment Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete payment" },
      { status: 500 }
    );
  }
}
