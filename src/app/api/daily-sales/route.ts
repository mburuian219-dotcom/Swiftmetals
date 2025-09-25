import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- POST /api/daily-sales → add a sale ----------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity, customerId } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get product price
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const amount = product.price * quantity;

    // Create Sale + SaleItem
    const sale = await prisma.sale.create({
      data: {
        amount,
        customerId: customerId || null,
        saleitem: {   // ✅ must match Prisma relation
          create: {
            productId,
            quantity,
            price: product.price,
            total: amount,
          },
        },
      },
      include: {
        saleitem: { include: { product: true } }, // ✅ match relation
        customer: true,
      },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/daily-sales error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record sale" },
      { status: 500 }
    );
  }
}

// ---------------- GET /api/daily-sales → fetch all sales ----------------
export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        saleitem: { include: { product: true } }, // ✅ match relation
        customer: true,
      },
    });
    return NextResponse.json(sales);
  } catch (error: any) {
    console.error("GET /api/daily-sales error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sales" },
      { status: 500 }
    );
  }
}
