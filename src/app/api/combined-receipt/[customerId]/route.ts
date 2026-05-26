// app/api/combined-receipt/[customerId]/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Generate HTML receipt
const generateHtmlReceipt = (
  customer: any,
  allOutstandingSales: any[], // ALL outstanding sales before payment
  paymentAmount: number,
  paymentMethod: string,
  paymentReference: string,
  totalOutstandingBefore: number,
  distributedSales: any[], // Sales that received payment
  unaffectedSales: any[], // Outstanding sales that didn't receive payment
  remainingAmount: number,
  newOutstandingBalance: number
) => {
  const date = new Date().toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const time = new Date().toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  const totalAllocated = paymentAmount - remainingAmount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - Swiftmetals</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .receipt { background: white; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
    .company { font-size: 28px; font-weight: bold; color: #2563eb; }
    .receipt-title { font-size: 20px; margin: 20px 0; text-align: center; }
    .info-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .customer-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .payment-box { background: #e8f5e9; padding: 20px; border: 2px solid #4caf50; border-radius: 5px; margin-bottom: 20px; text-align: center; }
    .amount { font-size: 36px; font-weight: bold; color: #2e7d32; }
    .summary-box { background: #2563eb; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 18px; }
    .summary-box .value { font-size: 24px; font-weight: bold; }
    .section-title { font-size: 18px; font-weight: bold; color: #2563eb; margin: 25px 0 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    .sale-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
    .sale-card.paid-now { background: #f0fdf4; border: 2px solid #4caf50; }
    .sale-card.unaffected { background: #fff3e0; border: 2px solid #f59e0b; }
    .sale-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .sale-id { font-weight: bold; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 14px; }
    th { background: #2563eb; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .amount-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
    .amount-item { text-align: center; flex: 1; }
    .amount-item .label { font-size: 12px; color: #666; }
    .amount-item .value { font-weight: bold; font-size: 16px; }
    .paid-now-value { color: #10b981; }
    .remaining-value { color: #dc2626; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-unpaid { background: #fee2e2; color: #dc2626; }
    .summary-total { background: #f9fafb; padding: 20px; margin-top: 20px; border: 2px solid #2563eb; border-radius: 5px; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row { border-top: 2px solid #000; margin-top: 10px; padding-top: 15px; font-weight: bold; font-size: 18px; }
    .footer { text-align: center; margin-top: 30px; color: #666; }
    .print-btn { text-align: center; margin: 20px 0; }
    .print-btn button { background: #2563eb; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="company">SWIFTMETALS</div>
      <div>Payment Receipt</div>
    </div>

    <div class="receipt-title">RECEIPT #${receiptNumber}</div>

    <div class="info-box">
      <div class="customer-name">${customer.name}</div>
      ${customer.phone ? `<div>📞 ${customer.phone}</div>` : ''}
      ${customer.email ? `<div>📧 ${customer.email}</div>` : ''}
      <div style="margin-top: 10px;">📅 ${date} ${time}</div>
    </div>

    <div class="payment-box">
      <div style="margin-bottom: 10px;">AMOUNT PAID</div>
      <div class="amount">KSh ${formatCurrency(paymentAmount)}</div>
      <div style="margin-top: 10px;">Method: ${paymentMethod}</div>
      ${paymentReference ? `<div>Ref: ${paymentReference}</div>` : ''}
    </div>

    <div class="summary-box">
      <span>TOTAL OUTSTANDING BEFORE PAYMENT:</span>
      <span class="value">KSh ${formatCurrency(totalOutstandingBefore)}</span>
    </div>

    <div class="section-title">📋 SALES THAT RECEIVED PAYMENT TODAY</div>
    
    ${distributedSales.map((sale: any) => `
      <div class="sale-card paid-now">
        <div class="sale-header">
          <span class="sale-id">Sale #${sale.id} - ${new Date(sale.date).toLocaleDateString()}</span>
          <span class="status-badge ${sale.fullyPaid ? 'status-paid' : 'status-partial'}">
            ${sale.fullyPaid ? '✓ FULLY PAID' : '⏳ PARTIALLY PAID'}
          </span>
        </div>

        <table>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          ${sale.saleitem.map((item: any) => `
            <tr>
              <td>${item.product?.name || 'Product'}</td>
              <td>${item.quantity}</td>
              <td>KSh ${formatCurrency(item.price)}</td>
              <td>KSh ${formatCurrency(item.price * item.quantity)}</td>
            </tr>
          `).join('')}
        </table>

        <div class="amount-row">
          <div class="amount-item">
            <div class="label">Sale Total</div>
            <div class="value">KSh ${formatCurrency(sale.amount)}</div>
          </div>
          <div class="amount-item">
            <div class="label">Previously Paid</div>
            <div class="value">KSh ${formatCurrency(sale.paidAmount)}</div>
          </div>
          <div class="amount-item">
            <div class="label">Paid Today</div>
            <div class="value paid-now-value">KSh ${formatCurrency(sale.paidNow)}</div>
          </div>
          <div class="amount-item">
            <div class="label">New Balance</div>
            <div class="value ${sale.remainingAfter > 0 ? 'remaining-value' : 'paid-now-value'}">
              ${sale.remainingAfter > 0 ? `KSh ${formatCurrency(sale.remainingAfter)}` : '✓ PAID'}
            </div>
          </div>
        </div>

        ${!sale.fullyPaid ? `
          <div style="text-align: right; color: #dc2626;">
            <strong>Still Owing: KSh ${formatCurrency(sale.remainingAfter)}</strong>
          </div>
        ` : ''}
      </div>
    `).join('')}

    ${unaffectedSales.length > 0 ? `
      <div class="section-title">⏳ OTHER OUTSTANDING SALES (Not Affected by This Payment)</div>
      
      ${unaffectedSales.map((sale: any) => `
        <div class="sale-card unaffected">
          <div class="sale-header">
            <span class="sale-id">Sale #${sale.id} - ${new Date(sale.date).toLocaleDateString()}</span>
            <span class="status-badge status-unpaid">⏳ OUTSTANDING</span>
          </div>

          <table>
            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            ${sale.saleitem.map((item: any) => `
              <tr>
                <td>${item.product?.name || 'Product'}</td>
                <td>${item.quantity}</td>
                <td>KSh ${formatCurrency(item.price)}</td>
                <td>KSh ${formatCurrency(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </table>

          <div class="amount-row">
            <div class="amount-item">
              <div class="label">Sale Total</div>
              <div class="value">KSh ${formatCurrency(sale.amount)}</div>
            </div>
            <div class="amount-item">
              <div class="label">Paid So Far</div>
              <div class="value">KSh ${formatCurrency(sale.paidAmount)}</div>
            </div>
            <div class="amount-item">
              <div class="label">Outstanding</div>
              <div class="value remaining-value">KSh ${formatCurrency(sale.remainingBalance)}</div>
            </div>
          </div>
        </div>
      `).join('')}
    ` : ''}

    <div class="summary-total">
      <div class="summary-row">
        <span>Total Outstanding Before Payment:</span>
        <span><strong>KSh ${formatCurrency(totalOutstandingBefore)}</strong></span>
      </div>
      <div class="summary-row">
        <span>Amount Paid Today:</span>
        <span><strong style="color: #10b981;">- KSh ${formatCurrency(paymentAmount)}</strong></span>
      </div>
      <div class="summary-row">
        <span>Amount Allocated to Sales:</span>
        <span>KSh ${formatCurrency(totalAllocated)}</span>
      </div>
      ${remainingAmount > 0 ? `
        <div class="summary-row" style="color: #f59e0b;">
          <span>Amount Added to Credit:</span>
          <span><strong>KSh ${formatCurrency(remainingAmount)}</strong></span>
        </div>
      ` : ''}
      <div class="summary-row total-row">
        <span>NEW OUTSTANDING BALANCE:</span>
        <span style="color: ${newOutstandingBalance > 0 ? '#dc2626' : newOutstandingBalance < 0 ? '#10b981' : '#065f46'};">
          ${newOutstandingBalance > 0 ? `KSh ${formatCurrency(newOutstandingBalance)}` : 
            newOutstandingBalance < 0 ? `Credit: KSh ${formatCurrency(Math.abs(newOutstandingBalance))}` : 
            '✓ FULLY PAID'}
        </span>
      </div>
    </div>

    <div style="text-align: center; margin: 30px 0; padding: 20px; background: ${newOutstandingBalance === 0 ? '#d1fae5' : newOutstandingBalance > 0 ? '#fee2e2' : '#fef3c7'}; border-radius: 5px;">
      <div style="font-size: 20px; font-weight: bold; color: ${newOutstandingBalance === 0 ? '#065f46' : newOutstandingBalance > 0 ? '#dc2626' : '#d97706'};">
        ${newOutstandingBalance === 0 ? '✅ FULLY PAID - Thank you!' : 
          newOutstandingBalance > 0 ? `⏳ REMAINING BALANCE: KSh ${formatCurrency(newOutstandingBalance)}` : 
          `💰 CREDIT BALANCE: KSh ${formatCurrency(Math.abs(newOutstandingBalance))}`}
      </div>
    </div>

    <div class="footer">
      <div style="font-size: 18px; color: #2563eb; margin-bottom: 10px;">THANK YOU FOR YOUR BUSINESS!</div>
      <div>Swiftmetals</div>
    </div>

    <div class="print-btn">
      <button onclick="window.print()">PRINT RECEIPT</button>
    </div>
  </div>
</body>
</html>`;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const customerIdNum = parseInt(customerId);
    const { searchParams } = new URL(req.url);
    
    const paymentAmount = parseFloat(searchParams.get('amount') || '0');
    const paymentMethod = searchParams.get('method') || 'CASH';
    const paymentReference = searchParams.get('reference') || '';

    // Validate inputs
    if (isNaN(customerIdNum) || customerIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    // Fetch customer with ALL sales
    const customer = await prisma.customer.findUnique({
      where: { id: customerIdNum },
      include: {
        sale: {
          include: {
            saleitem: {
              include: {
                product: true
              }
            },
            payment: {
              where: { 
                status: { in: ['CLEARED', 'COMPLETED'] }
              }
            }
          },
          orderBy: {
            date: 'asc' // Oldest first for FIFO
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Calculate ALL sales with their current status
    const allSales = customer.sale.map(sale => {
      const paidAmount = sale.payment.reduce((sum, p) => sum + p.amount, 0);
      return {
        id: sale.id,
        date: sale.date,
        amount: sale.amount,
        paidAmount,
        remainingBalance: sale.amount - paidAmount,
        saleitem: sale.saleitem || []
      };
    });

    // Get ONLY outstanding sales (those with remaining balance > 0)
    const outstandingSales = allSales.filter(sale => sale.remainingBalance > 0.01);
    
    // Calculate total outstanding BEFORE payment
    const totalOutstandingBefore = outstandingSales.reduce((sum, s) => sum + s.remainingBalance, 0);

    // Distribute payment (FIFO - oldest first)
    let remainingToDistribute = paymentAmount;
    const distributedSales = [];
    const unaffectedSales = [];

    for (const sale of outstandingSales) {
      if (remainingToDistribute <= 0) {
        // No money left, this sale is unaffected
        unaffectedSales.push(sale);
      } else {
        const paidForThisSale = Math.min(remainingToDistribute, sale.remainingBalance);
        
        distributedSales.push({
          ...sale,
          paidNow: paidForThisSale,
          fullyPaid: Math.abs(paidForThisSale - sale.remainingBalance) < 0.01,
          remainingAfter: sale.remainingBalance - paidForThisSale
        });
        
        remainingToDistribute -= paidForThisSale;
      }
    }

    // Calculate new outstanding balance
    const newOutstandingBalance = totalOutstandingBefore - paymentAmount;

    // Generate receipt
    const htmlReceipt = generateHtmlReceipt(
      customer,
      outstandingSales,
      paymentAmount,
      paymentMethod,
      paymentReference,
      totalOutstandingBefore,
      distributedSales,
      unaffectedSales,
      remainingToDistribute,
      newOutstandingBalance
    );

    return new NextResponse(htmlReceipt, {
      headers: { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Receipt generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}