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

    // Check if this is a restock request
    if (body.action === "restock") {
      return handleRestock(body);
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

// ---------------- RESTOCK handler ----------------
async function handleRestock(body: any) {
  try {
    const { productId, quantity, totalCost, paymentSource, creditorName } = body;

    const productIdNum = Number(productId);
    const quantityNum = Number(quantity);
    const totalCostNum = Number(totalCost);

    if (!productId || isNaN(productIdNum)) {
      return NextResponse.json(
        { error: "Valid product ID is required" },
        { status: 400 }
      );
    }

    if (!quantity || isNaN(quantityNum) || quantityNum <= 0) {
      return NextResponse.json(
        { error: "Valid quantity is required" },
        { status: 400 }
      );
    }

    if (totalCost === undefined || isNaN(totalCostNum) || totalCostNum < 0) {
      return NextResponse.json(
        { error: "Valid total cost is required" },
        { status: 400 }
      );
    }

    if (!paymentSource) {
      return NextResponse.json(
        { error: "Payment source is required" },
        { status: 400 }
      );
    }

    // If payment source is credit, validate creditor name
    if (paymentSource === "credit" && !creditorName?.trim()) {
      return NextResponse.json(
        { error: "Creditor name is required for credit purchases" },
        { status: 400 }
      );
    }

    // Get the product with its stock
    const product = await prisma.product.findUnique({
      where: { id: productIdNum },
      include: { stock: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Calculate new stock values
    const currentStock = product.stock.reduce((sum, s) => sum + s.quantity, 0);
    const currentTotalValue = product.stock.reduce(
      (sum, s) => sum + s.quantity * s.costPrice,
      0
    );
    const newTotalValue = currentTotalValue + totalCostNum;
    const newTotalQuantity = currentStock + quantityNum;
    const newCostPrice = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

    // Handle creditor if payment source is credit
    let creditorId = null;
    if (paymentSource === "credit" && creditorName) {
      // Find or create creditor
      let creditor = await prisma.creditor.findUnique({
        where: { name: creditorName.trim() },
      });

      if (creditor) {
        // Update existing creditor's total owed
        creditor = await prisma.creditor.update({
          where: { id: creditor.id },
          data: {
            totalOwed: {
              increment: totalCostNum,
            },
          },
        });
      } else {
        // This shouldn't happen as frontend creates it, but handle anyway
        creditor = await prisma.creditor.create({
          data: {
            name: creditorName.trim(),
            phone: null,
            email: null,
            totalOwed: totalCostNum,
          },
        });
      }

      creditorId = creditor.id;
    }

    // Update or create stock entry and create restock record
    let updatedProduct;
    if (product.stock.length > 0) {
      // Update the first stock entry with new quantity and weighted average cost price
      updatedProduct = await prisma.product.update({
        where: { id: productIdNum },
        data: {
          stock: {
            update: {
              where: { id: product.stock[0].id },
              data: {
                quantity: newTotalQuantity,
                costPrice: newCostPrice,
              },
            },
          },
          restock: {
            create: {
              quantity: quantityNum,
              costPrice: totalCostNum / quantityNum,
              totalCost: totalCostNum,
              paymentSource,
              creditorId,
            },
          },
        },
        include: { stock: true },
      });
    } else {
      // Create new stock entry if none exists
      updatedProduct = await prisma.product.update({
        where: { id: productIdNum },
        data: {
          stock: {
            create: {
              name: `${product.name} stock`,
              quantity: quantityNum,
              costPrice: totalCostNum / quantityNum,
              sellingPrice: product.price,
            },
          },
          restock: {
            create: {
              quantity: quantityNum,
              costPrice: totalCostNum / quantityNum,
              totalCost: totalCostNum,
              paymentSource,
              creditorId,
            },
          },
        },
        include: { stock: true },
      });
    }

    // Record expense if payment source is cash
    if (paymentSource === "cash") {
      try {
        await prisma.expense.create({
          data: {
            title: `Restocked ${quantityNum} units of ${product.name}`,
            amount: totalCostNum,
            category: "inventory",
            notes: `Restock purchase - ${quantityNum} units at KSh ${(totalCostNum / quantityNum).toFixed(2)} per unit`,
            date: new Date(),
          },
        });
      } catch (expenseError) {
        console.error("Failed to create expense record:", expenseError);
        // Continue even if expense creation fails
      }
    }

    return NextResponse.json({
      ...updatedProduct,
      stockQuantity: updatedProduct.stock.reduce(
        (sum, s) => sum + s.quantity,
        0
      ),
    });
  } catch (error) {
    console.error("Restock error:", error);
    return NextResponse.json(
      { error: "Failed to restock product" },
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