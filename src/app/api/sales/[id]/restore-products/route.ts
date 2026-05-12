// app/api/sales/[id]/restore-products/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper: Create audit log
async function createAuditLog(
  saleId: number,
  action: string,
  changedBy: string,
  changedByEmail: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  oldValue?: string,
  newValue?: string,
  difference?: string,
  snapshot?: any,
  notes?: string
) {
  try {
    await prisma.saleauditlog.create({
      data: {
        saleId,
        action,
        fieldName: "sale_items",
        oldValue,
        newValue,
        difference,
        changedBy,
        changedByEmail,
        ipAddress,
        userAgent,
        snapshot: snapshot ? JSON.parse(JSON.stringify(snapshot)) : undefined,
        notes
      }
    });
    console.log(`📝 Audit log created: ${action} on sale ${saleId} by ${changedBy}`);
  } catch (error) {
    console.error("❌ Failed to create audit log:", error);
  }
}

// Helper: Get sale with details
async function getSaleWithDetails(saleId: number) {
  return await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: true,
      saleitem: { include: { product: true } },
      payment: true,
    },
  });
}

// POST /api/sales/[id]/restore-products
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { 
      saleItems, 
      updatedBy, 
      updatedByEmail,
      ipAddress,
      userAgent,
      forceUpdate = false 
    } = body;

    // Validate input
    if (!saleItems || !Array.isArray(saleItems)) {
      return NextResponse.json(
        { error: "Invalid sale items data" },
        { status: 400 }
      );
    }

    // Get existing sale
    const existingSale = await getSaleWithDetails(Number(id));
    
    if (!existingSale) {
      return NextResponse.json(
        { error: "Sale not found" },
        { status: 404 }
      );
    }

    // Calculate reconstructed total
    const reconstructedTotal = saleItems.reduce((sum, item) => {
      return sum + (item.quantity * item.price);
    }, 0);

    // Check if reconstructed total matches original amount
    const totalMatch = Math.abs(reconstructedTotal - existingSale.amount) < 0.01;
    
    if (!totalMatch && !forceUpdate) {
      return NextResponse.json({
        error: "Products total does not match original sale amount",
        warning: true,
        originalAmount: existingSale.amount,
        reconstructedAmount: reconstructedTotal,
        difference: reconstructedTotal - existingSale.amount,
        message: `Reconstructed total (${reconstructedTotal}) differs from original sale amount (${existingSale.amount}) by ${Math.abs(reconstructedTotal - existingSale.amount).toFixed(2)}`
      }, { status: 409 });
    }

    // Delete existing sale items (outside transaction to reduce transaction time)
    await prisma.saleitem.deleteMany({
      where: { saleId: Number(id) }
    });

    // Create new sale items one by one (outside transaction)
    const createdItems = [];
    for (const item of saleItems) {
      if (!item.productId || !item.quantity || !item.price) {
        throw new Error(`Invalid item data: ${JSON.stringify(item)}`);
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      const saleItem = await prisma.saleitem.create({
        data: {
          saleId: Number(id),
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        },
        include: { product: true }
      });
      
      createdItems.push(saleItem);
    }

    // Update sale timestamp (outside transaction)
    const updatedSale = await prisma.sale.update({
      where: { id: Number(id) },
      data: {
        updatedAt: new Date(),
        updatedBy: updatedBy || "SYSTEM",
      },
    });

    // Create audit log (outside transaction)
    const oldItemsSummary = existingSale.saleitem.map(item => 
      `${item.product?.name || `Product ${item.productId}`} (${item.quantity} x ${item.price})`
    ).join(', ') || 'No products (empty)';
    
    const newItemsSummary = saleItems.map(item => 
      `${item.productName} (${item.quantity} x ${item.price})`
    ).join(', ');

    await createAuditLog(
      Number(id),
      "PRODUCTS_RESTORED",
      updatedBy || "SYSTEM",
      updatedByEmail,
      ipAddress,
      userAgent,
      oldItemsSummary,
      newItemsSummary,
      `Restored ${saleItems.length} product(s) to sale. Original amount: ${existingSale.amount}, Reconstructed total: ${reconstructedTotal}, Match: ${totalMatch}`,
      {
        before: {
          products: existingSale.saleitem,
          totalAmount: existingSale.amount,
          amountPaid: existingSale.payment?.reduce((sum, p) => sum + p.amount, 0) || 0,
        },
        after: {
          products: createdItems,
          totalAmount: existingSale.amount,
          reconstructedTotal: reconstructedTotal,
        }
      },
      totalMatch ? "Products restored successfully" : `Products restored with mismatch warning. Original: ${existingSale.amount}, Reconstructed: ${reconstructedTotal}`
    );

    // Get final sale data
    const finalSale = await getSaleWithDetails(Number(id));
    
    // Calculate current financials
    const totalPaid = finalSale?.payment?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const balance = (finalSale?.amount || 0) - totalPaid;

    return NextResponse.json({
      success: true,
      message: totalMatch 
        ? "Products restored successfully!" 
        : `Products restored with warning: Reconstructed total (${reconstructedTotal}) differs from original amount (${existingSale.amount})`,
      sale: {
        ...finalSale,
        totalAmount: finalSale?.amount,
        amountPaid: totalPaid,
        balance: balance,
        reconstructedTotal: reconstructedTotal,
        matchesOriginal: totalMatch,
      },
      restoredItems: createdItems,
      financialPreserved: {
        originalAmount: existingSale.amount,
        amountPaid: totalPaid,
        balance: balance,
        unchanged: true
      }
    });

  } catch (error: any) {
    console.error("❌ Error restoring products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restore products" },
      { status: 500 }
    );
  }
}

// GET /api/sales/[id]/restore-products
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const totalPaid = sale.payment?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const balance = sale.amount - totalPaid;

    return NextResponse.json({
      id: sale.id,
      customer: sale.customer,
      date: sale.date,
      dueDate: sale.dueDate,
      originalAmount: sale.amount,
      amountPaid: totalPaid,
      balance: balance,
      status: sale.status,
      existingProducts: sale.saleitem.map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      payments: sale.payment,
      hasProducts: sale.saleitem.length > 0,
    });

  } catch (error: any) {
    console.error("❌ Error fetching sale for restoration:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sale" },
      { status: 500 }
    );
  }
}