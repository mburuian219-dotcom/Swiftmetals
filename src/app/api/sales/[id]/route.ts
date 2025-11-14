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
      include: {
        payment: true,
        saleitem: { include: { product: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ------------------ Update existing sale items ------------------
    if (body.saleItems && Array.isArray(body.saleItems)) {
      for (const item of body.saleItems) {
        if (!item.id) continue;
        await prisma.saleitem.update({
          where: { id: item.id },
          data: {
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          },
        });
      }
    }

    // ------------------ Update existing payments ------------------
    if (body.payments && Array.isArray(body.payments)) {
      for (const p of body.payments) {
        if (!p.id) continue;
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            amount: Number(p.amount),
            method: p.method,
            referenceId: p.referenceId || null,
            checkDate: p.checkDepositDate ? new Date(p.checkDepositDate) : null,
            status: p.method === "CHECK" && !p.checkDepositDate ? "PENDING" : "CLEARED",
          },
        });
      }
    }

    // ------------------ Add new payments ------------------
    if (body.newPayments && Array.isArray(body.newPayments)) {
      for (const np of body.newPayments) {
        await prisma.payment.create({
          data: {
            saleId: sale.id,
            amount: Number(np.amount),
            method: np.method,
            referenceId: np.referenceId || null,
            checkDate: np.checkDepositDate ? new Date(np.checkDepositDate) : null,
            status: np.method === "CHECK" && !np.checkDepositDate ? "PENDING" : "CLEARED",
            paidAt: new Date(),
          },
        });
      }
    }

    // ------------------ Recalculate totals & status ------------------
    const allPayments = await prisma.payment.findMany({ where: { saleId: sale.id } });
    const totalPaid = allPayments.filter(p => p.status === "CLEARED").reduce((sum, p) => sum + p.amount, 0);
    const pendingPayments = allPayments.filter(p => p.status === "PENDING");
    const balance = (body.amount ?? sale.amount) - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0 && pendingPayments.length === 0) status = "PAID";
    else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

    // ------------------ Update sale ------------------
    const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        amount: body.amount ?? sale.amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : sale.dueDate,
        paymentMethod: body.paymentMethod ?? sale.paymentMethod,
        checkDepositDate: body.checkDepositDate ? new Date(body.checkDepositDate) : sale.checkDepositDate,
        status,
        updatedBy: body.updatedBy ?? null,
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    return NextResponse.json({ ...updatedSale, balance, totalPaid });
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
