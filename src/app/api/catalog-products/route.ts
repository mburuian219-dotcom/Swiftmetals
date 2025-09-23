import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.catalogProduct.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching catalog products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      description,
      price,
      category,
      image, // frontend sends `image` from uploadImage()
      inStock,
      isPublic,
    } = body;

    if (!name || isNaN(Number(price))) {
      return NextResponse.json(
        { error: "Name and valid price are required" },
        { status: 400 }
      );
    }

    const created = await prisma.catalogProduct.create({
      data: {
        name,
        description,
        price: Number(price),
        category,
        image: image || null, // ✅ save image url to DB
        inStock: Boolean(inStock),
        isPublic: Boolean(isPublic),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating catalog product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
