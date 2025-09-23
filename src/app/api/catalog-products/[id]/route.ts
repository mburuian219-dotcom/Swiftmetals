import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; // ✅ now it's a promise
  const productId = Number(id);

  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const data = await req.json();
    const updated = await prisma.catalogProduct.update({
      where: { id: productId },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number(id);

  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.catalogProduct.delete({ where: { id: productId } });
    return NextResponse.json({ message: "Product deleted" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
