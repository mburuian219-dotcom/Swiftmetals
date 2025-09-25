import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ===================== GET =====================
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: { sale: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(customers);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// ===================== POST =====================
export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const newCustomer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        totalCredit: data.totalCredit ?? 0,
      },
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}

// ===================== PUT =====================
export async function PUT(req: Request) {
  try {
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: Number(data.id) },
      data: {
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        totalCredit: data.totalCredit ?? undefined,
      },
    });

    return NextResponse.json(updatedCustomer);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

// ===================== DELETE =====================
export async function DELETE(req: Request) {
  try {
    // Get ID from query parameter
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    await prisma.customer.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
