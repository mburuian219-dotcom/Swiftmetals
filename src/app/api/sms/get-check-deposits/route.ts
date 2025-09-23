import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms";

async function notifyCheckDeposits(saleIds?: number[]) {
  const whereClause = {
    isCheckDeposited: true,
    status: { not: "PAID" },
    ...(saleIds ? { id: { in: saleIds } } : {}),
  };

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: { customer: true },
  });

  let success = 0;
  let failed = 0;
  const failedRecipients: any[] = [];

  for (const sale of sales) {
    if (sale.customer?.phone) {
      const msg = `Dear ${sale.customer.name}, your cheque deposit for ${sale.amount} is going to be deposited. Please ensure clearance before due date.`;

      try {
        const response = await sendSMS(sale.customer.phone, msg);

        const failedRecipient = response?.failedRecipients?.find(
          (r: any) => r.error?.includes("UserInBlacklist")
        );

        if (failedRecipient) {
          failed++;
          failedRecipients.push({
            phone: sale.customer.phone,
            customer: sale.customer.name,
            error: "User is in blacklist",
          });
        } else {
          success++;
        }
      } catch (err) {
        failed++;
        failedRecipients.push({
          phone: sale.customer.phone,
          customer: sale.customer.name,
          error: "Send failed",
        });
      }
    }
  }

  return { summary: { success, failed }, failedRecipients };
}

// GET
export async function GET() {
  try {
    const result = await notifyCheckDeposits();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Failed to send check deposit SMS" }, { status: 500 });
  }
}

// POST
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const saleIds: number[] = body.saleIds || (body.saleId ? [body.saleId] : []);
    const result = await notifyCheckDeposits(saleIds.length ? saleIds : undefined);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Failed to send check deposit SMS" }, { status: 500 });
  }
}
