import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all orders ----------------
export async function GET() {
  try {
    const orders = await prisma.sale.findMany({
      include: {
        customer: true,
        saleItems: { include: { product: true } }, // ✅ fetch products inside saleItems
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------- CREATE a new order ----------------
export async function POST(req: Request) {
  try {
    const { customerId, items, status, paymentMethod, dueDate } = await req.json();

    // ✅ Validate input
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Validate products and stock
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        return NextResponse.json(
          { error: "Invalid item data" },
          { status: 400 }
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product not found (ID: ${item.productId})` },
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

    // ✅ Calculate total order amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // ✅ Create order with multiple saleItems
    const order = await prisma.sale.create({
      data: {
        customerId: Number(customerId),
        amount: totalAmount,
        status: status || "PENDING",
        paymentMethod: paymentMethod || "CASH",
        dueDate: dueDate ? new Date(dueDate) : null,
        saleItems: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            price: Number(item.price),
            total: item.price * item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        saleItems: { include: { product: true } },
      },
    });

    // ✅ Update stock for all products
    for (const item of items) {
      await prisma.product.update({
        where: { id: Number(item.productId) },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
