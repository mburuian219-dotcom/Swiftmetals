// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper to normalize email
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Check if string is a valid email
function isValidEmail(str: string): boolean {
  if (!str) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

// ================== AUDIT LOG HELPER ==================
async function createAuditLog(
  saleId: number,
  action: string,
  changedBy: string,
  changedByEmail: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  fieldName?: string,
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
        fieldName,
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

// ================== SOFT DELETE HELPER ==================
async function createDeletedSaleRecord(
  sale: any,
  deletedBy: string,
  deletedByEmail: string | undefined,
  deletionReason: string,
  ipAddress: string | undefined,
  restockedItems: boolean
) {
  try {
    // Create summary of sale items
    const saleItemsSummary = sale.saleitem?.map((item: any) => 
      `${item.product?.name || `Product ${item.productId}`} (${item.quantity} units @ Ksh ${item.price})`
    ).join(', ') || 'No items';
    
    // Create summary of payments
    const paymentsSummary = sale.payment?.map((p: any) => 
      `${p.method}: Ksh ${p.amount}${p.referenceId ? ` (Ref: ${p.referenceId})` : ''}`
    ).join(', ') || 'No payments';
    
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const deletedSale = await prisma.deletedsale.create({
      data: {
        originalSaleId: sale.id,
        saleData: JSON.parse(JSON.stringify(sale)),
        customerName: sale.customer?.name || 'Unknown Customer',
        customerPhone: sale.customer?.phone || null,
        customerId: sale.customerId,
        totalAmount: sale.amount,
        saleDate: sale.date,
        statusAtDeletion: sale.status,
        dueDate: sale.dueDate,
        deletedBy,
        deletedByEmail,
        deletionReason,
        ipAddress,
        saleItemsSummary,
        paymentsSummary,
        restockedItems,
        expiresAt
      }
    });
    
    console.log(`📦 Deleted sale record created: ${deletedSale.id} for original sale ${sale.id}, expires at ${expiresAt}`);
    return deletedSale;
  } catch (error) {
    console.error("❌ Failed to create deleted sale record:", error);
    throw error;
  }
}

// Helper function to handle restocking items
async function handleRestockItems(sale: any) {
  try {
    const productUpdates: { productId: number, quantity: number }[] = [];
    
    for (const saleItem of sale.saleitem) {
      const product = saleItem.product;
      
      if (product) {
        productUpdates.push({
          productId: product.id,
          quantity: saleItem.quantity
        });
      }
    }
    
    for (const update of productUpdates) {
      const existingStock = await prisma.stock.findFirst({
        where: { productId: update.productId }
      });
      
      if (existingStock) {
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: { 
            quantity: existingStock.quantity + update.quantity,
            updatedAt: new Date()
          },
        });
        
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
  }
}

// Helper to compare objects for audit log
function getObjectDifferences(oldObj: any, newObj: any): { fieldName: string; oldValue: string; newValue: string; difference: string }[] {
  const differences: { fieldName: string; oldValue: string; newValue: string; difference: string }[] = [];
  
  // Fields to track for sale
  const fieldsToTrack = ['amount', 'status', 'dueDate', 'paymentMethod'];
  
  for (const field of fieldsToTrack) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      differences.push({
        fieldName: field,
        oldValue: String(oldVal ?? 'null'),
        newValue: String(newVal ?? 'null'),
        difference: `Changed from ${oldVal ?? 'null'} to ${newVal ?? 'null'}`
      });
    }
  }
  
  return differences;
}

// ---------------- GET /api/sales/[id] ----------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includeAudit = req.nextUrl.searchParams.get('includeAudit') === 'true';

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

    // Fetch audit logs separately if requested
    let auditLogs = null;
    if (includeAudit) {
      auditLogs = await prisma.saleauditlog.findMany({
        where: { saleId: Number(id) },
        orderBy: { changedAt: 'desc' },
        take: 50,
      });
    }

    return NextResponse.json({
      ...sale,
      auditLogs: auditLogs || undefined
    });
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
    
    // Extract audit info from request
    const changedBy = body.updatedBy || body.changedBy || "SYSTEM";
    const changedByEmail = body.updatedByEmail || body.changedByEmail;
    const ipAddress = body.ipAddress || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const userAgent = body.userAgent || req.headers.get('user-agent') || undefined;

    // Get original sale before update for audit comparison
    const originalSale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        payment: true,
        saleitem: { include: { product: true } },
      },
    });

    if (!originalSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Create a snapshot of the original state
    const originalSnapshot = {
      amount: originalSale.amount,
      status: originalSale.status,
      dueDate: originalSale.dueDate,
      paymentMethod: originalSale.paymentMethod,
      saleItems: originalSale.saleitem.map(item => ({
        productId: item.productId,
        productName: item.product?.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      payments: originalSale.payment.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        referenceId: p.referenceId,
        status: p.status
      }))
    };

    // ------------------ Comprehensive Sale Items Update ------------------
    if (body.saleItems && Array.isArray(body.saleItems)) {
      const currentSaleItems = await prisma.saleitem.findMany({
        where: { saleId: Number(id) }
      });

      const incomingItemIds = body.saleItems
        .map((item: any) => item.id)
        .filter((id: any) => id !== undefined);

      const itemsToDelete = currentSaleItems.filter(
        (currentItem) => !incomingItemIds.includes(currentItem.id)
      );

      if (itemsToDelete.length > 0) {
        await prisma.saleitem.deleteMany({
          where: {
            id: { in: itemsToDelete.map(item => item.id) }
          }
        });
      }

      for (const item of body.saleItems) {
        if (!item.productId || item.quantity === undefined || item.price === undefined) {
          console.warn("Skipping invalid sale item:", item);
          continue;
        }

        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          console.warn(`Product with ID ${item.productId} not found, skipping item`);
          continue;
        }

        const itemTotal = item.quantity * item.price;

        if (item.id) {
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
    const paymentChanges: any[] = [];
    
    if (body.payments && Array.isArray(body.payments)) {
      for (const p of body.payments) {
        if (!p.id) continue;
        
        const originalPayment = originalSale.payment.find(op => op.id === p.id);
        
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
        
        // Track payment changes for audit
        if (originalPayment && originalPayment.amount !== Number(p.amount)) {
          paymentChanges.push({
            fieldName: `payment_${p.id}_amount`,
            oldValue: String(originalPayment.amount),
            newValue: String(p.amount),
            difference: `Payment amount changed from ${originalPayment.amount} to ${p.amount}`
          });
        }
      }
    }

    // ------------------ Add new payments ------------------
    let newPaymentsCount = 0;
    if (body.newPayments && Array.isArray(body.newPayments)) {
      for (const np of body.newPayments) {
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
        newPaymentsCount++;
      }
    }

    // ------------------ Recalculate totals & status ------------------
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
        dueDate: body.dueDate ? new Date(body.dueDate) : originalSale.dueDate,
        paymentMethod: body.paymentMethod ?? originalSale.paymentMethod,
        checkDepositDate: body.checkDepositDate ? new Date(body.checkDepositDate) : originalSale.checkDepositDate,
        status,
        updatedBy: changedBy,
      },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    // Create snapshot of the new state
    const newSnapshot = {
      amount: updatedSale.amount,
      status: updatedSale.status,
      dueDate: updatedSale.dueDate,
      paymentMethod: updatedSale.paymentMethod,
      saleItems: updatedSale.saleitem.map(item => ({
        productId: item.productId,
        productName: item.product?.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      payments: updatedSale.payment.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        referenceId: p.referenceId,
        status: p.status
      }))
    };

    // Create audit log for the update
    const differences = getObjectDifferences(originalSnapshot, newSnapshot);
    
    // Add payment changes
    differences.push(...paymentChanges);
    
    if (newPaymentsCount > 0) {
      differences.push({
        fieldName: 'new_payments',
        oldValue: '0',
        newValue: String(newPaymentsCount),
        difference: `Added ${newPaymentsCount} new payment(s)`
      });
    }
    
    if (differences.length > 0) {
      // Log each individual change
      for (const diff of differences) {
        await createAuditLog(
          Number(id),
          "UPDATE",
          changedBy,
          changedByEmail,
          ipAddress,
          userAgent,
          diff.fieldName,
          diff.oldValue,
          diff.newValue,
          diff.difference,
          { before: originalSnapshot, after: newSnapshot },
          `Sale updated: ${diff.difference}`
        );
      }
    } else {
      // Log a generic update if no specific changes were tracked
      await createAuditLog(
        Number(id),
        "UPDATE",
        changedBy,
        changedByEmail,
        ipAddress,
        userAgent,
        undefined,
        undefined,
        undefined,
        "Sale record updated",
        { before: originalSnapshot, after: newSnapshot },
        "Sale updated with changes to items or payments"
      );
    }

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
    const { 
      restockItems = false, 
      deletedBy, 
      deletedByEmail, 
      deletionReason,
      ipAddress,
      userAgent 
    } = body;

    // First, get the sale with its items to know what products to restock
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: {
              include: {
                stock: true
              }
            } 
          } 
        },
        payment: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Validate deletion reason
    if (!deletionReason || deletionReason.trim() === "") {
      return NextResponse.json({ 
        error: "Deletion reason is required for audit purposes" 
      }, { status: 400 });
    }

    const deletingUser = deletedBy || "SYSTEM";
    const deletingUserEmail = deletedByEmail;

    // Create audit log before deletion
    await createAuditLog(
      Number(id),
      "DELETE",
      deletingUser,
      deletingUserEmail,
      ipAddress || req.headers.get('x-forwarded-for') || undefined,
      userAgent || req.headers.get('user-agent') || undefined,
      undefined,
      undefined,
      undefined,
      `Sale deleted. Reason: ${deletionReason}. Restocked: ${restockItems}`,
      { saleData: sale, restockedItems: restockItems, deletionReason },
      `Sale deleted with reason: ${deletionReason}`
    );

    // Create deleted sale record in archive
    await createDeletedSaleRecord(
      sale,
      deletingUser,
      deletingUserEmail,
      deletionReason,
      ipAddress || req.headers.get('x-forwarded-for') || undefined,
      restockItems
    );

    // Handle restocking if requested
    if (restockItems) {
      await handleRestockItems(sale);
    }

    // Use transaction for deletion operations
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
      timeout: 10000,
    });

    return NextResponse.json({ 
      message: `Sale deleted successfully${restockItems ? ' with items restocked' : ''}. Record saved in archive for 7 days.`, 
      sale: result,
      restockedItems: restockItems ? sale.saleitem.length : 0,
      auditInfo: {
        deletedBy: deletingUser,
        deletionReason,
        archived: true,
        expiresIn: "7 days"
      }
    });
  } catch (error: any) {
    console.error("❌ Delete Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete sale" },
      { status: 500 }
    );
  }
}