import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms";

export async function GET() {
  try {
    const overdueSales = await prisma.sale.findMany({
      where: {
        status: { not: "PAID" },
        dueDate: { lt: new Date() },
      },
      include: { customer: true },
    });

    for (const sale of overdueSales) {
      if (sale.customer?.phone) {
        const msg = `Dear ${sale.customer.name}, your payment of ${sale.amount} was due on ${sale.dueDate?.toLocaleDateString()}. Please clear it.`;
        await sendSMS(sale.customer.phone, msg);
      }
    }

    return NextResponse.json({
      message: `Overdue reminders sent to ${overdueSales.length} customers`,
    });
  } catch (err) {
    console.error("❌ Overdue payments error:", err);
    return NextResponse.json({ error: "Failed to send overdue reminders" }, { status: 500 });
  }
}
