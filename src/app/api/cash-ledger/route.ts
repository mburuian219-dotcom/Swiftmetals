// app/api/cash-ledger/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Fetch all cash ledger entries
export async function GET(request: NextRequest) {
  try {
    const entries = await prisma.cashledger.findMany({
      orderBy: { date: "desc" },
      include: {
        sale: true,
        expense: true,
        restock: true,
        dailyOpeningBalance: true,
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching cash ledger:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash ledger entries" },
      { status: 500 }
    );
  }
}

// POST: Create a new cash ledger entry (manual transaction)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      description, 
      type, 
      category, 
      amount, 
      referenceType,
      date,
      relatedTo,
      affectedAccounts,
      referenceId,
      email,
      token
    } = body;

    // Validation
    if (!description || !type || !category || amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: description, type, category, amount" },
        { status: 400 }
      );
    }

    if (isNaN(parseFloat(amount))) {
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 }
      );
    }

    // Validate type - accept both formats
    const validTypes = ["CASH_IN", "CASH_OUT", "INFLOW", "OUTFLOW"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Type must be one of: CASH_IN, CASH_OUT, INFLOW, OUTFLOW" },
        { status: 400 }
      );
    }

    // Get the latest entry to calculate running balance
    const latestEntry = await prisma.cashledger.findFirst({
      orderBy: { date: "desc" },
      select: { runningBalance: true },
    });

    const previousBalance = latestEntry?.runningBalance || 0;
    const parsedAmount = parseFloat(amount);
    
    // Calculate new running balance
    let newRunningBalance = previousBalance;
    if (type === "CASH_IN" || type === "INFLOW") {
      newRunningBalance += parsedAmount;
    } else {
      newRunningBalance -= parsedAmount;
    }

    // Create the entry
    const entry = await prisma.cashledger.create({
      data: {
        description,
        type,
        category,
        amount: parsedAmount,
        runningBalance: newRunningBalance,
        referenceType: referenceType || "manual",
        date: date ? new Date(date) : new Date(),
        relatedTo: relatedTo || null,
        affectedAccounts: affectedAccounts || null,
        referenceId: referenceId || null,
        email: email || null,
        token: token || null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to create cash ledger entry" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing cash ledger entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, description, type, category, amount } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Entry ID is required" },
        { status: 400 }
      );
    }

    // Get the entry to update
    const existingEntry = await prisma.cashledger.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = parseFloat(amount);

    // If amount or type changed, recalculate running balance
    if (amount !== undefined || type !== undefined) {
      // Get all entries after this one to recalculate
      const entriesToRecalculate = await prisma.cashledger.findMany({
        where: {
          date: {
            gte: existingEntry.date,
          },
        },
        orderBy: { date: "asc" },
      });

      // This would need a more complex implementation to properly recalculate
      // For now, we'll just update the entry
      console.warn("Running balance recalculation needed after update");
    }

    const entry = await prisma.cashledger.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error updating cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to update cash ledger entry" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a cash ledger entry
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

    await prisma.cashledger.delete({
      where: { id },
    });

    // Note: In a production system, you should recalculate running balances
    // for all entries after the deleted one

    return NextResponse.json({
      success: true,
      message: "Cash ledger entry deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting cash ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to delete cash ledger entry" },
      { status: 500 }
    );
  }
}