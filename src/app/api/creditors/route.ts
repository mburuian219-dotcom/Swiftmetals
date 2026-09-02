import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all creditors with payments ----------------
export async function GET() {
  try {
    const creditors = await prisma.creditor.findMany({
      orderBy: {
        name: "asc",
      },
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
          orderBy: {
            createdAt: "desc",
          },
        },
        payments: {
          orderBy: {
            paymentDate: "desc",
          },
        },
        // Fetch creditorPaymentDetails directly from creditor
        creditorPaymentDetails: {
          orderBy: {
            createdAt: "desc",
          },
        },
        creditorPaymentTemplates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // Calculate additional fields for each creditor
    const creditorsWithCalculations = creditors.map(creditor => {
      // Calculate total owed from restocks
      const calculatedTotalOwed = creditor.restocks.reduce((sum, r) => sum + r.totalCost, 0);
      
      // Calculate total paid from payments
      const calculatedTotalPaid = (creditor.payments || []).reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate balance
      const calculatedBalance = calculatedTotalOwed - calculatedTotalPaid;
      
      // Calculate payment percentage
      const calculatedPaymentPercentage = calculatedTotalOwed > 0 ? Math.round((calculatedTotalPaid / calculatedTotalOwed) * 100) : 0;

      return {
        ...creditor,
        totalOwed: calculatedTotalOwed,
        totalPaid: calculatedTotalPaid,
        balance: calculatedBalance,
        paymentPercentage: calculatedPaymentPercentage,
        restocks: creditor.restocks.map(r => ({
          ...r,
          totalCost: r.totalCost,
        })),
        payments: creditor.payments || [],
        creditorPaymentDetails: creditor.creditorPaymentDetails || [],
        creditorPaymentTemplates: creditor.creditorPaymentTemplates || [],
      };
    });

    return NextResponse.json(creditorsWithCalculations);
  } catch (error) {
    console.error("Error fetching creditors:", error);
    return NextResponse.json(
      { error: "Failed to fetch creditors" },
      { status: 500 }
    );
  }
}

// ---------------- POST - Create new creditor ----------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, totalOwed, createdBy, createdByEmail } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Creditor name is required" },
        { status: 400 }
      );
    }

    // Check if creditor already exists
    const existing = await prisma.creditor.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A creditor with this name already exists" },
        { status: 400 }
      );
    }

    const creditor = await prisma.creditor.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        totalOwed: totalOwed ? Number(totalOwed) : 0,
      },
    });

    // Log creation in cashledger
    await prisma.cashledger.create({
      data: {
        date: new Date(),
        description: `New creditor created: ${creditor.name}`,
        type: "INFO",
        category: "CREDITOR",
        amount: 0,
        relatedTo: `Creditor: ${creditor.name}`,
        affectedAccounts: "Creditor Account Created",
        referenceId: creditor.id,
        referenceType: "CREDITOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...creditor,
      totalPaid: 0,
      balance: 0,
      paymentPercentage: 0,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating creditor:", error);
    return NextResponse.json(
      { error: "Failed to create creditor" },
      { status: 500 }
    );
  }
}

// ---------------- PUT - Update creditor ----------------
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, phone, email, totalOwed: bodyTotalOwed, updatedBy } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Creditor ID is required" },
        { status: 400 }
      );
    }

    const creditorId = Number(id);
    if (isNaN(creditorId)) {
      return NextResponse.json(
        { error: "Valid creditor ID is required" },
        { status: 400 }
      );
    }

    // Check if creditor exists
    const existing = await prisma.creditor.findUnique({
      where: { id: creditorId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Creditor not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Creditor name cannot be empty" },
          { status: 400 }
        );
      }
      // Check for duplicate name (excluding current creditor)
      const duplicate = await prisma.creditor.findFirst({
        where: {
          name: trimmedName,
          id: { not: creditorId },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A creditor with this name already exists" },
          { status: 400 }
        );
      }
      updateData.name = trimmedName;
    }
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (bodyTotalOwed !== undefined) updateData.totalOwed = Number(bodyTotalOwed);

    const updatedCreditor = await prisma.creditor.update({
      where: { id: creditorId },
      data: updateData,
      include: {
        payments: true,
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
        },
        creditorPaymentDetails: true,
        creditorPaymentTemplates: true,
      },
    });

    // Calculate totals
    const calculatedTotalOwed = updatedCreditor.restocks.reduce((sum, r) => sum + r.totalCost, 0);
    const calculatedTotalPaid = (updatedCreditor.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const calculatedBalance = calculatedTotalOwed - calculatedTotalPaid;
    const calculatedPaymentPercentage = calculatedTotalOwed > 0 ? Math.round((calculatedTotalPaid / calculatedTotalOwed) * 100) : 0;

    // Log update in cashledger
    await prisma.cashledger.create({
      data: {
        date: new Date(),
        description: `Creditor updated: ${updatedCreditor.name}`,
        type: "INFO",
        category: "CREDITOR",
        amount: 0,
        relatedTo: `Creditor: ${updatedCreditor.name}`,
        affectedAccounts: "Creditor Account Updated",
        referenceId: updatedCreditor.id,
        referenceType: "CREDITOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updatedCreditor,
      totalOwed: calculatedTotalOwed,
      totalPaid: calculatedTotalPaid,
      balance: calculatedBalance,
      paymentPercentage: calculatedPaymentPercentage,
    });
  } catch (error) {
    console.error("Error updating creditor:", error);
    return NextResponse.json(
      { error: "Failed to update creditor" },
      { status: 500 }
    );
  }
}

// ---------------- DELETE - Delete creditor ----------------
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Creditor ID is required" },
        { status: 400 }
      );
    }

    const creditorId = Number(id);
    if (isNaN(creditorId)) {
      return NextResponse.json(
        { error: "Valid creditor ID is required" },
        { status: 400 }
      );
    }

    // Check if creditor exists
    const creditor = await prisma.creditor.findUnique({
      where: { id: creditorId },
      include: {
        restocks: true,
        payments: true,
        creditorPaymentDetails: true,
        creditorPaymentTemplates: true,
      },
    });

    if (!creditor) {
      return NextResponse.json(
        { error: "Creditor not found" },
        { status: 404 }
      );
    }

    // Log deletion in cashledger before deleting
    await prisma.cashledger.create({
      data: {
        date: new Date(),
        description: `Creditor deleted: ${creditor.name}`,
        type: "INFO",
        category: "CREDITOR",
        amount: 0,
        relatedTo: `Creditor: ${creditor.name}`,
        affectedAccounts: "Creditor Account Deleted",
        referenceId: creditor.id,
        referenceType: "CREDITOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Delete all related records
    // 1. Delete creditor payment templates
    if (creditor.creditorPaymentTemplates.length > 0) {
      await prisma.creditorPaymentTemplate.deleteMany({
        where: { creditorId },
      });
    }

    // 2. Delete creditor payment details
    if (creditor.creditorPaymentDetails.length > 0) {
      await prisma.creditorPaymentDetail.deleteMany({
        where: { creditorId },
      });
    }

    // 3. Delete payments
    if (creditor.payments.length > 0) {
      await prisma.payment.deleteMany({
        where: { creditorId },
      });
    }

    // 4. Delete restocks
    if (creditor.restocks.length > 0) {
      await prisma.restock.deleteMany({
        where: { creditorId },
      });
    }

    // 5. Finally delete the creditor
    await prisma.creditor.delete({
      where: { id: creditorId },
    });

    return NextResponse.json({ 
      success: true,
      message: `Creditor "${creditor.name}" deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting creditor:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete creditor" },
      { status: 500 }
    );
  }
}