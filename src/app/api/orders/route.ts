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

    return NextResponse.json(
      orders.map((order) => ({
        id: order.id,
        orderNumber: `ORD-${order.id.toString().padStart(3, "0")}`,
        customer: {
          id: order.customer.id,
          name: order.customer.name,
        },
        amount: order.amount,
        totalAmount: order.amount,
        status: order.status,
        date: order.createdAt,
        saleItems: order.saleitem.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          product: item.product,
        })),
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

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const stockWarnings: string[] = [];

    // Validate product existence and stock
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) },
      });

      if (!product) {
        return NextResponse.json({ error: `Product not found (ID: ${item.productId})` }, { status: 404 });
      }

      const currentStock = await prisma.stock.findFirst({
        where: { productId: Number(item.productId) },
        orderBy: { createdAt: "desc" },
      });

      const availableStock = currentStock ? currentStock.quantity : 0;
      const requestedQty = Number(item.quantity);

      if (availableStock < requestedQty) {
        stockWarnings.push(`${product.name}: Available ${availableStock}, Ordered ${requestedQty}, Shortage ${requestedQty - availableStock}`);
      }
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

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

    // Update stock safely
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) },
      });

      const currentStock = await prisma.stock.findFirst({
        where: { productId: Number(item.productId) },
        orderBy: { createdAt: "desc" },
      });

      const orderedQty = Number(item.quantity);

      if (currentStock) {
        const newQuantity = Math.max(0, currentStock.quantity - orderedQty);

        await prisma.stock.update({
          where: { id: currentStock.id },
          data: { quantity: newQuantity },
        });

        await prisma.product.update({
          where: { id: Number(item.productId) },
          data: { inStock: newQuantity > 0 },
        });
      } else {
        // Create stock record only if missing
        await prisma.stock.create({
          data: {
            productId: Number(item.productId),
            name: product?.name || "Unknown Product",
            costPrice: product?.productionCost ?? 0,
            sellingPrice: product?.price ?? 0,
            quantity: 0,
          },
        });

        await prisma.product.update({
          where: { id: Number(item.productId) },
          data: { inStock: false },
        });
      }
    }

    return NextResponse.json({
      id: order.id,
      orderNumber: `ORD-${order.id.toString().padStart(3, "0")}`,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
      },
      amount: order.amount,
      totalAmount: order.amount,
      status: order.status,
      date: order.createdAt,
      stockWarnings: stockWarnings.length ? stockWarnings : null,
      saleItems: order.saleitem.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        product: item.product,
      })),
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
    if (!id || !status) return NextResponse.json({ error: "ID and status are required" }, { status: 400 });

    const currentOrder = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { saleitem: true },
    });

    if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (status === "CANCELLED" && currentOrder.status !== "CANCELLED") {
      for (const item of currentOrder.saleitem) {
        const currentStock = await prisma.stock.findFirst({
          where: { productId: item.productId },
          orderBy: { createdAt: "desc" },
        });

        if (currentStock) {
          const restoredQuantity = currentStock.quantity + item.quantity;
          await prisma.stock.update({
            where: { id: currentStock.id },
            data: { quantity: restoredQuantity },
          });

          await prisma.product.update({
            where: { id: item.productId },
            data: { inStock: restoredQuantity > 0 },
          });
        }
      }
    }

    if (currentOrder.status === "CANCELLED" && status !== "CANCELLED") {
      for (const item of currentOrder.saleitem) {
        const currentStock = await prisma.stock.findFirst({
          where: { productId: item.productId },
          orderBy: { createdAt: "desc" },
        });

        if (currentStock) {
          const newQuantity = Math.max(0, currentStock.quantity - item.quantity);
          await prisma.stock.update({
            where: { id: currentStock.id },
            data: { quantity: newQuantity },
          });

          await prisma.product.update({
            where: { id: item.productId },
            data: { inStock: newQuantity > 0 },
          });
        }
      }
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
      id: updatedOrder.id,
      orderNumber: `ORD-${updatedOrder.id.toString().padStart(3, "0")}`,
      customer: {
        id: updatedOrder.customer.id,
        name: updatedOrder.customer.name,
      },
      amount: updatedOrder.amount,
      totalAmount: updatedOrder.amount,
      status: updatedOrder.status,
      date: updatedOrder.createdAt,
      saleItems: updatedOrder.saleitem.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        product: item.product,
      })),
    });
  } catch (error: any) {
    console.error("PATCH /api/orders error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// ---------------- DELETE an order ----------------
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });

    const order = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { saleitem: true },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (order.status !== "CANCELLED") {
      for (const item of order.saleitem) {
        const currentStock = await prisma.stock.findFirst({
          where: { productId: item.productId },
          orderBy: { createdAt: "desc" },
        });

        if (currentStock) {
          const restoredQuantity = currentStock.quantity + item.quantity;
          await prisma.stock.update({
            where: { id: currentStock.id },
            data: { quantity: restoredQuantity },
          });

          await prisma.product.update({
            where: { id: item.productId },
            data: { inStock: restoredQuantity > 0 },
          });
        }
      }
    }

    await prisma.sale.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: "Order deleted successfully and stock restored" });
  } catch (error: any) {
    console.error("DELETE /api/orders error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete order" }, { status: 500 });
  }
}
