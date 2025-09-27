import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== Helper ==================
function processSale(sale: any) {
  const totalPaid = sale.payment
    .filter((p: any) => p.status === "CLEARED")
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const pendingPayments = sale.payment.filter((p: any) => p.status === "PENDING");
  const remainingAmount = sale.amount - totalPaid;

  let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
  if (remainingAmount <= 0 && pendingPayments.length === 0) status = "PAID";
  else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

  return {
    ...sale,
    saleitems: sale.saleitem, // ✅ frontend expects saleitems
    payments: sale.payment,   // ✅ frontend expects payments
    totalPaid,
    remainingAmount,
    status,
  };
}

// ================== GET ALL SALES ==================
export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sales.map(processSale));
  } catch (err) {
    console.error("❌ Fetch sales error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

// ================== CREATE SALE ==================
export async function POST(req: Request) {
  try {
    const data = await req.json();

    const customerId = Number(data.customerId);
    const amount = Number(data.amount);

    if (!customerId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Array.isArray(data.saleItems) || data.saleItems.length === 0) {
      return NextResponse.json(
        { error: "At least one sale item is required" },
        { status: 400 }
      );
    }

    // Validate stock
    for (const item of data.saleItems) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });

      if (!stockItem || stockItem.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for product ID ${item.productId}` },
          { status: 400 }
        );
      }
    }

    // Handle payments
    const payments =
      data.payments?.map((p: any) => ({
        amount: Number(p.amount),
        method: p.method,
        referenceId: p.referenceId || null,
        status: p.method === "CHECK" && !p.checkDate ? "PENDING" : "CLEARED",
        checkDate: p.checkDate ? new Date(p.checkDate) : null,
        paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
      })) || [];

    const newSale = await prisma.sale.create({
      data: {
        customerId,
        amount,
        date: data.date ? new Date(data.date) : new Date(),
        paymentMethod: data.paymentMethod || "CASH",
        status: "UNPAID",
        payment: { create: payments },
        saleitem: {
          create: data.saleItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    // Deduct stock
    for (const item of data.saleItems) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { quantity: stockItem.quantity - item.quantity },
        });
      }
    }

    return NextResponse.json(processSale(newSale), { status: 201 });
  } catch (err) {
    console.error("❌ Sale creation error:", err);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}

// ================== UPDATE SALE ==================
export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const id = Number(data.id);

    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    const existingSale = await prisma.sale.findUnique({
      where: { id },
      include: { saleitem: true, payment: true },
    });

    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // 🟢 Recalculate amount if items changed
    const newItems = data.saleItems || existingSale.saleitem;
    const recalculatedAmount = newItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    // 🟢 Update main sale fields
    await prisma.sale.update({
      where: { id },
      data: {
        customerId: data.customerId ?? existingSale.customerId,
        amount: recalculatedAmount,
        date: data.date ? new Date(data.date) : existingSale.date,
        paymentMethod: data.paymentMethod ?? existingSale.paymentMethod,
      },
    });

    // 🟢 Replace saleitems if provided
    if (data.saleItems) {
      await prisma.saleitem.deleteMany({ where: { saleId: id } });
      await prisma.saleitem.createMany({
        data: data.saleItems.map((item: any) => ({
          saleId: id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
      });
    }

    // 🟢 Append new payments
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      await prisma.payment.createMany({
        data: data.payments.map((p: any) => ({
          saleId: id,
          amount: Number(p.amount),
          method: p.method,
          status: p.method === "CHECK" && !p.checkDate ? "PENDING" : "CLEARED",
          referenceId: p.referenceId || null,
          checkDate: p.checkDate ? new Date(p.checkDate) : null,
          paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
        })),
      });
    }

    // 🟢 Fetch updated sale
    const updated = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    return NextResponse.json(processSale(updated));
  } catch (err) {
    console.error("❌ Sale update error:", err);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

// ================== DELETE SALE ==================
export async function DELETE(req: Request) {
  try {
    const data = await req.json();
    const id = Number(data.id);

    if (!id) {
      return NextResponse.json({ error: "Sale ID is required" }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { saleitem: true },
    });
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Restore stock
    for (const item of sale.saleitem) {
      const stockItem = await prisma.stock.findFirst({
        where: { productId: item.productId },
        orderBy: { createdAt: "desc" },
      });
      if (stockItem) {
        await prisma.stock.update({
          where: { id: stockItem.id },
          data: { quantity: stockItem.quantity + item.quantity },
        });
      }
    }

    await prisma.sale.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Sale delete error:", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
