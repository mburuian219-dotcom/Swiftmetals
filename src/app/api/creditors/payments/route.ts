// src/app/api/creditors/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ==================== HELPER FUNCTIONS ====================

const calculateCreditorBalance = async (creditorId: number) => {
  const creditor = await prisma.creditor.findUnique({
    where: { id: creditorId },
    include: {
      restocks: {
        select: { totalCost: true },
      },
      payments: {
        where: {
          paymentType: 'creditor',
          status: 'COMPLETED',
        },
        select: { amount: true },
      },
    },
  });

  if (!creditor) return null;

  const totalOwed = creditor.restocks.reduce((sum: number, r: any) => sum + Number(r.totalCost), 0);
  const totalPaid = creditor.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  
  return {
    totalOwed,
    totalPaid,
    balance: Math.max(0, totalOwed - totalPaid),
  };
};

// ==================== GET - Fetch payments ====================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const creditorId = searchParams.get('creditorId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!creditorId) {
      return NextResponse.json(
        { error: "Creditor ID is required" },
        { status: 400 }
      );
    }

    const creditorIdNum = Number(creditorId);
    if (isNaN(creditorIdNum)) {
      return NextResponse.json(
        { error: "Valid creditor ID is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      creditorId: creditorIdNum,
      paymentType: 'creditor',
    };

    if (startDate) {
      where.paidAt = { ...where.paidAt, gte: new Date(startDate) };
    }
    if (endDate) {
      where.paidAt = { ...where.paidAt, lte: new Date(endDate) };
    }

    // Fetch creditor with payments
    const [creditor, payments, totalCount] = await Promise.all([
      prisma.creditor.findUnique({
        where: { id: creditorIdNum },
        include: {
          restocks: {
            select: { totalCost: true },
          },
        },
      }),
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paidAt: true,
          method: true,
          referenceId: true,
          note: true,
          recordedBy: true,
          recordedByEmail: true,
          status: true,
          isVerified: true,
          verifiedAt: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where }),
    ]);

    if (!creditor) {
      return NextResponse.json(
        { error: 'Creditor not found' },
        { status: 404 }
      );
    }

    // Calculate financials
    const totalOwed = creditor.restocks.reduce((sum: number, r: any) => sum + Number(r.totalCost), 0);
    
    // Get all creditor payments (completed) for calculation
    const allCreditorPayments = await prisma.payment.findMany({
      where: {
        creditorId: creditorIdNum,
        paymentType: 'creditor',
        status: 'COMPLETED',
      },
      select: { amount: true },
    });
    
    const totalPaid = allCreditorPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const balance = totalOwed - totalPaid;

    // Transform payments
    const transformedPayments = payments.map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      paymentDate: p.paymentDate || p.paidAt,
      paymentMethod: p.method,
      reference: p.referenceId,
      notes: p.note,
      recordedBy: p.recordedBy || 'System',
      recordedByEmail: p.recordedByEmail || 'system@swiftmetals.com',
      status: p.status,
      isVerified: p.isVerified,
      verifiedAt: p.verifiedAt,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        creditor: {
          id: creditor.id,
          name: creditor.name,
          phone: creditor.phone,
          email: creditor.email,
          totalOwedFromRestocks: totalOwed,
          totalPaid: totalPaid,
          balance: Math.max(0, balance),
          paymentPercentage: totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0,
        },
        payments: transformedPayments,
        pagination: {
          limit,
          offset,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + limit < totalCount,
        },
      },
    });

  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// ==================== POST - Record payment ====================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      creditorId,
      amount,
      paymentDate,
      paymentMethod,
      reference,
      notes,
      recordedBy,
      recordedByEmail,
    } = body;

    // Validate required fields
    if (!creditorId) {
      return NextResponse.json(
        { error: "Creditor ID is required" },
        { status: 400 }
      );
    }

    const creditorIdNum = Number(creditorId);
    if (isNaN(creditorIdNum)) {
      return NextResponse.json(
        { error: "Valid creditor ID is required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid payment amount is required" },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum)) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Check if creditor exists and get their current balance
    const balanceInfo = await calculateCreditorBalance(creditorIdNum);
    
    if (!balanceInfo) {
      return NextResponse.json(
        { error: 'Creditor not found' },
        { status: 404 }
      );
    }

    // Check if payment exceeds balance
    if (amountNum > balanceInfo.balance) {
      return NextResponse.json(
        { 
          error: `Payment exceeds remaining balance`,
          details: {
            remainingBalance: balanceInfo.balance,
            requestedAmount: amountNum,
            difference: amountNum - balanceInfo.balance,
          }
        },
        { status: 400 }
      );
    }

    // Get creditor name for cash ledger
    const creditor = await prisma.creditor.findUnique({
      where: { id: creditorIdNum },
      select: { name: true },
    });

    if (!creditor) {
      return NextResponse.json(
        { error: 'Creditor not found' },
        { status: 404 }
      );
    }

    let payment: any;
    let updatedCreditor: any;

    // Use transaction for atomic operation with increased timeout
    await prisma.$transaction(async (tx: any) => {
      // Create payment
      payment = await tx.payment.create({
        data: {
          creditorId: creditorIdNum,
          amount: amountNum,
          method: paymentMethod || 'cash',
          paidAt: paymentDate ? new Date(paymentDate) : new Date(),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          note: notes || `Payment to creditor: ${creditor.name}`,
          referenceId: reference || null,
          isVerified: true,
          verifiedAt: new Date(),
          status: 'COMPLETED',
          paymentType: 'creditor',
          recordedBy: recordedBy || 'System',
          recordedByEmail: recordedByEmail || 'system@swiftmetals.com',
        },
      });

      // Update creditor's totalOwed
      updatedCreditor = await tx.creditor.update({
        where: { id: creditorIdNum },
        data: {
          totalOwed: Math.max(0, balanceInfo.balance - amountNum),
        },
      });
    }, {
      timeout: 10000, // Increase timeout to 10 seconds
    });

    // Create cash ledger entry OUTSIDE the transaction
    try {
      await prisma.cashledger.create({
        data: {
          date: paymentDate ? new Date(paymentDate) : new Date(),
          description: `Creditor payment: ${creditor.name}`,
          type: "EXPENSE",
          category: "CREDITOR_PAYMENT",
          amount: -amountNum,
          relatedTo: `creditor:${creditorIdNum}`,
          referenceId: payment.id,
          referenceType: "payment",
          email: recordedByEmail || 'system@swiftmetals.com',
        },
      });
    } catch (ledgerError) {
      console.error('Error creating cash ledger entry:', ledgerError);
      // Don't fail the whole request if cash ledger fails
      // You can log this for manual reconciliation
    }

    // Fetch updated creditor with all data
    const updatedCreditorFull = await prisma.creditor.findUnique({
      where: { id: creditorIdNum },
      include: {
        restocks: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          where: {
            paymentType: 'creditor',
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    // Calculate updated totals
    const totalOwed = updatedCreditorFull?.restocks.reduce((sum: number, r: any) => sum + Number(r.totalCost), 0) || 0;
    const totalPaid = updatedCreditorFull?.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        paymentDate: payment.paymentDate || payment.paidAt,
        paymentMethod: payment.method,
        reference: payment.referenceId,
        notes: payment.note,
        recordedBy: payment.recordedBy,
        recordedByEmail: payment.recordedByEmail,
        status: payment.status,
      },
      creditor: {
        id: updatedCreditorFull?.id,
        name: updatedCreditorFull?.name,
        phone: updatedCreditorFull?.phone,
        email: updatedCreditorFull?.email,
        totalOwed: updatedCreditorFull?.totalOwed || 0,
        remainingBalance: updatedCreditorFull?.totalOwed || 0,
        totalPaid: totalPaid,
        totalOwedFromRestocks: totalOwed,
        paymentPercentage: totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record payment' },
      { status: 500 }
    );
  }
}

// ==================== DELETE - Delete payment ====================

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    const paymentId = Number(id);
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Valid payment ID is required" },
        { status: 400 }
      );
    }

    // Check if payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of creditor payments
    if (payment.paymentType !== 'creditor') {
      return NextResponse.json(
        { error: 'Cannot delete this payment as it is not a creditor payment' },
        { status: 400 }
      );
    }

    if (!payment.creditorId) {
      return NextResponse.json(
        { error: 'Payment has no associated creditor' },
        { status: 400 }
      );
    }

    let deletedPayment: any;
    let updatedCreditor: any;

    // Use transaction for atomic operation with increased timeout
    await prisma.$transaction(async (tx: any) => {
      // Delete the payment
      deletedPayment = await tx.payment.delete({
        where: { id: paymentId },
      });

      // Delete associated cash ledger entry
      await tx.cashledger.deleteMany({
        where: {
          referenceId: paymentId,
          referenceType: 'payment',
          category: 'CREDITOR_PAYMENT',
        },
      });

      // Recalculate creditor's balance
      const creditor = await tx.creditor.findUnique({
        where: { id: payment.creditorId },
        include: {
          restocks: {
            select: { totalCost: true },
          },
          payments: {
            where: {
              paymentType: 'creditor',
              status: 'COMPLETED',
            },
            select: { amount: true },
          },
        },
      });

      if (!creditor) {
        throw new Error('Creditor not found');
      }

      const totalOwed = creditor.restocks.reduce((sum: number, r: any) => sum + Number(r.totalCost), 0);
      const totalPaid = creditor.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const newBalance = Math.max(0, totalOwed - totalPaid);

      // Update creditor's totalOwed
      updatedCreditor = await tx.creditor.update({
        where: { id: payment.creditorId },
        data: {
          totalOwed: newBalance,
        },
      });
    }, {
      timeout: 10000, // Increase timeout to 10 seconds
    });

    return NextResponse.json({
      success: true,
      message: 'Payment deleted successfully',
      payment: {
        id: deletedPayment.id,
        amount: Number(deletedPayment.amount),
      },
      creditor: {
        id: updatedCreditor.id,
        name: updatedCreditor.name,
        totalOwed: updatedCreditor.totalOwed,
      },
    });

  } catch (error: any) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete payment' },
      { status: 500 }
    );
  }
}

// ==================== PATCH - Update payment status ====================

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, isVerified, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    const paymentId = Number(id);
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Valid payment ID is required" },
        { status: 400 }
      );
    }

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (status) {
      const validStatuses = ['PENDING', 'COMPLETED', 'CLEARED', 'BOUNCED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid payment status' },
          { status: 400 }
        );
      }
      updateData.status = status;
      
      if (status === 'COMPLETED' || status === 'CLEARED') {
        updateData.isVerified = true;
        updateData.verifiedAt = new Date();
      }
    }

    if (isVerified !== undefined) {
      updateData.isVerified = isVerified;
      if (isVerified) {
        updateData.verifiedAt = new Date();
      } else {
        updateData.verifiedAt = null;
      }
    }

    if (notes !== undefined) {
      updateData.note = notes;
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment updated successfully',
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        isVerified: updatedPayment.isVerified,
        verifiedAt: updatedPayment.verifiedAt,
        notes: updatedPayment.note,
      },
    });

  } catch (error: any) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update payment' },
      { status: 500 }
    );
  }
}