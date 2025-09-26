import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all orders ----------------
export async function GET() {
  try {
    const orders = await prisma.sale.findMany({
      include: {
        customer: true,
        saleitem: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Normalize saleitems for frontend
    return NextResponse.json(
      orders.map((o) => ({
        ...o,
        saleitems: o.saleitem,
      }))
    );
  } catch (error: any) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------- CREATE a new order ----------------
export async function POST(req: Request) {
  try {
    const { customerId, items, status, paymentMethod, dueDate } = await req.json();

    // Validate input
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate products and stock
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        return NextResponse.json({ error: "Invalid item data" }, { status: 400 });
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

      if (!product.inStock) {
        return NextResponse.json(
          { error: `Product ${product.name} is out of stock` },
          { status: 400 }
        );
      }
    }

    // Calculate total order amount
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    // Create order with multiple saleitems
    const order = await prisma.sale.create({
      data: {
        customerId: Number(customerId),
        amount: totalAmount,
        status: status || "PENDING",
        paymentMethod: paymentMethod || "CASH",
        dueDate: dueDate ? new Date(dueDate) : null,
        saleitem: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            price: Number(item.price),
            total: Number(item.price) * Number(item.quantity),
          })),
        },
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
      },
    });

    // Update stock properly
    for (const item of items) {
      const currentStock = await prisma.stock.findFirst({
        where: { productId: Number(item.productId) },
        orderBy: { createdAt: "desc" },
      });

      if (currentStock) {
        const newQuantity = currentStock.quantity - Number(item.quantity);
        if (newQuantity < 0) {
          return NextResponse.json(
            { error: `Insufficient stock for product ID ${item.productId}` },
            { status: 400 }
          );
        }

        await prisma.stock.update({
          where: { id: currentStock.id },
          data: { quantity: newQuantity },
        });

        await prisma.product.update({
          where: { id: Number(item.productId) },
          data: { inStock: newQuantity > 0 },
        });
      } else {
        await prisma.product.update({
          where: { id: Number(item.productId) },
          data: { inStock: false },
        });
      }
    }

    return NextResponse.json({
      ...order,
      saleitems: order.saleitem,
    });
  } catch (error: any) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------- UPDATE order status (PATCH) ----------------
export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status are required" }, { status: 400 });
    }

    const updatedOrder = await prisma.sale.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
      },
    });

    return NextResponse.json({
      ...updatedOrder,
      saleitems: updatedOrder.saleitem,
    });
  } catch (error: any) {
    console.error("PATCH /api/orders error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
