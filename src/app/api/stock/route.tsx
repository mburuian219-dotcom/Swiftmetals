import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all stock items
export async function GET() {
  try {
    const stock = await prisma.stock.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true }, // ✅ include product details
    });
    return NextResponse.json(stock);
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

// POST - add stock item
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const stock = await prisma.stock.create({
      data: {
        name: body.name,
        quantity: Number(body.quantity),
        costPrice: parseFloat(body.costPrice),
        sellingPrice: parseFloat(body.sellingPrice),
        supplier: body.supplier || null,
        notes: body.notes || null,
        product: {
          connect: { id: Number(body.productId) }, // ✅ connect to Product
        },
      },
      include: { product: true },
    });

    return NextResponse.json(stock);
  } catch (error) {
    console.error("Error creating stock item:", error);
    return NextResponse.json({ error: "Failed to create stock" }, { status: 500 });
  }
}

// PUT - update stock item
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Stock ID required" }, { status: 400 });
    }

    const stock = await prisma.stock.update({
      where: { id: Number(body.id) },
      data: {
        name: body.name,
        quantity: Number(body.quantity),
        costPrice: parseFloat(body.costPrice),
        sellingPrice: parseFloat(body.sellingPrice),
        supplier: body.supplier || null,
        notes: body.notes || null,
        ...(body.productId && {
          product: { connect: { id: Number(body.productId) } }, // ✅ allow product change
        }),
      },
      include: { product: true },
    });

    return NextResponse.json(stock);
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}

// DELETE - remove stock item
export async function DELETE(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Stock ID required" }, { status: 400 });
    }

    await prisma.stock.delete({ where: { id: Number(body.id) } });

    return NextResponse.json({ message: "Stock item deleted" });
  } catch (error) {
    console.error("Error deleting stock item:", error);
    return NextResponse.json({ error: "Failed to delete stock item" }, { status: 500 });
  }
}
