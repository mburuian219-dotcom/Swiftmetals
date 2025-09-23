import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== GET ALL SALES ==================
export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        saleItems: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(Array.isArray(sales) ? sales : []);
  } catch (err) {
    console.error("Fetch sales error:", err);
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

    // ✅ Validate stock before creating
    for (const item of data.saleItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        return NextResponse.json(
          { error: `Product with ID ${item.productId} not found` },
          { status: 404 }
        );
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
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
        checkDate: p.checkDate ? new Date(p.checkDate) : null,
        paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
      })) || [];

    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const balance = amount - totalPaid;

    let status = "UNPAID";
    if (balance <= 0) status = "PAID";
    else if (balance < amount) status = "PARTIAL";

    const newSale = await prisma.sale.create({
      data: {
        customerId,
        amount,
        date: data.date ? new Date(data.date) : new Date(),
        paymentMethod: data.paymentMethod || "CASH",
        status,
        payments: { create: payments },
        saleItems: {
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
        saleItems: { include: { product: true } },
        payments: true,
      },
    });

    // ✅ Deduct stock
    for (const item of data.saleItems) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return NextResponse.json(newSale, { status: 201 });
  } catch (err) {
    console.error("Sale creation error:", err);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}

// ================== UPDATE SALE ==================
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
      include: { saleItems: true, payments: true },
    });

    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ Restore stock for old items
    for (const oldItem of existingSale.saleItems) {
      await prisma.product.update({
        where: { id: oldItem.productId },
        data: { stock: { increment: oldItem.quantity } },
      });
    }

    // ✅ Recalculate total amount from new items
    const newItems = data.saleItems || [];
    const recalculatedAmount = newItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    // Handle payments
    const payments = data.payments || existingSale.payments;
    const totalPaid = payments.reduce(
      (sum: number, p: any) => sum + Number(p.amount),
      0
    );
    const balance = recalculatedAmount - totalPaid;

    let status = "UNPAID";
    if (balance <= 0) status = "PAID";
    else if (balance < recalculatedAmount) status = "PARTIAL";

    // ✅ Update with recalculated amount
    const updated = await prisma.sale.update({
      where: { id },
      data: {
        customerId: data.customerId ?? existingSale.customerId,
        amount: recalculatedAmount,
        status,
        date: data.date ? new Date(data.date) : existingSale.date,
        paymentMethod: data.paymentMethod ?? existingSale.paymentMethod,

        saleItems: {
          deleteMany: { saleId: id },
          create: newItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          })),
        },

        payments: {
          deleteMany: { saleId: id },
          create: payments.map((p: any) => ({
            amount: Number(p.amount),
            method: p.method,
            referenceId: p.referenceId || null,
            checkDate: p.checkDate ? new Date(p.checkDate) : null,
            paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
          })),
        },
      },
      include: {
        customer: true,
        saleItems: { include: { product: true } },
        payments: true,
      },
    });

    // ✅ Deduct stock for new items
    for (const newItem of newItems) {
      await prisma.product.update({
        where: { id: newItem.productId },
        data: { stock: { decrement: newItem.quantity } },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Sale update error:", err);
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
      include: { saleItems: true },
    });
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ✅ Always restore stock for deleted sale items
    for (const item of sale.saleItems) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    await prisma.sale.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Sale delete error:", err);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}

// ================== BULK OPERATIONS ==================
export async function PATCH(req: Request) {
  try {
    const data = await req.json();
    const { action, saleIds } = data;

    if (action === "markPaid" && Array.isArray(saleIds)) {
      const updatedSales = await prisma.sale.updateMany({
        where: { id: { in: saleIds } },
        data: { status: "PAID" },
      });

      return NextResponse.json({ success: true, updated: updatedSales.count });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Bulk operation error:", err);
    return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
  }
}
