import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/products/:id
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // ✅ must await
  const product = await prisma.product.findUnique({ where: { id: Number(id) } });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

// PUT /api/products/:id
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const { name, description, price, stock, category } = body;

  const updatedProduct = await prisma.product.update({
    where: { id: Number(id) },
    data: {
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      category,
    },
  });

  return NextResponse.json(updatedProduct);
}

// DELETE /api/products/:id
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await prisma.product.delete({ where: { id: Number(id) } });
  return NextResponse.json({ message: "Product deleted successfully" });
}
