import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products/:id
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}

// PUT /api/products/:id
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();
  const { name, description, price, stock, category } = body;

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: { name, description, price: Number(price), stock: Number(stock), category },
  });

  return NextResponse.json(updatedProduct);
}

// DELETE /api/products/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ message: "Product deleted successfully" });
}
