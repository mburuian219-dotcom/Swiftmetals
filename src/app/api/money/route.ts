// app/api/money/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Fetch all cash ledger entries with linked references
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // INFLOW or OUTFLOW
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = searchParams.get("limit") || "100";

    const filters: any = {};

    if (type && ["INFLOW", "OUTFLOW"].includes(type)) {
      filters.type = type;
    }

    if (category) {
      filters.category = category;
    }

    if (from || to) {
      filters.date = {};
      if (from) filters.date.gte = new Date(from);
      if (to) filters.date.lte = new Date(to);
    }

    // Fetch entries with related models
    const entries = await prisma.cashledger.findMany({
      where: filters,
      include: {
        restock: {
          include: { 
            product: true 
          },
        },
        sale: {
          include: { 
            saleitem: true 
          },
        },
        expense: true,
      },
      orderBy: { date: "desc" },
      take: parseInt(limit),
    });

    // Calculate current balance (last entry's running balance)
    const currentBalance = entries.length > 0 ? (entries[0].runningBalance || 0) : 0;

    // Get total inflows and outflows for summary
    const summary = await prisma.cashledger.aggregate({
      where: filters,
      _sum: {
        amount: true,
      },
    });

    // Count by type
    const typeBreakdown = await prisma.cashledger.groupBy({
      by: ["type"],
      where: filters,
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      entries,
      currentBalance,
      summary: {
        totalAmount: summary._sum.amount || 0,
        breakdown: typeBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching cash ledger:", error);
    return NextResponse.json(
      { error: "Failed to fetch ledger entries" },
      { status: 500 }
    );
  }
}

// POST: Add a new ledger entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      description,
      type,
      category,
      amount,
      relatedTo,
      affectedAccounts,
      referenceId,
      referenceType,
    } = body;

    // Validation
    if (!description || !type || !category || amount === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: description, type, category, amount",
        },
        { status: 400 }
      );
    }

    if (!["INFLOW", "OUTFLOW"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be INFLOW or OUTFLOW" },
        { status: 400 }
      );
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue < 0) {
      return NextResponse.json(
        { error: "Amount must be a valid positive number" },
        { status: 400 }
      );
    }

    // Get last entry to calculate running balance
    const lastEntry = await prisma.cashledger.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const previousBalance = lastEntry?.runningBalance || 0;
    const newBalance = type === "INFLOW"
      ? previousBalance + amountValue
      : previousBalance - amountValue;

    // Create new entry
    const newEntry = await prisma.cashledger.create({
      data: {
        description,
        type,
        category,
        amount: amountValue,
        runningBalance: newBalance,
        relatedTo: relatedTo || null,
        affectedAccounts: affectedAccounts || null,
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        date: new Date(), // Ensure date is set
      },
    });

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error("Error creating cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to create ledger entry" },
      { status: 500 }
    );
  }
}

// PUT: Update a ledger entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, description, category, amount, relatedTo, affectedAccounts } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Get the entry to be updated
    const existingEntry = await prisma.cashledger.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    // Calculate new balance if amount changed
    let newRunningBalance = existingEntry.runningBalance || 0;

    if (amount !== undefined && amount !== existingEntry.amount) {
      const amountValue = parseFloat(amount);
      const difference = amountValue - existingEntry.amount;
      newRunningBalance = (existingEntry.runningBalance || 0) + difference;
    }

    // Update entry
    const updatedEntry = await prisma.cashledger.update({
      where: { id },
      data: {
        description: description || existingEntry.description,
        category: category || existingEntry.category,
        amount: amount ? parseFloat(amount) : existingEntry.amount,
        runningBalance: newRunningBalance,
        relatedTo: relatedTo !== undefined ? relatedTo : existingEntry.relatedTo,
        affectedAccounts: affectedAccounts !== undefined ? affectedAccounts : existingEntry.affectedAccounts,
      },
    });

    // If amount changed, recalculate all subsequent entries
    if (amount !== undefined && amount !== existingEntry.amount) {
      const subsequentEntries = await prisma.cashledger.findMany({
        where: {
          createdAt: {
            gt: existingEntry.createdAt,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      let currentBalance = newRunningBalance;
      for (const entry of subsequentEntries) {
        if (entry.type === "INFLOW") {
          currentBalance += entry.amount;
        } else if (entry.type === "OUTFLOW") {
          currentBalance -= entry.amount;
        }

        await prisma.cashledger.update({
          where: { id: entry.id },
          data: { runningBalance: currentBalance },
        });
      }
    }

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error updating cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to update ledger entry" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a ledger entry and recalculate balances
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Get the entry to be deleted
    const entryToDelete = await prisma.cashledger.findUnique({
      where: { id },
    });

    if (!entryToDelete) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    // Delete the entry
    await prisma.cashledger.delete({
      where: { id },
    });

    // Get all entries after the deleted one and recalculate running balances
    const subsequentEntries = await prisma.cashledger.findMany({
      where: {
        createdAt: {
          gt: entryToDelete.createdAt,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Get the last balance before the deleted entry
    const previousEntry = await prisma.cashledger.findFirst({
      where: {
        createdAt: {
          lt: entryToDelete.createdAt,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let currentBalance = previousEntry?.runningBalance || 0;

    // Recalculate balances for all subsequent entries
    for (const entry of subsequentEntries) {
      if (entry.type === "INFLOW") {
        currentBalance += entry.amount;
      } else if (entry.type === "OUTFLOW") {
        currentBalance -= entry.amount;
      }

      await prisma.cashledger.update({
        where: { id: entry.id },
        data: { runningBalance: currentBalance },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Entry deleted and running balances recalculated",
    });
  } catch (error) {
    console.error("Error deleting cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to delete ledger entry" },
      { status: 500 }
    );
  }
}

// PATCH: Update specific fields of a ledger entry
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Get the existing entry
    const existingEntry = await prisma.cashledger.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    // Only allow updating specific fields that don't affect balances
    const allowedFields = ['description', 'category', 'relatedTo', 'affectedAccounts'];
    const updateFields: any = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    // Update the entry
    const updatedEntry = await prisma.cashledger.update({
      where: { id },
      data: updateFields,
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error patching cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to update ledger entry" },
      { status: 500 }
    );
  }
}