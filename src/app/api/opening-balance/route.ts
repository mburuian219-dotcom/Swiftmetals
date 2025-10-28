import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET - Fetch the most recent opening balance
export async function GET() {
  try {
    const openingBalance = await prisma.openingbalance.findFirst({
      orderBy: { date: "desc" },
    });

    if (!openingBalance) {
      return NextResponse.json(
        { amount: 0, message: "No opening balance found" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      id: openingBalance.id,
      amount: openingBalance.amount,
      date: openingBalance.date,
      description: openingBalance.description,
      recordedBy: openingBalance.recordedBy,
    });
  } catch (error) {
    console.error("GET /api/opening-balance error:", error);
    return NextResponse.json(
      { error: "Failed to fetch opening balance" },
      { status: 500 }
    );
  }
}

// POST - Create or update opening balance
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, description, recordedBy } = body;

    if (typeof amount !== "number" || amount < 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Create new opening balance record
    const newOpeningBalance = await prisma.openingbalance.create({
      data: {
        amount,
        description: description || "Opening Balance - Business Capital",
        recordedBy: recordedBy || "System",
        date: new Date(),
      },
    });

    return NextResponse.json({
      message: "Opening balance updated successfully",
      data: newOpeningBalance,
    });
  } catch (error) {
    console.error("POST /api/opening-balance error:", error);
    return NextResponse.json(
      { error: "Failed to update opening balance" },
      { status: 500 }
    );
  }
}