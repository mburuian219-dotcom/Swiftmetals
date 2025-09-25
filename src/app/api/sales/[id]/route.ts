import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET /api/sales/[id] ----------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("❌ GET Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sale" },
      { status: 500 }
    );
  }
}

// ---------------- PUT /api/sales/[id] ----------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { payment: true, saleitem: { include: { product: true } } },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ Add new payment if provided
    if (body.payment) {
      await prisma.payment.create({
        data: {
          saleId: sale.id,
          amount: Number(body.payment.amount),
          method: body.payment.method,
          status:
            body.payment.method === "CHECK" &&
            !body.payment.checkDepositDate
              ? "PENDING"
              : "CLEARED",
          referenceId: body.payment.referenceId || null,
          checkDate: body.payment.checkDepositDate
            ? new Date(body.payment.checkDepositDate)
            : null,
          paidAt: body.payment.date ? new Date(body.payment.date) : new Date(),
        },
      });
    }

    // ✅ Recalculate totals & status
    const allPayments = await prisma.payment.findMany({
      where: { saleId: sale.id },
    });

    const totalPaid = allPayments
      .filter((p) => p.status === "CLEARED")
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = allPayments.filter((p) => p.status === "PENDING");
    const balance = sale.amount - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0 && pendingPayments.length === 0) status = "PAID";
    else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

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
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    return NextResponse.json({
      ...updatedSale,
      balance,
      totalPaid,
    });
  } catch (error: any) {
    console.error("❌ Update Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sale" },
      { status: 500 }
    );
  }
}

// ---------------- DELETE /api/sales/[id] ----------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sale = await prisma.sale.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Sale deleted successfully", sale });
  } catch (error: any) {
    console.error("❌ Delete Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete sale" },
      { status: 500 }
    );
  }
}
