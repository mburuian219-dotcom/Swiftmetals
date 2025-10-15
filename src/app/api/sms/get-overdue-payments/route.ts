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
        payment: true,
        paymentschedule: true,
        saleitem: true,
        smsreminder: true,
        invoice: true,
      },
    });

    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    const phone = normalizePhone(sale.customer?.phone);
    if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

    const amountPaid = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const remaining = sale.amount - amountPaid;

    // Format the due date
    const dueDateStr = sale.dueDate 
      ? new Date(sale.dueDate).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        })
      : null;

    // Build the personalized message
    let msg = `Hey ${sale.customer.name},\n\n`;
    msg += `We value you as a trusted and loyal customer.\n\n`;
    
    if (remaining > 0) {
      // Overdue/Outstanding balance message
      msg += `Your total purchase: KES ${sale.amount.toLocaleString()}\n`;
      msg += `Outstanding balance: KES ${remaining.toLocaleString()}\n\n`;
      
      if (dueDateStr) {
        msg += `To be cleared by: ${dueDateStr}\n\n`;
      }
      
      msg += `Kindly clear at your earliest convenience.\n\n`;
    } else {
      // Fully paid message
      msg += `Thank you for clearing your balance of KES ${sale.amount.toLocaleString()}.\n\n`;
    }
    
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
        context: "Payment reminder",
      });
    }

    return NextResponse.json({
      message: `Payment reminder sent to ${sale.customer.name}`,
      response,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to send reminder" }, { status: 500 });
  }
}