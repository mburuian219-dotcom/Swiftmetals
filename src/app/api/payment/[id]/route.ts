import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// DELETE /api/payment/[id]?saleId=123
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ must await in Next.js 15
    const paymentId = Number(id);

    const { searchParams } = new URL(req.url);
    const saleId = Number(searchParams.get("saleId"));

    if (!paymentId || !saleId) {
      return NextResponse.json(
        { error: "Payment ID and Sale ID are required" },
        { status: 400 }
      );
    }

    // 1. Delete the payment
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    // 2. Recalculate totals after deletion
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        payment: true,
        customer: true,
        saleitem: { include: { product: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ Only count cleared payments
    const totalPaid = sale.payment
      .filter((p) => p.status === "CLEARED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingPayments = sale.payment.filter((p) => p.status === "PENDING");
    const balance = sale.amount - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0 && pendingPayments.length === 0) status = "PAID";
    else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

    // 3. Update sale with new status
    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: { status },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    // 4. Return sale summary
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
