import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------- GET all products ----------------
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { stock: true }, // include stock if needed
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
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

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
