// /src/app/api/manual-messages/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const tasks = await prisma.manualMessageTask.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 200, // limit for safety
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  // optional: let admin create a manual task manually via API
  const body = await req.json();
  const { customerId, phone, message, failureReason } = body;
  const task = await prisma.manualMessageTask.create({
    data: { customerId, phone, message, failureReason },
  });
  return NextResponse.json(task);
}
