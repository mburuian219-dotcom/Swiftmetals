import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSMS } from "@/lib/sms";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if (cleaned.startsWith("+254") && cleaned.length === 13) return cleaned;
  return null;
}

// GET /api/receipt/[id] - HTML Receipt Generator
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to get the actual values
    const { id } = await params;
    const saleId = parseInt(id, 10);
    
    if (isNaN(saleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid sale ID" },
        { status: 400 }
      );
    }

    // Fetch sale with related data
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      );
    }

    const totalPaid = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const remaining = sale.amount - totalPaid;

    // Get the base URL from request headers (works automatically with Vercel)
    const host = req.headers.get('host') || '';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    
    // Prepare WhatsApp message
    const receiptUrl = `${baseUrl}/api/receipt/${sale.id}`;
    const whatsappMessage = `Hello ${sale.customer?.name || 'Customer'}! 👋

Thank you for your purchase at SwiftMetals!

Receipt #${String(sale.id).padStart(6, '0')}
Date: ${new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Total Amount: Ksh ${sale.amount.toFixed(2)}
Amount Paid: Ksh ${totalPaid.toFixed(2)}
Balance Due: Ksh ${remaining.toFixed(2)}

View your receipt: ${receiptUrl}

For any inquiries, contact us at support@swiftmetals.com`;

    // Format phone number for WhatsApp (remove spaces, dashes, and add country code if needed)
    const formatPhoneForWhatsApp = (phone: string) => {
      if (!phone) return '';
      // Remove all non-digit characters
      let cleaned = phone.replace(/\D/g, '');
      // Add Kenya country code if not present (254)
      if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
      } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
      }
      return cleaned;
    };

    const whatsappPhone = sale.customer?.phone ? formatPhoneForWhatsApp(sale.customer.phone) : '';

    // Generate HTML Receipt (Mobile Responsive)
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt #${String(sale.id).padStart(6, '0')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .company-name {
      font-size: 36px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 5px;
    }
    
    .company-tagline {
      font-size: 14px;
      color: #6b7280;
    }
    
    .receipt-title {
      font-size: 28px;
      color: #2563eb;
      text-align: center;
      margin: 20px 0;
      font-weight: bold;
    }
    
    .receipt-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
      flex-wrap: wrap;
      gap: 15px;
    }
    
    .info-item {
      flex: 1;
      min-width: 150px;
    }
    
    .info-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .info-value {
      font-size: 16px;
      color: #1f2937;
      font-weight: 600;
    }
    
    .section-title {
      font-size: 18px;
      color: #2563eb;
      margin: 25px 0 15px 0;
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .customer-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    
    .customer-name {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 10px;
    }
    
    .customer-detail {
      font-size: 14px;
      color: #6b7280;
      margin: 5px 0;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      overflow-x: auto;
      display: block;
    }
    
    .items-table thead {
      background: #2563eb;
      color: white;
    }
    
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }
    
    .items-table th.right {
      text-align: right;
    }
    
    .items-table th.center {
      text-align: center;
    }
    
    .items-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      color: #1f2937;
    }
    
    .items-table td.right {
      text-align: right;
    }
    
    .items-table td.center {
      text-align: center;
    }
    
    .payment-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      margin-bottom: 8px;
      background: #f9fafb;
      border-radius: 6px;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .payment-method {
      font-size: 14px;
      color: #1f2937;
    }
    
    .payment-amount {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }
    
    .payment-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 10px;
    }
    
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    
    .totals-box {
      width: 100%;
      max-width: 350px;
      margin: 20px 0 0 auto;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 20px;
      border-radius: 8px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 15px;
    }
    
    .total-label {
      color: #6b7280;
    }
    
    .total-value {
      font-weight: 600;
      color: #1f2937;
    }
    
    .total-row.paid .total-value {
      color: #10b981;
    }
    
    .total-row.divider {
      border-top: 2px solid #d1d5db;
      margin-top: 10px;
      padding-top: 15px;
    }
    
    .total-row.balance {
      font-size: 18px;
    }
    
    .total-row.balance .total-label {
      color: #1f2937;
      font-weight: 600;
    }
    
    .balance-positive {
      color: #ef4444 !important;
      font-weight: bold;
    }
    
    .balance-zero {
      color: #10b981 !important;
      font-weight: bold;
    }
    
    .footer {
      clear: both;
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
    }
    
    .footer-message {
      font-size: 16px;
      margin-bottom: 10px;
    }
    
    .footer-contact {
      font-size: 13px;
    }
    
    .no-payments {
      padding: 15px;
      background: #fef3c7;
      border-radius: 6px;
      color: #92400e;
      font-size: 14px;
      text-align: center;
    }
    
    .action-buttons {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 1000;
      flex-wrap: wrap;
    }
    
    .action-button {
      padding: 12px 24px;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .action-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .action-button.print {
      background: #2563eb;
    }
    
    .action-button.print:hover {
      background: #1d4ed8;
    }
    
    .action-button.whatsapp {
      background: #25D366;
    }
    
    .action-button.whatsapp:hover {
      background: #20BA5A;
    }
    
    .action-button.sms {
      background: #8b5cf6;
    }
    
    .action-button.sms:hover {
      background: #7c3aed;
    }
    
    .action-button.download {
      background: #dc2626;
    }
    
    .action-button.download:hover {
      background: #b91c1c;
    }
    
    .action-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }
    
    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .receipt-container {
        padding: 20px;
      }
      
      .company-name {
        font-size: 28px;
      }
      
      .receipt-title {
        font-size: 22px;
      }
      
      .action-buttons {
        position: static;
        margin-bottom: 20px;
        justify-content: center;
      }
      
      .action-button {
        padding: 10px 16px;
        font-size: 12px;
        flex: 1;
        min-width: 120px;
        justify-content: center;
      }
      
      .receipt-info {
        flex-direction: column;
      }
      
      .info-item {
        width: 100%;
      }
      
      .items-table {
        font-size: 12px;
      }
      
      .items-table th,
      .items-table td {
        padding: 8px 4px;
      }
      
      .totals-box {
        width: 100%;
        max-width: 100%;
      }
      
      .section-title {
        font-size: 16px;
      }
    }
    
    @media (max-width: 480px) {
      .company-name {
        font-size: 24px;
      }
      
      .receipt-title {
        font-size: 20px;
      }
      
      .action-button {
        padding: 8px 12px;
        font-size: 11px;
        min-width: 100px;
      }
      
      .items-table th,
      .items-table td {
        font-size: 11px;
        padding: 6px 2px;
      }
      
      .customer-box {
        padding: 15px;
      }
      
      .payment-item {
        padding: 8px 10px;
      }
      
      .totals-box {
        padding: 15px;
      }
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .receipt-container {
        box-shadow: none;
        padding: 20px;
      }
      
      .action-buttons {
        display: none;
      }
      
      @page {
        margin: 1cm;
      }
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script>
    function downloadPDF() {
      const element = document.querySelector('.receipt-container');
      const opt = {
        margin: 0.5,
        filename: 'Receipt_#${String(sale.id).padStart(6, '0')}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      const buttons = document.querySelector('.action-buttons');
      const originalDisplay = buttons.style.display;
      buttons.style.display = 'none';
      
      html2pdf().set(opt).from(element).save().then(() => {
        buttons.style.display = originalDisplay;
      });
    }
    
    async function sendReceiptSMS() {
      const button = event.target;
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '⏳ Sending...';
      
      try {
        const response = await fetch('/api/receipt/${sale.id}/sms', {
          method: 'POST',
        });
        
        const result = await response.json();
        
        if (response.ok) {
          button.innerHTML = '✅ SMS Sent!';
          setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
          }, 3000);
        } else {
          alert('Failed to send SMS: ' + (result.error || 'Unknown error'));
          button.innerHTML = originalText;
          button.disabled = false;
        }
      } catch (error) {
        alert('Error sending SMS: ' + error.message);
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
  </script>
</head>
<body>
  <div class="action-buttons">
    <button class="action-button print" onclick="window.print()">
      🖨️ Print
    </button>
    <button class="action-button download" onclick="downloadPDF()">
      📥 PDF
    </button>
    ${whatsappPhone ? `
    <a href="https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}" 
       class="action-button whatsapp" 
       target="_blank"
       rel="noopener noreferrer">
      📱 WhatsApp
    </a>
    ` : ''}
    ${sale.customer?.phone ? `
    <button class="action-button sms" onclick="sendReceiptSMS()">
      💬 SMS
    </button>
    ` : ''}
  </div>
  
  <div class="receipt-container">
    <!-- Header -->
    <div class="header">
      <div class="company-name">SwiftMetals</div>
      <div class="company-tagline">Your Trusted Metal Solutions Provider</div>
    </div>
    
    <!-- Receipt Title -->
    <div class="receipt-title">RECEIPT</div>
    
    <!-- Receipt Info -->
    <div class="receipt-info">
      <div class="info-item">
        <div class="info-label">Receipt Number</div>
        <div class="info-value">#${String(sale.id).padStart(6, '0')}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date</div>
        <div class="info-value">${new Date(sale.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</div>
      </div>
    </div>
    
    ${sale.customer ? `
    <!-- Customer Information -->
    <div class="section-title">Bill To</div>
    <div class="customer-box">
      <div class="customer-name">${sale.customer.name}</div>
      ${sale.customer.phone ? `<div class="customer-detail">📞 ${sale.customer.phone}</div>` : ''}
      ${sale.customer.email ? `<div class="customer-detail">📧 ${sale.customer.email}</div>` : ''}
    </div>
    ` : ''}
    
    <!-- Items -->
    <div class="section-title">Items</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Product</th>
          <th class="center">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${sale.saleitem.map(item => `
        <tr>
          <td>${item.product.name}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">Ksh ${item.price.toFixed(2)}</td>
          <td class="right">Ksh ${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <!-- Payments -->
    <div class="section-title">Payment Details</div>
    ${sale.payment.length > 0 ? sale.payment.map(p => `
    <div class="payment-item">
      <div>
        <span class="payment-method">${p.method}</span>
        <span class="payment-status ${p.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}">${p.status}</span>
      </div>
      <span class="payment-amount">Ksh ${p.amount.toFixed(2)}</span>
    </div>
    `).join('') : '<div class="no-payments">No payments recorded</div>'}
    
    <!-- Totals -->
    <div class="totals-box">
      <div class="total-row">
        <span class="total-label">Subtotal:</span>
        <span class="total-value">Ksh ${sale.amount.toFixed(2)}</span>
      </div>
      <div class="total-row paid">
        <span class="total-label">Paid:</span>
        <span class="total-value">Ksh ${totalPaid.toFixed(2)}</span>
      </div>
      <div class="total-row divider balance">
        <span class="total-label">Balance Due:</span>
        <span class="total-value ${remaining > 0 ? 'balance-positive' : 'balance-zero'}">Ksh ${remaining.toFixed(2)}</span>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">Thank you for your business!</div>
      <div class="footer-contact">For inquiries, contact us at support@swiftmetals.com</div>
    </div>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (err: any) {
    console.error("Receipt generation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate receipt" },
      { status: 500 }
    );
  }
}

// POST /api/receipt/[id]/sms - Send Receipt SMS
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const saleId = parseInt(id, 10);
    
    if (isNaN(saleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid sale ID" },
        { status: 400 }
      );
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        saleitem: { include: { product: true } },
        payment: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const phone = normalizePhone(sale.customer?.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const totalPaid = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const remaining = sale.amount - totalPaid;

    const host = req.headers.get('host') || '';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const receiptUrl = `${protocol}://${host}/api/receipt/${sale.id}`;

    // Format SMS message
    let msg = `Hey ${sale.customer.name},\n\n`;
    msg += `We value you as a trusted and loyal customer.\n\n`;
    msg += `Receipt #${String(sale.id).padStart(6, '0')}\n`;
    msg += `Total: KES ${sale.amount.toLocaleString()}\n`;
    msg += `Paid: KES ${totalPaid.toLocaleString()}\n`;
    
    if (remaining > 0) {
      msg += `Balance: KES ${remaining.toLocaleString()}\n\n`;
    } else {
      msg += `Status: PAID IN FULL ✓\n\n`;
    }
    
    msg += `View receipt: ${receiptUrl}\n\n`;
    msg += `Thank you for choosing SWIFT Metals!`;

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
        context: "Receipt SMS",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Receipt SMS sent to ${sale.customer.name}`,
      response,
    });
  } catch (err: any) {
    console.error("SMS sending error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send SMS" },
      { status: 500 }
    );
  }
}