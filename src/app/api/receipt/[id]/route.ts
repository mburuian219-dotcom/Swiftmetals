import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    // Generate HTML Receipt
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
    }
    
    .info-item {
      flex: 1;
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
      float: right;
      width: 350px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
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
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .receipt-container {
        box-shadow: none;
        padding: 20px;
      }
      
      @page {
        margin: 1cm;
      }
    }
    
    .action-buttons {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 1000;
    }
    
    .action-button {
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      transition: background 0.2s;
    }
    
    .action-button:hover {
      background: #1d4ed8;
    }
    
    .action-button.download {
      background: #059669;
    }
    
    .action-button.download:hover {
      background: #047857;
    }
    
    @media print {
      .action-buttons {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Print Receipt</button>
  
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
          <th class="center">Quantity</th>
          <th class="right">Unit Price</th>
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
      <div class="footer-contact">For inquiries, please contact us at support@swiftmetals.com</div>
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