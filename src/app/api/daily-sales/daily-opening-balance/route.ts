// app/api/daily-opening-balance/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Fetch all daily opening balances
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");

    const filters: any = {};

    if (date) {
      // FIX: Proper date handling with timezone consideration
      const targetDate = new Date(date + 'T00:00:00.000Z'); // Treat as UTC
      
      filters.date = {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const balances = await prisma.dailyopeningbalance.findMany({
      where: filters,
      orderBy: { date: "desc" },
      take: 100,
    });

    // Transform to match frontend expectations
    const transformed = balances.map(balance => ({
      id: balance.id,
      date: balance.date.toISOString().split('T')[0],
      openingBalance: balance.amount,
      description: balance.description,
      recordedBy: balance.recordedBy,
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("Error fetching opening balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening balances" },
      { status: 500 }
    );
  }
}

// POST: Create or update daily opening balance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, openingBalance, description, recordedBy } = body;

    console.log("Received opening balance request:", { date, openingBalance });

    // Validation
    if (!date || openingBalance === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: date, openingBalance" },
        { status: 400 }
      );
    }

    if (isNaN(parseFloat(openingBalance))) {
      return NextResponse.json(
        { error: "Opening balance must be a valid number" },
        { status: 400 }
      );
    }

    // FIX: Proper date parsing - treat the date string as UTC to avoid timezone issues
    const targetDate = new Date(date + 'T00:00:00.000Z');
    
    // Validate the date
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    console.log("Parsed target date:", targetDate.toISOString());

    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    // Check if opening balance already exists for this date
    const existing = await prisma.dailyopeningbalance.findFirst({
      where: {
        date: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    let balance;

    if (existing) {
      console.log("Updating existing balance for date:", targetDate.toISOString());
      // Update existing balance
      balance = await prisma.dailyopeningbalance.update({
        where: { id: existing.id },
        data: {
          amount: parseFloat(openingBalance),
          description: description || existing.description,
          recordedBy: recordedBy || existing.recordedBy,
        },
      });
    } else {
      console.log("Creating new balance for date:", targetDate.toISOString());
      // Create new balance
      balance = await prisma.dailyopeningbalance.create({
        data: {
          date: targetDate,
          amount: parseFloat(openingBalance),
          description: description || `Opening balance for ${targetDate.toISOString().split('T')[0]}`,
          recordedBy: recordedBy || null,
        },
      });

      // Create a cash ledger entry for this opening balance
      await prisma.cashledger.create({
        data: {
          description: `Opening Balance - ${targetDate.toISOString().split('T')[0]}`,
          type: "CASH_IN",
          category: "Opening Balance",
          amount: parseFloat(openingBalance),
          runningBalance: parseFloat(openingBalance),
          referenceType: "opening_balance",
          dailyOpeningBalanceId: balance.id,
          date: targetDate,
        },
      });
    }

    // Transform response
    const transformed = {
      id: balance.id,
      date: balance.date.toISOString().split('T')[0],
      openingBalance: balance.amount,
      description: balance.description,
      recordedBy: balance.recordedBy,
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    };

    console.log("Successfully processed balance:", transformed);

    return NextResponse.json(transformed, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Error setting opening balance:", error);
    return NextResponse.json(
      { error: "Failed to set opening balance" },
      { status: 500 }
    );
  }
}

// PUT: Update a specific opening balance
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, openingBalance, description, recordedBy } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Balance ID is required" },
        { status: 400 }
      );
    }

    const balance = await prisma.dailyopeningbalance.update({
      where: { id },
      data: {
        amount: openingBalance !== undefined ? parseFloat(openingBalance) : undefined,
        description: description !== undefined ? description : undefined,
        recordedBy: recordedBy !== undefined ? recordedBy : undefined,
      },
    });

    const transformed = {
      id: balance.id,
      date: balance.date.toISOString().split('T')[0],
      openingBalance: balance.amount,
      description: balance.description,
      recordedBy: balance.recordedBy,
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    };

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("Error updating opening balance:", error);
    return NextResponse.json(
      { error: "Failed to update opening balance" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an opening balance
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Balance ID is required" },
        { status: 400 }
      );
    }

    // Delete associated cash ledger entries
    await prisma.cashledger.deleteMany({
      where: { dailyOpeningBalanceId: id },
    });

    // Delete the balance
    await prisma.dailyopeningbalance.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Opening balance deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting opening balance:", error);
    return NextResponse.json(
      { error: "Failed to delete opening balance" },
      { status: 500 }
    );
  }
}