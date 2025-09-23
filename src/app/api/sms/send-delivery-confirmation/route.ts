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
      include: { customer: true, saleItems: { include: { product: true } } },
    });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    const phone = normalizePhone(sale.customer?.phone);
    if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

    const productList =
      sale.saleItems.length > 0
        ? sale.saleItems.map((item) => `${item.product.name} (x${item.quantity})`).join(", ")
        : "your order";

    const msg = `Dear ${sale.customer.name}, your order of ${productList} worth KES ${sale.amount.toFixed(
      2
    )} has been successfully delivered. Thank you for choosing SWIFT Metals.`;

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
