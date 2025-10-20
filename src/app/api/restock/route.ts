import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- CREATE (POST) ----------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity, totalCost, paymentSource, creditorName } = body;

    // ---------------- VALIDATION ----------------
    if (!productId || !quantity || !totalCost || !paymentSource) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const productIdNum = Number(productId);
    const quantityNum = Number(quantity);
    const totalCostNum = Number(totalCost);

    if (isNaN(productIdNum) || isNaN(quantityNum) || isNaN(totalCostNum)) {
      return NextResponse.json(
        { error: "Invalid number format" },
        { status: 400 }
      );
    }

    // ---------------- FETCH PRODUCT ----------------
    const product = await prisma.product.findUnique({
      where: { id: productIdNum },
      include: { stock: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // ---------------- CALCULATE NEW STOCK ----------------
    const currentStock = product.stock.reduce((sum, s) => sum + s.quantity, 0);
    const currentValue = product.stock.reduce(
      (sum, s) => sum + s.quantity * s.costPrice,
      0
    );

    const newTotalValue = currentValue + totalCostNum;
    const newTotalQuantity = currentStock + quantityNum;
    const newCostPrice =
      newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

    // ---------------- HANDLE CREDITOR ----------------
    let creditorId: number | null = null;

    if (paymentSource === "credit" && creditorName?.trim()) {
      let creditor = await prisma.creditor.findUnique({
        where: { name: creditorName.trim() },
      });

      if (creditor) {
        creditor = await prisma.creditor.update({
          where: { id: creditor.id },
          data: {
            totalOwed: { increment: totalCostNum },
          },
        });
      } else {
        creditor = await prisma.creditor.create({
          data: {
            name: creditorName.trim(),
            totalOwed: totalCostNum,
          },
        });
      }

      creditorId = creditor.id;
    }

    // ---------------- UPDATE STOCK ----------------
    let updatedProduct;
    if (product.stock.length > 0) {
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
        },
        include: { stock: true },
      });
    } else {
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
        },
        include: { stock: true },
      });
    }

    // ---------------- CREATE RESTOCK RECORD ----------------
    const restock = await prisma.restock.create({
      data: {
        productId: productIdNum,
        quantity: quantityNum,
        totalCost: totalCostNum,
        costPrice: totalCostNum / quantityNum,
        paymentSource,
        creditorId,
      },
    });

    // ---------------- CASH LEDGER LOGGING ----------------
    const lastLedger = await prisma.cashledger.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const prevBalance = lastLedger?.runningBalance || 0;

    if (paymentSource === "cash") {
      const newBalance = prevBalance - totalCostNum;
      await prisma.cashledger.create({
        data: {
          description: `Restocked ${quantityNum} units of ${product.name}`,
          type: "OUTFLOW",
          category: "Inventory Purchase",
          amount: totalCostNum,
          runningBalance: newBalance,
          relatedTo: `Product: ${product.name}`,
          affectedAccounts: "Cash (-) | Inventory (+)",
          referenceType: "restock",
          restockId: restock.id,
          date: new Date(),
        },
      });
    }

    if (paymentSource === "credit") {
      await prisma.cashledger.create({
        data: {
          description: `Credit Purchase: ${quantityNum} units of ${product.name}`,
          type: "INFO",
          category: "Credit Purchase",
          amount: totalCostNum,
          runningBalance: prevBalance,
          relatedTo: `Product: ${product.name}`,
          affectedAccounts: "Accounts Payable (+) | Inventory (+)",
          referenceType: "restock",
          restockId: restock.id,
          date: new Date(),
        },
      });
    }

    // ---------------- RESPONSE ----------------
    return NextResponse.json({
      success: true,
      message: "Restock successful",
      product: {
        ...updatedProduct,
        stockQuantity: updatedProduct.stock.reduce(
          (sum, s) => sum + s.quantity,
          0
        ),
      },
    });
  } catch (error) {
    console.error("POST /api/restock error:", error);
    return NextResponse.json(
      { error: "Failed to restock product" },
      { status: 500 }
    );
  }
}

// ---------------- GET ALL RESTOCKS ----------------
export async function GET() {
  try {
    const restocks = await prisma.restock.findMany({
      include: {
        product: true,
        creditor: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      restocks,
    });
  } catch (error) {
    console.error("GET /api/restock error:", error);
    return NextResponse.json(
      { error: "Failed to fetch restocks" },
      { status: 500 }
    );
  }
}
