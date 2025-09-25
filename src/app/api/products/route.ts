import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all products ----------------
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { stock: true },
      orderBy: { createdAt: "desc" },
    });

    // Compute total stockQuantity
    const normalized = products.map((p) => ({
      ...p,
      stockQuantity: p.stock.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// ---------------- CREATE a new product ----------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, price, stockQuantity, costPrice, category } = body;

    if (!name || !price) {
      return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: Number(price),
        category,
        stock: {
          create: {
            name: `${name} initial stock`,
            quantity: Number(stockQuantity) || 0,
            costPrice: Number(costPrice) || 0,
            sellingPrice: Number(price),
          },
        },
      },
      include: { stock: true },
    });

    return NextResponse.json({
      ...newProduct,
      stockQuantity: newProduct.stock.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0),
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

// ---------------- UPDATE a product ----------------
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const { name, description, price, stockQuantity, category } = await req.json();

    // Update product details
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: Number(price),
        category,
      },
      include: { stock: true },
    });

    // Update stock separately
    if (updatedProduct.stock.length > 0) {
      // Update the first stock entry for simplicity
      await prisma.stock.update({
        where: { id: updatedProduct.stock[0].id },
        data: { quantity: Number(stockQuantity) },
      });
    }

    // Fetch again to include updated stock
    const finalProduct = await prisma.product.findUnique({
      where: { id },
      include: { stock: true },
    });

    return NextResponse.json({
      ...finalProduct,
      stockQuantity: finalProduct?.stock.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0) || 0,
    });
  } catch (error) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
