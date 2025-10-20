import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all products ----------------
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { stock: true },
      orderBy: { createdAt: "desc" },
    });

    const normalized = products.map((p) => ({
      ...p,
      stockQuantity: p.stock.reduce((sum, s) => sum + s.quantity, 0),
    }));

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

    // Check if this is a restock request - delegate to /api/restock
    if (body.action === "restock") {
      try {
        const restockResponse = await fetch(
          new URL("/api/restock", req.url).toString(),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        const restockData = await restockResponse.json();

        return NextResponse.json(restockData, {
          status: restockResponse.status,
        });
      } catch (error) {
        console.error("Failed to call /api/restock:", error);
        return NextResponse.json(
          { error: "Failed to process restock" },
          { status: 500 }
        );
      }
    }

    // Regular product creation
    const {
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
        ...newProduct,
        stockQuantity: newProduct.stock.reduce(
          (sum, s) => sum + s.quantity,
          0
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}

// ---------------- UPDATE a product (for editing) ----------------
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

    // Build the update data object
    const updateData: any = {
      name,
      description,
      price: Number(price),
      productionCost: productionCost ? Number(productionCost) : null,
      category,
    };

    // Only update stock if stockQuantity is provided
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

    return NextResponse.json({
      ...updatedProduct,
      stockQuantity: updatedProduct.stock.reduce(
        (sum, s) => sum + s.quantity,
        0
      ),
    });
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

    // Check if product is used in orders or sales
    const usedInOrder = await prisma.order.count({
      where: { productId },
    });
    const usedInSale = await prisma.saleitem.count({
      where: { productId },
    });

    if (usedInOrder > 0 || usedInSale > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this product because it is linked to existing sales or orders.",
        },
        { status: 400 }
      );
    }

    // Delete related records
    await prisma.restock.deleteMany({
      where: { productId },
    });

    await prisma.stock.deleteMany({
      where: { productId },
    });

    // Now delete the product safely
    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete product" },
      { status: 500 }
    );
  }
}