// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/sms";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if (cleaned.startsWith("+254") && cleaned.length === 13) return cleaned;
  return null;
}

export async function POST(req: Request) {
  try {
    const { saleId } = await req.json();
    if (!saleId) return NextResponse.json({ error: "Sale ID required" }, { status: 400 });

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        saleitem: {
          include: { product: true },
        },
      },
    });

    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    const phone = normalizePhone(sale.customer?.phone);
    if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

    const productList =
      sale.saleitem.length > 0
        ? sale.saleitem.map((item) => `${item.product.name} (x${item.quantity})`).join(", ")
        : "your order";

    // Build the personalized delivery confirmation message
    let msg = `Hey ${sale.customer.name},\n\n`;
    msg += `We value you as a trusted and loyal customer.\n\n`;
    msg += `Your order has been successfully delivered!\n\n`;
    msg += `Items: ${productList}\n`;
    msg += `Total: KES ${sale.amount.toLocaleString()}\n\n`;
    msg += `Thank you for choosing SWIFT Metals. We look forward to serving you again.\n\n`;
    msg += `- SWIFT Metals`;

    const response = await sendSMS(phone, msg);

    const failedRecipient = response?.failedRecipients?.find(
      (r: any) => r.error?.includes("UserInBlacklist")
    );

    if (failedRecipient) {
      return NextResponse.json({
        blacklist: true,
        error: "User is in blacklist",
        customer: sale.customer.name,
        phone,
        context: `Delivery confirmation for ${productList}`,
      });
    }

    // Update the sale status to DELIVERED
    await prisma.sale.update({
      where: { id: sale.id },
      data: { status: "DELIVERED", updatedAt: new Date() },
    });

    return NextResponse.json({
      message: `Delivery confirmation sent to ${sale.customer.name}`,
      response,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send delivery confirmation" },
      { status: 500 }
    );
  }
}