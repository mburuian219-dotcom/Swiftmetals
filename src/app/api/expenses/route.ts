import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ✅ GET all expenses
export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ success: true, expenses });
  } catch (error) {
    console.error("❌ Error fetching expenses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// ✅ POST (create new expense)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.title || !body.amount) {
      return NextResponse.json(
        { success: false, error: "Title and amount are required" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        title: body.title,
        amount: parseFloat(body.amount),
        category: body.category || null,
        notes: body.notes || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error("❌ Error creating expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create expense" },
      { status: 500 }
    );
  }
}

// ✅ PUT (update existing expense)
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Expense ID required" },
        { status: 400 }
      );
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: Number(body.id) },
      data: {
        title: body.title,
        amount: parseFloat(body.amount),
        category: body.category || null,
        notes: body.notes || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json({ success: true, expense: updatedExpense });
  } catch (error) {
    console.error("❌ Error updating expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

// ✅ DELETE (delete expense by ID)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id"); // DELETE now uses query param instead of JSON body

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Expense ID required" },
        { status: 400 }
      );
    }

    // Check if it exists first
    const existing = await prisma.expense.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    await prisma.expense.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("❌ Error deleting expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
