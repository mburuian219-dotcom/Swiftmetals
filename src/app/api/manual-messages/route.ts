// /src/app/api/manual-messages/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const tasks = await prisma.manualmessagetask.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'desc' },
    take: 200, // limit for safety
  });
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { customerId, phone, message, failureReason } = body;

  if (!customerId && !phone) {
    return NextResponse.json(
      { error: 'Either customerId or phone must be provided' },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const task = await prisma.manualmessagetask.create({
    data: { customerId: customerId || null, phone: phone || null, message, failureReason: failureReason || null },
  });

  return NextResponse.json(task, { status: 201 });
}
