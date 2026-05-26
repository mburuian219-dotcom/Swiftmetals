// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper function to normalize product data
function normalizeProduct(product: any) {
  const stockQuantity = product.stock?.reduce((sum: number, s: any) => sum + s.quantity, 0) || 0;
  const totalValue = product.stock?.reduce(
    (sum: number, s: any) => sum + s.quantity * s.costPrice,
    0
  ) || 0;
  const avgCostPrice = stockQuantity > 0 ? totalValue / stockQuantity : 0;

  return {
    ...product,
    stockQuantity,
    avgCostPrice,
  };
}

// ---------------- GET all products ----------------
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { stock: true },
      orderBy: { createdAt: "desc" },
    });

    const normalized = products.map((p) => normalizeProduct(p));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// ---------------- CREATE a new product OR RESTOCK ----------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      description,
      price,
      stockQuantity,
      productionCost,
      category,
    } = body;

    if (!name || !price) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    // 🟡 Check if product exists (for restock or update)
    const existingProduct = await prisma.product.findFirst({
      where: { id: Number(id) || undefined, name },
      include: { stock: true },
    });

    if (existingProduct) {
      // 🔁 RESTOCK existing product
      const oldStock = existingProduct.stock.reduce(
        (sum, s) => sum + s.quantity,
        0
      );
      const newTotalStock = oldStock + (Number(stockQuantity) || 0);

      const updatedProduct = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          name,
          description,
          price: Number(price),
          productionCost: productionCost ? Number(productionCost) : null,
          category,
          stock: {
            upsert: {
              where: { id: existingProduct.stock[0]?.id || 0 },
              update: {
                quantity: newTotalStock,
                costPrice: productionCost ? Number(productionCost) : 0,
                sellingPrice: Number(price),
              },
              create: {
                name: `${name} restock`,
                quantity: newTotalStock,
                costPrice: productionCost ? Number(productionCost) : 0,
                sellingPrice: Number(price),
              },
            },
          },
        },
        include: { stock: true },
      });

      return NextResponse.json({
        message: "Product restocked successfully",
        ...normalizeProduct(updatedProduct),
      });
    }

    // 🆕 CREATE new product if not exists
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: Number(price),
        productionCost: productionCost ? Number(productionCost) : null,
        category,
        stock: {
          create: {
            name: `${name} initial stock`,
            quantity: Number(stockQuantity) || 0,
            costPrice: productionCost ? Number(productionCost) : 0,
            sellingPrice: Number(price),
          },
        },
      },
      include: { stock: true },
    });

    return NextResponse.json(
      {
        message: "Product created successfully",
        ...normalizeProduct(newProduct),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to create or restock product" },
      { status: 500 }
    );
  }
}

// ---------------- UPDATE a product (edit info only) ----------------
export async function PUT(req: NextRequest) {
  try {
    const {
      id,
      name,
      description,
      price,
      stockQuantity,
      productionCost,
      category,
    } = await req.json();

    const productId = Number(id);
    if (!id || isNaN(productId)) {
      return NextResponse.json(
        { error: "Valid product ID is required" },
        { status: 400 }
      );
    }

    if (!name || !price) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stock: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updateData: any = {
      name,
      description,
      price: Number(price),
      productionCost: productionCost ? Number(productionCost) : null,
      category,
    };

    if (stockQuantity !== undefined) {
      if (product.stock.length > 0) {
        updateData.stock = {
          update: {
            where: { id: product.stock[0].id },
            data: {
              quantity: Number(stockQuantity),
              costPrice: productionCost ? Number(productionCost) : 0,
              sellingPrice: Number(price),
            },
          },
        };
      } else {
        updateData.stock = {
          create: {
            name: `${name} initial stock`,
            quantity: Number(stockQuantity) || 0,
            costPrice: productionCost ? Number(productionCost) : 0,
            sellingPrice: Number(price),
          },
        };
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: { stock: true },
    });

    return NextResponse.json(normalizeProduct(updatedProduct));
  } catch (error: any) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

// ---------------- DELETE a product ----------------
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const productId = Number(id);

    if (!id || isNaN(productId)) {
      return NextResponse.json(
        { error: "Valid product ID is required" },
        { status: 400 }
      );
    }

    const usedInOrder = await prisma.order.count({ where: { productId } });
    const usedInSale = await prisma.saleitem.count({ where: { productId } });

    if (usedInOrder > 0 || usedInSale > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this product because it is linked to existing sales or orders.",
        },
        { status: 400 }
      );
    }

    await prisma.restock.deleteMany({ where: { productId } });
    await prisma.stock.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete product" },
      { status: 500 }
    );
  }
}