// app/api/sales/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ================== HELPER FUNCTIONS ==================

// Calculate total paid from payments (only CLEARED payments)
async function getTotalPaid(saleId: number): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { 
      saleId: saleId,
      status: "CLEARED"
    }
  });
  
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

// Calculate balance from totalAmount and amountPaid
function calculateBalance(totalAmount: number, amountPaid: number): number {
  return Math.max(0, totalAmount - amountPaid);
}

// Update sale status based on balance
function updateSaleStatus(totalAmount: number, amountPaid: number): string {
  const balance = calculateBalance(totalAmount, amountPaid);
  if (balance <= 0) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

// Get payment history formatted for response
async function getPaymentHistory(saleId: number) {
  const payments = await prisma.payment.findMany({
    where: { saleId: saleId },
    orderBy: { paidAt: 'desc' },
    select: {
      id: true,
      amount: true,
      method: true,
      paidAt: true,
      status: true,
      referenceId: true,
      note: true,
      checkDate: true,
      checkNumber: true,
      bankName: true,
      isVerified: true,
      verifiedAt: true
    }
  });
  
  return payments;
}

// Create audit log entry
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

// Create deleted sale record for archive
async function createDeletedSaleRecord(
  sale: any,
  deletedBy: string,
  deletedByEmail: string | undefined,
  deletionReason: string,
  ipAddress: string | undefined,
  restockItems: boolean,
  totalPaid: number,
  balance: number
) {
  try {
    const saleItemsSummary = sale.saleitem && sale.saleitem.length > 0
      ? sale.saleitem.map((item: any) => 
          `${item.product?.name || `Product ${item.productId}`} (${item.quantity} units @ ${item.price})`
        ).join(', ')
      : 'No products (Debt record only)';
    
    const paymentsSummary = sale.payment && sale.payment.length > 0
      ? sale.payment.map((p: any) => 
          `${p.method}: ${p.amount}${p.referenceId ? ` (Ref: ${p.referenceId})` : ''}`
        ).join(', ')
      : 'No payments';
    
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
        restockedItems: restockItems,
        expiresAt
      }
    });
    
    console.log(`📦 Deleted sale record created: ${deletedSale.id} for original sale ${sale.id}`);
    return deletedSale;
  } catch (error) {
    console.error("❌ Failed to create deleted sale record:", error);
    throw error;
  }
}

// Handle restocking items when a sale is deleted
async function handleRestockItems(sale: any) {
  try {
    if (!sale.saleitem || sale.saleitem.length === 0) {
      console.log("No items to restock");
      return;
    }
    
    for (const saleItem of sale.saleitem) {
      const existingStock = await prisma.stock.findFirst({
        where: { productId: saleItem.productId }
      });
      
      if (existingStock) {
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: { 
            quantity: existingStock.quantity + saleItem.quantity,
            updatedAt: new Date()
          },
        });
        
        // Update product stock status
        if (existingStock.quantity + saleItem.quantity > 0) {
          await prisma.product.update({
            where: { id: saleItem.productId },
            data: { 
              inStock: true,
              updatedAt: new Date()
            }
          });
        }
      } else {
        const product = await prisma.product.findUnique({
          where: { id: saleItem.productId }
        });
        
        if (product) {
          await prisma.stock.create({
            data: {
              name: product.name,
              quantity: saleItem.quantity,
              costPrice: product.productionCost || product.price * 0.7,
              sellingPrice: product.price,
              productId: saleItem.productId,
              notes: `Restocked from deleted sale #${sale.id}`,
              createdAt: new Date(),
              updatedAt: new Date()
            },
          });
        }
      }
    }
    
    console.log(`✅ Restocked ${sale.saleitem.length} items from deleted sale`);
  } catch (error) {
    console.error("❌ Error during restocking:", error);
  }
}

// ================== GET /api/sales/[id] ==================
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
        saleitem: { 
          include: { 
            product: true,
            staffInventory: true
          } 
        },
        payment: true,
        paymentschedule: true,
        invoice: true,
        smsreminder: true
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Calculate financials using stored amount (NOT from sale items)
    const totalPaid = await getTotalPaid(sale.id);
    const balance = calculateBalance(sale.amount, totalPaid);
    const calculatedStatus = updateSaleStatus(sale.amount, totalPaid);
    
    // Get payment history
    const paymentHistory = await getPaymentHistory(sale.id);

    // Fetch audit logs if requested
    let auditLogs = null;
    if (includeAudit) {
      auditLogs = await prisma.saleauditlog.findMany({
        where: { saleId: Number(id) },
        orderBy: { changedAt: 'desc' },
        take: 50,
      });
    }

    // Build response object explicitly to avoid type issues
    const responseData = {
      // Sale fields
      id: sale.id,
      customerId: sale.customerId,
      amount: sale.amount,
      date: sale.date,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      dueDate: sale.dueDate,
      status: sale.status,
      checkDepositDate: sale.checkDepositDate,
      isCheckDeposited: sale.isCheckDeposited,
      lastReminderDate: sale.lastReminderDate,
      paymentMethod: sale.paymentMethod,
      remindersSent: sale.remindersSent,
      isDeleted: sale.isDeleted,
      deletedAt: sale.deletedAt,
      deletedBy: sale.deletedBy,
      deletionReason: sale.deletionReason,
      updatedBy: sale.updatedBy,
      createdBy: sale.createdBy,
      createdById: sale.createdById,
      // Relations
      customer: sale.customer,
      saleitem: sale.saleitem,
      payment: sale.payment,
      paymentschedule: sale.paymentschedule,
      invoice: sale.invoice,
      smsreminder: sale.smsreminder,
      // Calculated fields
      totalAmount: sale.amount,
      amountPaid: totalPaid,
      balance: balance,
      calculatedStatus: calculatedStatus,
      paymentHistory: paymentHistory,
      hasProducts: sale.saleitem && sale.saleitem.length > 0,
      productCount: sale.saleitem?.length || 0,
      auditLogs: auditLogs || undefined,
      warning: (!sale.saleitem || sale.saleitem.length === 0) && sale.amount > 0 
        ? "This is a debt record with no product details. Financial data is preserved."
        : null
    };
    
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error("❌ GET Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sale" },
      { status: 500 }
    );
  }
}

// ================== PUT /api/sales/[id] ==================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Extract audit info
    const changedBy = body.updatedBy || body.changedBy || "SYSTEM";
    const changedByEmail = body.updatedByEmail || body.changedByEmail;
    const ipAddress = body.ipAddress || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const userAgent = body.userAgent || req.headers.get('user-agent') || undefined;

    // Get existing sale with all relations
    const existingSale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        payment: true,
        saleitem: { include: { product: true } }
      },
    });

    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Get current total paid
    const currentTotalPaid = await getTotalPaid(existingSale.id);
    const currentBalance = calculateBalance(existingSale.amount, currentTotalPaid);
    
    // Handle different update scenarios
    let newPaymentAmount = 0;
    let paymentRecord = null;
    let updatedTotalPaid = currentTotalPaid;
    
    // SCENARIO 1: Add a new payment
    if (body.addPayment) {
      const { amount, method, note, referenceId, checkDate, bankName, checkNumber } = body.addPayment;
      
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
      }
      
      // Validate payment doesn't exceed balance
      if (amount > currentBalance) {
        return NextResponse.json({ 
          error: `Payment amount (${amount}) exceeds remaining balance (${currentBalance})`,
          remainingBalance: currentBalance
        }, { status: 400 });
      }
      
      // Create the payment record
      paymentRecord = await prisma.payment.create({
        data: {
          saleId: existingSale.id,
          amount: Number(amount),
          method: method || "CASH",
          note: note || null,
          referenceId: referenceId || null,
          checkDate: checkDate ? new Date(checkDate) : null,
          checkNumber: checkNumber || null,
          bankName: bankName || null,
          status: method === "CHECK" && !checkDate ? "PENDING" : "CLEARED",
          paidAt: new Date(),
        },
      });
      
      newPaymentAmount = Number(amount);
      updatedTotalPaid = currentTotalPaid + newPaymentAmount;
      
      // Create audit log for payment
      await createAuditLog(
        existingSale.id,
        "PAYMENT_ADDED",
        changedBy,
        changedByEmail,
        ipAddress,
        userAgent,
        "payment",
        String(currentTotalPaid),
        String(updatedTotalPaid),
        `Added payment of ${newPaymentAmount}. New total paid: ${updatedTotalPaid}`,
        {
          before: { 
            amountPaid: currentTotalPaid, 
            balance: currentBalance,
            status: existingSale.status
          },
          after: { 
            amountPaid: updatedTotalPaid, 
            balance: calculateBalance(existingSale.amount, updatedTotalPaid),
            status: updateSaleStatus(existingSale.amount, updatedTotalPaid)
          },
          payment: paymentRecord
        },
        `Payment of ${newPaymentAmount} added via ${method || "CASH"}`
      );
    }
    
    // SCENARIO 2: Update sale details (but NEVER recalculate amount from products)
    let saleUpdateData: any = {};
    let hasSaleUpdates = false;
    
    // Update due date
    if (body.dueDate !== undefined) {
      saleUpdateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      hasSaleUpdates = true;
    }
    
    // Update payment method
    if (body.paymentMethod !== undefined) {
      saleUpdateData.paymentMethod = body.paymentMethod;
      hasSaleUpdates = true;
    }
    
    // Update notes (if you have this field)
    if (body.notes !== undefined) {
      saleUpdateData.notes = body.notes;
      hasSaleUpdates = true;
    }
    
    // Update check deposit date
    if (body.checkDepositDate !== undefined) {
      saleUpdateData.checkDepositDate = body.checkDepositDate ? new Date(body.checkDepositDate) : null;
      hasSaleUpdates = true;
    }
    
    // Update isCheckDeposited flag
    if (body.isCheckDeposited !== undefined) {
      saleUpdateData.isCheckDeposited = body.isCheckDeposited;
      hasSaleUpdates = true;
    }
    
    // IMPORTANT: NEVER update the amount field from products
    // The amount field is the source of truth for totalAmount
    
    // Update sale record if needed
    if (hasSaleUpdates) {
      saleUpdateData.updatedBy = changedBy;
      saleUpdateData.updatedAt = new Date();
      
      await prisma.sale.update({
        where: { id: existingSale.id },
        data: saleUpdateData,
      });
      
      await createAuditLog(
        existingSale.id,
        "UPDATE",
        changedBy,
        changedByEmail,
        ipAddress,
        userAgent,
        "sale_details",
        JSON.stringify({ 
          dueDate: existingSale.dueDate, 
          paymentMethod: existingSale.paymentMethod 
        }),
        JSON.stringify({ 
          dueDate: saleUpdateData.dueDate || existingSale.dueDate, 
          paymentMethod: saleUpdateData.paymentMethod || existingSale.paymentMethod 
        }),
        "Sale details updated",
        { before: existingSale, after: saleUpdateData },
        "Updated sale details"
      );
    }
    
    // Update sale status based on new total paid
    const newBalance = calculateBalance(existingSale.amount, updatedTotalPaid);
    const newStatus = updateSaleStatus(existingSale.amount, updatedTotalPaid);
    
    if (newStatus !== existingSale.status) {
      await prisma.sale.update({
        where: { id: existingSale.id },
        data: { 
          status: newStatus,
          updatedBy: changedBy,
          updatedAt: new Date()
        },
      });
      
      await createAuditLog(
        existingSale.id,
        "STATUS_UPDATE",
        changedBy,
        changedByEmail,
        ipAddress,
        userAgent,
        "status",
        existingSale.status,
        newStatus,
        `Status changed from ${existingSale.status} to ${newStatus}`,
        { before: existingSale.status, after: newStatus, totalPaid: updatedTotalPaid, balance: newBalance },
        `Status updated due to payment changes`
      );
    }
    
    // SCENARIO 3: Update sale items (for new sales with products)
    if (body.saleItems && Array.isArray(body.saleItems) && body.replaceItems === true) {
      // This is for new/modern sales that have products
      // WARNING: This should only be used for sales created after the change
      
      // Delete existing items
      await prisma.saleitem.deleteMany({
        where: { saleId: existingSale.id }
      });
      
      // Create new items
      let newTotalAmount = 0;
      for (const item of body.saleItems) {
        if (!item.productId || !item.quantity || !item.price) continue;
        
        const itemTotal = item.quantity * item.price;
        newTotalAmount += itemTotal;
        
        await prisma.saleitem.create({
          data: {
            saleId: existingSale.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: itemTotal,
            staffInventoryId: item.staffInventoryId || null
          }
        });
      }
      
      // Update the sale amount ONLY if explicitly requested
      if (body.updateTotalAmount === true) {
        await prisma.sale.update({
          where: { id: existingSale.id },
          data: { 
            amount: newTotalAmount,
            updatedBy: changedBy,
            updatedAt: new Date()
          },
        });
        
        await createAuditLog(
          existingSale.id,
          "ITEMS_UPDATED",
          changedBy,
          changedByEmail,
          ipAddress,
          userAgent,
          "sale_items",
          `Old total: ${existingSale.amount}`,
          `New total: ${newTotalAmount}`,
          `Sale items updated, total changed from ${existingSale.amount} to ${newTotalAmount}`,
          { oldItems: existingSale.saleitem, newItems: body.saleItems },
          "Updated sale items and recalculated total"
        );
      }
    }
    
    // Get final sale data
    const finalSale = await prisma.sale.findUnique({
      where: { id: existingSale.id },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
        paymentschedule: true
      },
    });
    
    // Get updated payment history
    const paymentHistory = await getPaymentHistory(existingSale.id);
    
    // Return response
    return NextResponse.json({
      ...finalSale,
      totalAmount: existingSale.amount,
      amountPaid: updatedTotalPaid,
      balance: calculateBalance(existingSale.amount, updatedTotalPaid),
      calculatedStatus: updateSaleStatus(existingSale.amount, updatedTotalPaid),
      paymentHistory: paymentHistory,
      paymentAdded: !!paymentRecord,
      newPayment: paymentRecord,
      updatedFields: saleUpdateData,
      message: paymentRecord 
        ? `Payment of ${newPaymentAmount} added successfully. Remaining balance: ${calculateBalance(existingSale.amount, updatedTotalPaid)}`
        : "Sale updated successfully",
      warning: (!finalSale?.saleitem || finalSale.saleitem.length === 0) && existingSale.amount > 0 
        ? "This is a debt record with no product details. Financial data is preserved."
        : null
    });
    
  } catch (error: any) {
    console.error("❌ Update Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sale" },
      { status: 500 }
    );
  }
}

// ================== DELETE /api/sales/[id] ==================
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

    // Get the sale with all relations
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        saleitem: { 
          include: { 
            product: {
              include: { stock: true }
            } 
          } 
        },
        payment: true,
        invoice: true,
        paymentschedule: true,
        smsreminder: true,
        cashledger: true
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
    
    // Get financial summary before deletion
    const totalPaid = await getTotalPaid(sale.id);
    const balance = calculateBalance(sale.amount, totalPaid);

    // Create audit log before deletion
    await createAuditLog(
      Number(id),
      "DELETE",
      deletingUser,
      deletedByEmail,
      ipAddress || req.headers.get('x-forwarded-for') || undefined,
      userAgent || req.headers.get('user-agent') || undefined,
      undefined,
      undefined,
      undefined,
      `Sale deleted. Total Amount: ${sale.amount}, Amount Paid: ${totalPaid}, Balance: ${balance}. Reason: ${deletionReason}. Restocked: ${restockItems}`,
      { 
        saleData: {
          id: sale.id,
          amount: sale.amount,
          date: sale.date,
          customer: sale.customer?.name,
          status: sale.status
        }, 
        financials: { 
          totalAmount: sale.amount, 
          amountPaid: totalPaid, 
          balance 
        }, 
        deletionReason,
        restockedItems: restockItems
      },
      `Sale deleted with reason: ${deletionReason}`
    );

    // Create deleted sale record in archive
    await createDeletedSaleRecord(
      sale,
      deletingUser,
      deletedByEmail,
      deletionReason,
      ipAddress || req.headers.get('x-forwarded-for') || undefined,
      restockItems,
      totalPaid,
      balance
    );

    // Handle restocking if requested (only if products exist)
    if (restockItems && sale.saleitem && sale.saleitem.length > 0) {
      await handleRestockItems(sale);
    }

    // Delete the sale and all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records
      if (sale.saleitem && sale.saleitem.length > 0) {
        await tx.saleitem.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      if (sale.payment && sale.payment.length > 0) {
        await tx.payment.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      if (sale.paymentschedule && sale.paymentschedule.length > 0) {
        await tx.paymentschedule.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      if (sale.smsreminder && sale.smsreminder.length > 0) {
        await tx.smsreminder.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      if (sale.invoice && sale.invoice.length > 0) {
        await tx.invoice.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      if (sale.cashledger && sale.cashledger.length > 0) {
        await tx.cashledger.deleteMany({
          where: { saleId: Number(id) }
        });
      }
      
      // Delete audit logs
      await tx.saleauditlog.deleteMany({
        where: { saleId: Number(id) }
      });

      // Finally delete the sale
      await tx.sale.delete({
        where: { id: Number(id) },
      });

      return true;
    }, {
      timeout: 10000,
    });

    return NextResponse.json({ 
      success: true,
      message: `Sale deleted successfully${restockItems ? ' with items restocked' : ''}. Record saved in archive for 7 days.`, 
      financialSummary: {
        totalAmount: sale.amount,
        totalPaid: totalPaid,
        remainingBalance: balance,
        restockedItems: restockItems && sale.saleitem ? sale.saleitem.length : 0
      },
      auditInfo: {
        deletedBy: deletingUser,
        deletionReason: deletionReason,
        archived: true,
        expiresIn: "7 days",
        originalSaleId: sale.id
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

// ================== PATCH /api/sales/[id] (For partial updates) ==================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    const changedBy = body.updatedBy || body.changedBy || "SYSTEM";
    const changedByEmail = body.updatedByEmail || body.changedByEmail;
    
    const existingSale = await prisma.sale.findUnique({
      where: { id: Number(id) }
    });
    
    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    
    // For partial updates, only update provided fields
    const updateData: any = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.isCheckDeposited !== undefined) updateData.isCheckDeposited = body.isCheckDeposited;
    if (body.lastReminderDate !== undefined) updateData.lastReminderDate = body.lastReminderDate ? new Date(body.lastReminderDate) : null;
    if (body.remindersSent !== undefined) updateData.remindersSent = body.remindersSent;
    
    // NEVER update amount here
    
    if (Object.keys(updateData).length > 0) {
      updateData.updatedBy = changedBy;
      updateData.updatedAt = new Date();
      
      const updatedSale = await prisma.sale.update({
        where: { id: Number(id) },
        data: updateData,
      });
      
      await createAuditLog(
        Number(id),
        "PATCH",
        changedBy,
        changedByEmail,
        undefined,
        undefined,
        Object.keys(updateData).join(", "),
        JSON.stringify({ status: existingSale.status, dueDate: existingSale.dueDate }),
        JSON.stringify(updateData),
        "Partial update applied",
        { before: existingSale, after: updatedSale },
        "Partial update to sale record"
      );
      
      return NextResponse.json({
        ...updatedSale,
        message: "Sale partially updated successfully"
      });
    }
    
    return NextResponse.json({
      ...existingSale,
      message: "No updates provided"
    });
    
  } catch (error: any) {
    console.error("❌ PATCH Sale Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to partially update sale" },
      { status: 500 }
    );
  }
}