import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- CREATE (POST) ----------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      productId,
      quantity,
      totalCost,
      paymentSource,
      creditorName,
      creditorPhone,
      creditorEmail,
    } = body;

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

    if (quantityNum <= 0 || totalCostNum <= 0) {
      return NextResponse.json(
        { error: "Quantity and total cost must be positive" },
        { status: 400 }
      );
    }

    // ---------------- FETCH PRODUCT ----------------
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

    // ---------------- CALCULATE CURRENT STOCK VALUES ----------------
    const currentQuantity = product.stock.reduce((sum, s) => sum + s.quantity, 0);
    const currentValue = product.stock.reduce(
      (sum, s) => sum + s.quantity * s.costPrice,
      0
    );

    // ---------------- CALCULATE RESTOCK VALUES ----------------
    const restockQuantity = quantityNum;
    const restockValue = totalCostNum;
    const unitCostPrice = restockQuantity > 0 ? restockValue / restockQuantity : 0;

    // ---------------- CALCULATE NEW WEIGHTED AVERAGE ----------------
    const newTotalQuantity = currentQuantity + restockQuantity;
    const newTotalValue = currentValue + restockValue;
    const newWeightedCostPrice =
      newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

    // ---------------- TRANSACTION WITH INCREASED TIMEOUT ----------------
    const { updatedProduct, restock, creditorId } = await prisma.$transaction(
      async (tx) => {
        // ---------------- HANDLE CREDITOR ----------------
        let creditorId: number | null = null;

        if (paymentSource === "credit" && creditorName?.trim()) {
          // Use upsert to reduce queries
          const creditor = await tx.creditor.upsert({
            where: { name: creditorName.trim() },
            update: {
              totalOwed: { increment: totalCostNum },
              // Optionally update contact info if provided
              ...(creditorPhone && { phone: creditorPhone.trim() }),
              ...(creditorEmail && { email: creditorEmail.trim() }),
            },
            create: {
              name: creditorName.trim(),
              phone: creditorPhone?.trim() || null,
              email: creditorEmail?.trim() || null,
              totalOwed: totalCostNum,
            },
          });

          creditorId = creditor.id;
        }

        // ---------------- UPDATE OR CREATE STOCK ----------------
        let updatedProduct;

        if (product.stock.length > 0) {
          // Update first stock record with weighted average cost
          const existingStock = product.stock[0];
          await tx.stock.update({
            where: { id: existingStock.id },
            data: {
              quantity: newTotalQuantity,
              costPrice: newWeightedCostPrice,
            },
          });

          updatedProduct = await tx.product.findUnique({
            where: { id: productIdNum },
            include: { stock: true },
          });
        } else {
          // No existing stock, create new stock entry
          updatedProduct = await tx.product.update({
            where: { id: productIdNum },
            data: {
              stock: {
                create: {
                  name: `${product.name} stock`,
                  quantity: restockQuantity,
                  costPrice: unitCostPrice,
                  sellingPrice: product.price,
                },
              },
            },
            include: { stock: true },
          });
        }

        // ---------------- CREATE RESTOCK RECORD ----------------
        const restock = await tx.restock.create({
          data: {
            productId: productIdNum,
            quantity: restockQuantity,
            totalCost: totalCostNum,
            costPrice: unitCostPrice,
            paymentSource,
            creditorId,
          },
        });

        return { updatedProduct, restock, creditorId };
      },
      {
        maxWait: 10000, // Maximum time to wait for transaction to start (10s)
        timeout: 15000, // Maximum time for transaction to complete (15s)
      }
    );

    // ---------------- CASH LEDGER LOGGING (OUTSIDE TRANSACTION) ----------------
    const lastLedger = await prisma.cashledger.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const prevBalance = lastLedger?.runningBalance || 0;

    if (paymentSource === "cash") {
      const newBalance = prevBalance - totalCostNum;
      await prisma.cashledger.create({
        data: {
          description: `Restocked ${restockQuantity} units of ${product.name}`,
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
          description: `Credit Purchase: ${restockQuantity} units of ${product.name} from ${creditorName || "Unknown"}`,
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
        stockQuantity: newTotalQuantity,
        avgCostPrice: newWeightedCostPrice,
      },
      restock,
      stockSummary: {
        previousQuantity: currentQuantity,
        restockedQuantity: restockQuantity,
        newTotalQuantity,
        previousValue: currentValue,
        restockValue,
        newTotalValue,
        newWeightedCostPrice,
      },
    });
  } catch (error) {
    console.error("POST /api/restock error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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
        product: { include: { stock: true } },
        creditor: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const normalizedRestocks = restocks.map((r) => {
      const stockQuantity = r.product?.stock.reduce((sum, s) => sum + s.quantity, 0) || 0;
      const totalValue = r.product?.stock.reduce(
        (sum, s) => sum + s.quantity * s.costPrice,
        0
      ) || 0;
      const avgCostPrice = stockQuantity > 0 ? totalValue / stockQuantity : 0;

      return {
        ...r,
        product: r.product
          ? {
              ...r.product,
              stockQuantity,
              avgCostPrice,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      restocks: normalizedRestocks,
    });
  } catch (error) {
    console.error("GET /api/restock error:", error);
    return NextResponse.json(
      { error: "Failed to fetch restocks" },
      { status: 500 }
    );
  }
}