// src/app/api/customer-receipt/[customerId]/route.ts
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

// Escape HTML to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// GET /api/customer-receipt/[customerId] - Consolidated Receipt for Customer
export async function GET(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const customerIdNum = parseInt(customerId, 10);
    
    if (isNaN(customerIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    // Fetch customer with ALL sales and related data
    const customer = await prisma.customer.findUnique({
      where: { id: customerIdNum },
      include: {
        sale: {
          include: {
            saleitem: { 
              include: { product: true },
              orderBy: { id: 'asc' }
            },
            payment: {
              orderBy: { paidAt: 'asc' }
            },
            assignedStaff: {
              select: { name: true }
            },
            createdByStaff: {
              select: { name: true }
            }
          },
          orderBy: { 
            date: 'desc' // Most recent sales first
          }
        }
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // Calculate totals across all sales
    let totalAllPurchases = 0;
    let totalAllPayments = 0;
    let totalAllBalance = 0;
    
    const salesWithDetails = customer.sale.map((sale: any) => {
      const saleTotal = sale.amount;
      const salePayments = sale.payment.reduce((sum: number, p: any) => sum + p.amount, 0);
      const saleBalance = saleTotal - salePayments;
      
      totalAllPurchases += saleTotal;
      totalAllPayments += salePayments;
      totalAllBalance += saleBalance;
      
      return {
        ...sale,
        saleTotal,
        salePayments,
        saleBalance,
        saleStatus: saleBalance > 0 ? 'UNPAID' : 'PAID'
      };
    });

    // Get the base URL
    const host = req.headers.get('host') || '';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    
    // Prepare WhatsApp message
    const receiptUrl = `${baseUrl}/api/customer-receipt/${customer.id}`;
    const whatsappMessage = `Hello ${escapeHtml(customer.name)}! 👋

*ACCOUNT STATEMENT*

Account Summary:
📊 Total Purchases: Ksh ${totalAllPurchases.toFixed(2)}
💰 Total Payments: Ksh ${totalAllPayments.toFixed(2)}
📈 Outstanding Balance: Ksh ${totalAllBalance.toFixed(2)}

You have ${salesWithDetails.filter((s: any) => s.saleBalance > 0).length} active purchases.

View full statement: ${receiptUrl}

For inquiries, contact us at support@swiftmetals.com`;

    // Format phone for WhatsApp
    const formatPhoneForWhatsApp = (phone: string) => {
      if (!phone) return '';
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
      } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
      }
      return cleaned;
    };

    const whatsappPhone = customer.phone ? formatPhoneForWhatsApp(customer.phone) : '';

    // Generate HTML Statement - USING SAME STYLE AS RECEIPT
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Statement - ${escapeHtml(customer.name)}</title>
  <style>
    /* EXACT SAME CSS AS RECEIPT */
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
    
    /* Statement-specific styles (minimal additions) */
    .statement-summary {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .summary-item {
      flex: 1;
      min-width: 200px;
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .summary-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .summary-value.purchases {
      color: #2563eb;
    }
    
    .summary-value.payments {
      color: #10b981;
    }
    
    .summary-value.balance {
      color: ${totalAllBalance > 0 ? '#ef4444' : '#10b981'};
    }
    
    .purchase-section {
      margin-bottom: 40px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      padding: 20px;
      background: #f9fafb;
    }
    
    .purchase-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .purchase-title {
      font-size: 16px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .purchase-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .purchase-status.paid {
      background: #d1fae5;
      color: #065f46;
    }
    
    .purchase-status.unpaid {
      background: #fee2e2;
      color: #dc2626;
    }
    
    /* Mobile Responsive Styles - SAME AS RECEIPT */
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
      
      .statement-summary {
        flex-direction: column;
      }
      
      .summary-item {
        min-width: 100%;
      }
      
      .summary-value {
        font-size: 20px;
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
        filename: 'Statement_${escapeHtml(customer.name)}.pdf',
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
    
    async function sendStatementSMS() {
      const button = event.target;
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '⏳ Sending...';
      
      try {
        const response = await fetch('/api/customer-receipt/${customer.id}/sms', {
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
    ${customer.phone ? `
    <button class="action-button sms" onclick="sendStatementSMS()">
      💬 SMS
    </button>
    ` : ''}
  </div>
  
  <div class="receipt-container">
    <!-- Header - SAME AS RECEIPT -->
    <div class="header">
      <div class="company-name">SwiftMetals</div>
      <div class="company-tagline">Your Trusted Metal Solutions Provider</div>
    </div>
    
    <!-- Title -->
    <div class="receipt-title">ACCOUNT STATEMENT</div>
    
    <!-- Statement Info -->
    <div class="receipt-info">
      <div class="info-item">
        <div class="info-label">Customer</div>
        <div class="info-value">${escapeHtml(customer.name)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Customer ID</div>
        <div class="info-value">#${customer.id}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Statement Date</div>
        <div class="info-value">${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</div>
      </div>
    </div>
    
    <!-- Customer Information - SAME AS RECEIPT -->
    ${customer ? `
    <div class="section-title">Account Details</div>
    <div class="customer-box">
      <div class="customer-name">${escapeHtml(customer.name)}</div>
      ${customer.phone ? `<div class="customer-detail">📞 ${escapeHtml(customer.phone)}</div>` : ''}
      ${customer.email ? `<div class="customer-detail">📧 ${escapeHtml(customer.email)}</div>` : ''}
    </div>
    ` : ''}
    
    <!-- Statement Summary -->
    <div class="section-title">Account Summary</div>
    <div class="statement-summary">
      <div class="summary-item">
        <div class="summary-label">Total Purchases</div>
        <div class="summary-value purchases">Ksh ${totalAllPurchases.toFixed(2)}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
          ${salesWithDetails.length} purchase(s)
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Payments</div>
        <div class="summary-value payments">Ksh ${totalAllPayments.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Outstanding Balance</div>
        <div class="summary-value balance">Ksh ${totalAllBalance.toFixed(2)}</div>
      </div>
    </div>
    
    <!-- All Purchases -->
    <div class="section-title">Purchase History</div>
    
    ${salesWithDetails.length === 0 ? `
    <div class="no-payments" style="margin-top: 20px;">
      No purchase history found for this customer.
    </div>
    ` : salesWithDetails.map((sale: any, index: number) => `
    <div class="purchase-section">
      <div class="purchase-header">
        <div>
          <div class="purchase-title">Purchase #${sale.id}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
            Date: ${new Date(sale.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
        <div class="purchase-status ${sale.saleBalance > 0 ? 'unpaid' : 'paid'}">
          ${sale.saleBalance > 0 ? 'UNPAID' : 'PAID'}
        </div>
      </div>
      
      <!-- Items Table - SAME AS RECEIPT -->
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
          ${sale.saleitem.map((item: any) => `
          <tr>
            <td>${escapeHtml(item.product.name)}</td>
            <td class="center">${item.quantity}</td>
            <td class="right">Ksh ${item.price.toFixed(2)}</td>
            <td class="right">Ksh ${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      但也
      
      <!-- Payments - SAME AS RECEIPT -->
      ${sale.payment.length > 0 ? `
      <div style="margin-top: 20px;">
        <div style="font-size: 14px; color: #2563eb; font-weight: 600; margin-bottom: 10px;">
          Payments Received:
        </div>
        ${sale.payment.map((p: any) => `
        <div class="payment-item">
          <div>
            <span class="payment-method">${p.method}</span>
            <span class="payment-status ${p.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}">
              ${p.status}
            </span>
            <span style="font-size: 11px; color: #6b7280; margin-left: 10px;">
              ${new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <span class="payment-amount">Ksh ${p.amount.toFixed(2)}</span>
        </div>
        `).join('')}
      </div>
      ` : '<div class="no-payments" style="margin-top: 20px;">No payments recorded for this purchase</div>'}
      
      <!-- Purchase Totals - SAME AS RECEIPT -->
      <div class="totals-box">
        <div class="total-row">
          <span class="total-label">Purchase Total:</span>
          <span class="total-value">Ksh ${sale.saleTotal.toFixed(2)}</span>
        </div>
        <div class="total-row paid">
          <span class="total-label">Paid:</span>
          <span class="total-value">Ksh ${sale.salePayments.toFixed(2)}</span>
        </div>
        <div class="total-row divider balance">
          <span class="total-label">Balance Due:</span>
          <span class="total-value ${sale.saleBalance > 0 ? 'balance-positive' : 'balance-zero'}">
            Ksh ${sale.saleBalance.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
    `).join('')}
    
    <!-- Overall Balance - SAME STYLE AS RECEIPT -->
    <div class="totals-box" style="margin-top: 40px; max-width: 100%; border: 2px solid ${totalAllBalance > 0 ? '#fca5a5' : '#a7f3d0'};">
      <div class="total-row" style="font-size: 16px;">
        <span class="total-label">Total Purchases:</span>
        <span class="total-value">Ksh ${totalAllPurchases.toFixed(2)}</span>
      </div>
      <div class="total-row paid" style="font-size: 16px;">
        <span class="total-label">Total Payments:</span>
        <span class="total-value">Ksh ${totalAllPayments.toFixed(2)}</span>
      </div>
      <div class="total-row divider balance" style="font-size: 20px; padding-top: 20px;">
        <span class="total-label">TOTAL OUTSTANDING BALANCE:</span>
        <span class="total-value ${totalAllBalance > 0 ? 'balance-positive' : 'balance-zero'}" style="font-size: 24px;">
          Ksh ${totalAllBalance.toFixed(2)}
        </span>
      </div>
      <div style="text-align: center; margin-top: 15px; padding: 10px; background: ${totalAllBalance > 0 ? '#fef2f2' : '#f0fdf4'}; border-radius: 6px;">
        <div style="font-size: 12px; color: ${totalAllBalance > 0 ? '#dc2626' : '#047857'};">
          ${totalAllBalance > 0 
            ? `${salesWithDetails.filter((s: any) => s.saleBalance > 0).length} unpaid purchase(s)` 
            : 'All purchases paid in full ✓'}
        </div>
      </div>
    </div>
    
    <!-- Footer - SAME AS RECEIPT -->
    <div class="footer">
      <div class="footer-message">Thank you for being a valued customer!</div>
      <div class="footer-contact">For inquiries regarding your account, contact us at support@swiftmetals.com</div>
      <div class="footer-contact" style="margin-top: 10px; font-size: 12px;">
        Statement generated on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
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
    console.error("Statement generation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate statement" },
      { status: 500 }
    );
  }
}

// POST /api/customer-receipt/[customerId]/sms - Send Statement SMS
export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const customerIdNum = parseInt(customerId, 10);
    
    if (isNaN(customerIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid customer ID" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerIdNum },
      include: {
        sale: {
          include: {
            saleitem: { include: { product: true } },
            payment: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Calculate totals
    const totalAllPurchases = customer.sale.reduce((sum: number, sale: any) => sum + sale.amount, 0);
    const totalAllPayments = customer.sale.reduce((sum: number, sale: any) => 
      sum + sale.payment.reduce((pSum: number, p: any) => pSum + p.amount, 0), 0
    );
    const totalAllBalance = totalAllPurchases - totalAllPayments;

    const phone = normalizePhone(customer.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const host = req.headers.get('host') || '';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const receiptUrl = `${protocol}://${host}/api/customer-receipt/${customer.id}`;

    // Format SMS message - SAME STYLE AS RECEIPT SMS
    let msg = `Hello ${customer.name},\n\n`;
    msg += `*SWIFTMETALS ACCOUNT STATEMENT*\n\n`;
    msg += `Statement Summary:\n`;
    msg += `Total Purchases: KES ${totalAllPurchases.toLocaleString()}\n`;
    msg += `Total Payments: KES ${totalAllPayments.toLocaleString()}\n`;
    msg += `Outstanding Balance: KES ${totalAllBalance.toLocaleString()}\n\n`;
    
    if (totalAllBalance > 0) {
      msg += `Status: ${customer.sale.filter((s: any) => {
        const payments = s.payment.reduce((sum: number, p: any) => sum + p.amount, 0);
        return s.amount - payments > 0;
      }).length} unpaid purchase(s)\n\n`;
    } else {
      msg += `Status: PAID IN FULL ✓\n\n`;
    }
    
    msg += `View full statement: ${receiptUrl}\n\n`;
    msg += `Thank you for choosing SWIFT Metals!`;

    const response = await sendSMS(phone, msg);

    const failedRecipient = response?.failedRecipients?.find(
      (r: any) => r.error?.includes("UserInBlacklist")
    );

    if (failedRecipient) {
      return NextResponse.json({
        blacklist: true,
        error: "User is in blacklist",
        customer: customer.name,
        phone,
        context: "Account Statement SMS",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Account statement sent to ${customer.name}`,
      summary: {
        totalPurchases: totalAllPurchases,
        totalPayments: totalAllPayments,
        totalBalance: totalAllBalance,
        salesCount: customer.sale.length,
      },
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