import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ✅ GET: Fetch all customers or one by ID
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const customer = await prisma.customer.findUnique({
        where: { id: parseInt(id) },
      });
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      return NextResponse.json(customer);
    }

    const customers = await prisma.customer.findMany({
      orderBy: { id: "desc" },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customer error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// ✅ POST: Create a new customer
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone } = body;

    // Only name is required, email and phone are optional
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Build data object with only provided fields
    const data: any = { name: name.trim() };
    if (email && email.trim()) data.email = email.trim();
    if (phone && phone.trim()) data.phone = phone.trim();

    const newCustomer = await prisma.customer.create({
      data,
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error("POST /api/customer error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}

// ✅ PUT: Update existing customer
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email, phone } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Build update data with only provided fields
    const data: any = { name: name.trim() };
    if (email !== undefined) data.email = email.trim() || null;
    if (phone !== undefined) data.phone = phone.trim() || null;

    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data,
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error("PUT /api/customer error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

// ✅ DELETE: Delete a customer by ID
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing customer ID" }, { status: 400 });
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/customer error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}