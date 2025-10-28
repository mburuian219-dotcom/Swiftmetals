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
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
    return NextResponse.json(creditors);
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
    const { name, phone, email, totalOwed } = body;

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
    const { id, name, phone, email, totalOwed } = body;

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

    // Delete all related restocks first, then delete the creditor
    await prisma.restock.deleteMany({
      where: { creditorId },
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