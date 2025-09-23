// /src/app/api/manual-messages/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const id = Number(params.id);
  const body = await request.json();
  const { action } = body; // expect { action: 'mark_sent' } or 'cancel'

  if (action === 'mark_sent') {
    const updated = await prisma.manualMessageTask.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (action === 'cancel') {
    const updated = await prisma.manualMessageTask.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
