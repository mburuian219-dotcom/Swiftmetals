import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const productId = Number(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, description, price, stockQuantity, category } = body;

    // Fetch the product with its stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stock: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Update product info
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        price: Number(price),
        category,
        // Update the first stock record (assuming one main stock)
        stock: product.stock.length
          ? {
              update: {
                where: { id: product.stock[0].id },
                data: { quantity: Number(stockQuantity) || 0 },
              },
            }
          : {
              create: {
                name: `${name} initial stock`,
                quantity: Number(stockQuantity) || 0,
                costPrice: Number(price), // or keep original costPrice
                sellingPrice: Number(price),
              },
            },
      },
      include: { stock: true }, // return the stock too
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("PUT /api/products/:id error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}
