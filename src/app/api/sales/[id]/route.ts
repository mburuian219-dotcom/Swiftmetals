import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET /api/sales/[id] ----------------
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

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("❌ GET Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sale" },
      { status: 500 }
    );
  }
}

// ---------------- PUT /api/sales/[id] ----------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        payment: true,
        saleitem: { include: { product: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // ------------------ Comprehensive Sale Items Update ------------------
    if (body.saleItems && Array.isArray(body.saleItems)) {
      // Get current sale items to identify which ones to delete
      const currentSaleItems = await prisma.saleitem.findMany({
        where: { saleId: Number(id) }
      });

      const incomingItemIds = body.saleItems
        .map((item: any) => item.id)
        .filter((id: any) => id !== undefined);

      // Identify items to delete (present in DB but not in incoming data)
      const itemsToDelete = currentSaleItems.filter(
        (currentItem) => !incomingItemIds.includes(currentItem.id)
      );

      // Delete removed items
      if (itemsToDelete.length > 0) {
        await prisma.saleitem.deleteMany({
          where: {
            id: { in: itemsToDelete.map(item => item.id) }
          }
        });
      }

      // Process each incoming sale item
      for (const item of body.saleItems) {
        // Validate required fields
        if (!item.productId || item.quantity === undefined || item.price === undefined) {
          console.warn("Skipping invalid sale item:", item);
          continue;
        }

        // Verify product exists
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          console.warn(`Product with ID ${item.productId} not found, skipping item`);
          continue;
        }

        // Calculate item total
        const itemTotal = item.quantity * item.price;

        if (item.id) {
          // Update existing sale item
          await prisma.saleitem.update({
            where: { id: item.id },
            data: {
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: itemTotal,
            },
          });
        } else {
          // Create new sale item
          await prisma.saleitem.create({
            data: {
              saleId: Number(id),
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: itemTotal,
            },
          });
        }
      }
    }

    // ------------------ Update existing payments ------------------
    if (body.payments && Array.isArray(body.payments)) {
      for (const p of body.payments) {
        if (!p.id) continue;
        
        await prisma.payment.update({
          where: { id: p.id },
          data: {
            amount: Number(p.amount),
            method: p.method,
            referenceId: p.referenceId || null,
            checkDate: p.checkDepositDate ? new Date(p.checkDepositDate) : null,
            status: p.method === "CHECK" && !p.checkDepositDate ? "PENDING" : "CLEARED",
          },
        });
      }
    }

    // ------------------ Add new payments ------------------
    if (body.newPayments && Array.isArray(body.newPayments)) {
      for (const np of body.newPayments) {
        // Validate payment data
        if (!np.amount || !np.method) {
          console.warn("Skipping invalid payment:", np);
          continue;
        }

        await prisma.payment.create({
          data: {
            saleId: Number(id),
            amount: Number(np.amount),
            method: np.method,
            referenceId: np.referenceId || null,
            checkDate: np.checkDepositDate ? new Date(np.checkDepositDate) : null,
            status: np.method === "CHECK" && !np.checkDepositDate ? "PENDING" : "CLEARED",
            paidAt: new Date(),
          },
        });
      }
    }

    // ------------------ Recalculate totals & status ------------------
    // Recalculate total sale amount from sale items
    const updatedSaleItems = await prisma.saleitem.findMany({
      where: { saleId: Number(id) },
      include: { product: true }
    });

    const recalculatedAmount = updatedSaleItems.reduce(
      (total, item) => total + (item.quantity * item.price), 
      0
    );

    const allPayments = await prisma.payment.findMany({ 
      where: { saleId: Number(id) } 
    });
    
    const totalPaid = allPayments
      .filter(p => p.status === "CLEARED")
      .reduce((sum, p) => sum + p.amount, 0);
      
    const pendingPayments = allPayments.filter(p => p.status === "PENDING");
    const balance = recalculatedAmount - totalPaid;

    let status: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
    if (balance <= 0 && pendingPayments.length === 0) status = "PAID";
    else if (totalPaid > 0 || pendingPayments.length > 0) status = "PARTIAL";

    // ------------------ Update sale with recalculated amount ------------------
    const updatedSale = await prisma.sale.update({
      where: { id: Number(id) },
      data: {
        amount: recalculatedAmount,
        dueDate: body.dueDate ? new Date(body.dueDate) : sale.dueDate,
        paymentMethod: body.paymentMethod ?? sale.paymentMethod,
        checkDepositDate: body.checkDepositDate ? new Date(body.checkDepositDate) : sale.checkDepositDate,
        status,
        updatedBy: body.updatedBy ?? null,
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    return NextResponse.json({ 
      ...updatedSale, 
      remainingAmount: Math.max(0, balance),
      totalPaid 
    });
  } catch (error: any) {
    console.error("❌ Update Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sale" },
      { status: 500 }
    );
  }
}

// ---------------- DELETE /api/sales/[id] ----------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { restockItems = false } = body; // Default to false if not provided

    // First, get the sale with its items to know what products to restock
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        saleitem: { 
          include: { 
            product: {
              include: {
                stock: true // Include stock records for the product
              }
            } 
          } 
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Separate the restocking logic from the deletion logic
    if (restockItems) {
      await handleRestockItems(sale);
    }

    // Use transaction only for deletion operations (reduced workload)
    const result = await prisma.$transaction(async (tx) => {
      // Batch delete related records
      await Promise.all([
        tx.saleitem.deleteMany({
          where: { saleId: Number(id) }
        }),
        tx.payment.deleteMany({
          where: { saleId: Number(id) }
        }),
        tx.paymentschedule.deleteMany({
          where: { saleId: Number(id) }
        }),
        tx.smsreminder.deleteMany({
          where: { saleId: Number(id) }
        }),
        tx.invoice.deleteMany({
          where: { saleId: Number(id) }
        }),
        tx.cashledger.deleteMany({
          where: { saleId: Number(id) }
        })
      ]);

      // Then delete the sale
      const deletedSale = await tx.sale.delete({
        where: { id: Number(id) },
      });

      return deletedSale;
    }, {
      timeout: 10000, // Increase transaction timeout to 10 seconds
    });

    return NextResponse.json({ 
      message: `Sale deleted successfully${restockItems ? ' with items restocked' : ''}`, 
      sale: result,
      restockedItems: restockItems ? sale.saleitem.length : 0
    });
  } catch (error: any) {
    console.error("❌ Delete Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete sale" },
      { status: 500 }
    );
  }
}

// Helper function to handle restocking items (outside transaction)
async function handleRestockItems(sale: any) {
  try {
    const productUpdates: { productId: number, quantity: number }[] = [];
    
    // First, collect all product updates
    for (const saleItem of sale.saleitem) {
      const product = saleItem.product;
      
      if (product) {
        productUpdates.push({
          productId: product.id,
          quantity: saleItem.quantity
        });
      }
    }
    
    // Process stock updates in batches
    for (const update of productUpdates) {
      const existingStock = await prisma.stock.findFirst({
        where: { productId: update.productId }
      });
      
      if (existingStock) {
        // Update existing stock
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: { 
            quantity: existingStock.quantity + update.quantity,
            updatedAt: new Date()
          },
        });
        
        // Update product inStock status if needed
        if (existingStock.quantity + update.quantity > 0) {
          await prisma.product.update({
            where: { id: update.productId },
            data: { 
              inStock: true,
              updatedAt: new Date()
            }
          });
        }
      } else {
        // Create new stock record
        const product = await prisma.product.findUnique({
          where: { id: update.productId }
        });
        
        if (product) {
          await prisma.stock.create({
            data: {
              name: product.name,
              quantity: update.quantity,
              costPrice: product.productionCost || product.price * 0.7,
              sellingPrice: product.price,
              productId: update.productId,
              notes: `Restocked from deleted sale #${sale.id}`,
              createdAt: new Date(),
              updatedAt: new Date()
            },
          });
          
          // Update product inStock status
          if (update.quantity > 0) {
            await prisma.product.update({
              where: { id: update.productId },
              data: { 
                inStock: true,
                updatedAt: new Date()
              }
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error during restocking:", error);
    // Don't throw here, just log the error and continue with deletion
  }
}