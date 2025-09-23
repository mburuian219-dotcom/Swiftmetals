import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Handle GET, POST, PUT, DELETE in one file
export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
    });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expense = await prisma.expense.create({
      data: {
        title: body.title,
        amount: parseFloat(body.amount),
        category: body.category || null,
        notes: body.notes || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Expense ID required" }, { status: 400 });
    }
    const expense = await prisma.expense.update({
      where: { id: Number(body.id) },
      data: {
        title: body.title,
        amount: parseFloat(body.amount),
        category: body.category || null,
        notes: body.notes || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Expense ID required" }, { status: 400 });
    }
    await prisma.expense.delete({ where: { id: Number(body.id) } });
    return NextResponse.json({ message: "Expense deleted" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
