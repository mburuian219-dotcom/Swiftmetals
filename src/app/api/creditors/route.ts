// src/app/api/creditors/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------- GET all creditors ----------------
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
          where: {
            paymentType: "creditor",
          },
          orderBy: {
            paidAt: "desc",
          },
        },
      },
    });

    // Transform data and calculate correct totals
    const transformedCreditors = creditors.map((creditor) => {
      // Calculate totals from restocks
      const totalOwedFromRestocks = creditor.restocks.reduce(
        (sum, restock) => sum + restock.totalCost, 
        0
      );
      
      // Calculate total paid from payments
      const totalPaid = (creditor.payments || []).reduce(
        (sum, payment) => sum + payment.amount, 
        0
      );
      
      // Calculate actual balance
      const actualBalance = totalOwedFromRestocks - totalPaid;
      
      return {
        ...creditor,
        // Use the calculated totalOwed, not the stored one
        totalOwed: Math.max(0, actualBalance),
        // Include the raw data for display
        _rawTotalOwed: totalOwedFromRestocks,
        _totalPaid: totalPaid,
        restocks: creditor.restocks.map((restock) => ({
          ...restock,
          createdBy: (restock as any).createdBy || 'System',
          createdByEmail: (restock as any).createdByEmail || 'system@swiftmetals.com',
          staffName: (restock as any).staffName || null,
          notes: (restock as any).notes || null,
          product: {
            id: restock.product.id,
            name: restock.product.name,
            price: restock.product.price,
            category: restock.product.category || 'Uncategorized',
          },
        })),
        payments: (creditor.payments || []).map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          paymentDate: payment.paymentDate || payment.paidAt,
          paymentMethod: payment.method,
          reference: payment.referenceId,
          notes: payment.note,
          recordedBy: payment.recordedBy || 'System',
          recordedByEmail: payment.recordedByEmail || 'system@swiftmetals.com',
        })),
      };
    });

    return NextResponse.json(transformedCreditors);
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
    const { 
      name, 
      phone, 
      email, 
      totalOwed,
    } = body;

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

    return NextResponse.json(creditor, { status: 201 });
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
    const { 
      id, 
      name, 
      phone, 
      email, 
      totalOwed,
    } = body;

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
    if (totalOwed !== undefined) updateData.totalOwed = Number(totalOwed);

    const creditor = await prisma.creditor.update({
      where: { id: creditorId },
      data: updateData,
    });

    return NextResponse.json(creditor);
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
    });

    if (!creditor) {
      return NextResponse.json(
        { error: "Creditor not found" },
        { status: 404 }
      );
    }

    // Delete all related restocks first
    await prisma.restock.deleteMany({
      where: { creditorId },
    });

    // Delete all related payments for this creditor
    await prisma.payment.deleteMany({
      where: { 
        creditorId,
        paymentType: "creditor",
      },
    });

    await prisma.creditor.delete({
      where: { id: creditorId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting creditor:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete creditor" },
      { status: 500 }
    );
  }
}