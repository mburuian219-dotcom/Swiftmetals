// src/app/api/paymentReports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== HELPER FUNCTIONS ====================

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

const formatCurrency = (amount: number): string => {
  return amount.toFixed(2);
};

const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const arrayToCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.map(header => escapeCSV(header)).join(','));
  
  for (const row of data) {
    const values = headers.map(header => escapeCSV(row[header]));
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

const startOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const startOfWeek = (date: Date): Date => {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + (day === 0 ? -6 : 1);
  newDate.setDate(diff);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfWeek = (date: Date): Date => {
  const newDate = startOfWeek(date);
  newDate.setDate(newDate.getDate() + 6);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const startOfMonth = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setDate(1);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfMonth = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1);
  newDate.setDate(0);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

const ensureDate = (date: string | null): Date => {
  if (!date) return new Date();
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date() : d;
};

// Helper to get products string from sale
const getProductsString = (sale: any): string => {
  if (!sale.saleitem || sale.saleitem.length === 0) {
    return 'No products';
  }
  
  return sale.saleitem.map((item: any) => {
    const productName = item.product?.name || `Product ID: ${item.productId}`;
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    return `${productName} (${quantity} x KSh ${formatCurrency(price)})`;
  }).join('; ');
};

// ==================== GET ENDPOINTS ====================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get('type');
  const date = searchParams.get('date');
  const customerId = searchParams.get('customerId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const asOf = searchParams.get('asOf');
  const period = searchParams.get('period');

  try {
    switch (reportType) {
      case 'daily':
        return await generateDailyPaymentReport(date);
      case 'weekly':
        return await generateWeeklyPaymentReport(startDate, endDate);
      case 'monthly':
        return await generateMonthlyPaymentReport(startDate, endDate);
      case 'customer':
        return await generateCustomerHistory(customerId, startDate, endDate);
      case 'outstanding':
        return await generateOutstandingReport(asOf);
      case 'payment-activity':
        return await generatePaymentActivityReport(period || 'daily', startDate, endDate);
      default:
        return NextResponse.json(
          { error: 'Invalid report type. Use: daily, weekly, monthly, customer, outstanding, or payment-activity' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ==================== DAILY PAYMENT REPORT ====================

async function generateDailyPaymentReport(dateParam: string | null) {
  const targetDate = ensureDate(dateParam);
  const startDateObj = startOfDay(targetDate);
  const endDateObj = endOfDay(targetDate);

  // Get all payments made on this day
  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: startDateObj, lte: endDateObj },
      status: { in: ['CLEARED', 'COMPLETED'] }
    },
    include: {
      sale: { 
        include: { 
          customer: true,
          payment: true,
          saleitem: {
            include: {
              product: true
            }
          }
        } 
      }
    },
    orderBy: { paidAt: 'asc' }
  });

  console.log(`Found ${payments.length} payments for date ${formatDate(targetDate)}`);

  const transactionData = payments.map(payment => {
    const totalPaidOverall = payment.sale.payment?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const previousBalance = payment.sale.amount - (totalPaidOverall - payment.amount);
    const remainingBalance = payment.sale.amount - totalPaidOverall;
    
    // Get products string using helper
    const productsString = getProductsString(payment.sale);
    
    console.log(`Sale ${payment.saleId} has ${payment.sale.saleitem?.length || 0} items`);
    
    return {
      'Date': formatDate(payment.paidAt),
      'Time': formatTime(payment.paidAt),
      'Sale ID': payment.saleId,
      'Customer Name': payment.sale.customer?.name || 'Unknown',
      'Customer Phone': payment.sale.customer?.phone || '',
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(payment.sale.amount),
      'Previous Balance': formatCurrency(previousBalance),
      'Amount Paid Today': formatCurrency(payment.amount),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': payment.sale.status,
      'Payment Method': payment.method,
      'Created By': payment.sale.createdBy || 'N/A',
      'Updated By': payment.sale.updatedBy || 'N/A',
      'Last Updated': payment.sale.updatedAt ? formatDateTime(payment.sale.updatedAt) : formatDateTime(payment.sale.date)
    };
  });

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const uniqueCustomers = new Set(payments.map(p => p.sale.customer?.id)).size;
  const uniqueSales = new Set(payments.map(p => p.saleId)).size;

  const summaryRows = [
    {
      'Date': '--- SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Previous Balance': '', 'Amount Paid Today': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS RECEIVED', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalPayments), 'Previous Balance': '', 'Amount Paid Today': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'NUMBER OF PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': payments.length.toString(), 'Previous Balance': '', 'Amount Paid Today': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueCustomers.toString(), 'Previous Balance': '', 'Amount Paid Today': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'SALES UPDATED', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueSales.toString(), 'Previous Balance': '', 'Amount Paid Today': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...transactionData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="daily-payments-${formatDate(targetDate)}.csv"`,
    }
  });
}

// ==================== WEEKLY PAYMENT REPORT ====================

async function generateWeeklyPaymentReport(startDateParam: string | null, endDateParam: string | null) {
  const startDateObj = startDateParam ? startOfDay(ensureDate(startDateParam)) : startOfWeek(new Date());
  const endDateObj = endDateParam ? endOfDay(ensureDate(endDateParam)) : endOfWeek(new Date());

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: startDateObj, lte: endDateObj },
      status: { in: ['CLEARED', 'COMPLETED'] }
    },
    include: {
      sale: { 
        include: { 
          customer: true,
          payment: true,
          saleitem: {
            include: {
              product: true
            }
          }
        } 
      }
    },
    orderBy: { paidAt: 'asc' }
  });

  console.log(`Found ${payments.length} payments for week ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`);

  const paymentTransactions = payments.map(payment => {
    const totalPaidOverall = payment.sale.payment?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const previousBalance = payment.sale.amount - (totalPaidOverall - payment.amount);
    const remainingBalance = payment.sale.amount - totalPaidOverall;
    const productsString = getProductsString(payment.sale);
    
    return {
      'Date': formatDate(payment.paidAt),
      'Time': formatTime(payment.paidAt),
      'Sale ID': payment.saleId,
      'Customer Name': payment.sale.customer?.name || 'Unknown',
      'Customer Phone': payment.sale.customer?.phone || '',
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(payment.sale.amount),
      'Previous Balance Before Payment': formatCurrency(previousBalance),
      'Amount Paid': formatCurrency(payment.amount),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': payment.sale.status,
      'Payment Method': payment.method,
      'Created By': payment.sale.createdBy || 'N/A',
      'Updated By': payment.sale.updatedBy || 'N/A',
      'Last Updated': payment.sale.updatedAt ? formatDateTime(payment.sale.updatedAt) : formatDateTime(payment.sale.date)
    };
  });

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const uniqueCustomers = new Set(payments.map(p => p.sale.customer?.id)).size;
  const uniqueSales = new Set(payments.map(p => p.saleId)).size;

  const summaryRows = [
    {
      'Date': '--- WEEKLY SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': `Week: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalPayments), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'NUMBER OF PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': payments.length.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueCustomers.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'SALES UPDATED', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueSales.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...paymentTransactions, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="weekly-payments-${formatDate(startDateObj)}-to-${formatDate(endDateObj)}.csv"`,
    }
  });
}

// ==================== MONTHLY PAYMENT REPORT ====================

async function generateMonthlyPaymentReport(startDateParam: string | null, endDateParam: string | null) {
  const startDateObj = startDateParam ? startOfDay(ensureDate(startDateParam)) : startOfMonth(new Date());
  const endDateObj = endDateParam ? endOfDay(ensureDate(endDateParam)) : endOfMonth(new Date());

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: startDateObj, lte: endDateObj },
      status: { in: ['CLEARED', 'COMPLETED'] }
    },
    include: {
      sale: { 
        include: { 
          customer: true,
          payment: true,
          saleitem: {
            include: {
              product: true
            }
          }
        } 
      }
    },
    orderBy: { paidAt: 'asc' }
  });

  const paymentTransactions = payments.map(payment => {
    const totalPaidOverall = payment.sale.payment?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    const previousBalance = payment.sale.amount - (totalPaidOverall - payment.amount);
    const remainingBalance = payment.sale.amount - totalPaidOverall;
    const productsString = getProductsString(payment.sale);
    
    return {
      'Date': formatDate(payment.paidAt),
      'Time': formatTime(payment.paidAt),
      'Sale ID': payment.saleId,
      'Customer Name': payment.sale.customer?.name || 'Unknown',
      'Customer Phone': payment.sale.customer?.phone || '',
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(payment.sale.amount),
      'Previous Balance Before Payment': formatCurrency(previousBalance),
      'Amount Paid': formatCurrency(payment.amount),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': payment.sale.status,
      'Payment Method': payment.method,
      'Created By': payment.sale.createdBy || 'N/A',
      'Updated By': payment.sale.updatedBy || 'N/A',
      'Last Updated': payment.sale.updatedAt ? formatDateTime(payment.sale.updatedAt) : formatDateTime(payment.sale.date)
    };
  });

  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const uniqueCustomers = new Set(payments.map(p => p.sale.customer?.id)).size;
  const uniqueSales = new Set(payments.map(p => p.saleId)).size;

  const summaryRows = [
    {
      'Date': '--- MONTHLY SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': `Month: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalPayments), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'NUMBER OF PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': payments.length.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueCustomers.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'SALES UPDATED', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Total Sale Amount': uniqueSales.toString(), 'Previous Balance Before Payment': '', 'Amount Paid': '',
      'Remaining Balance': '', 'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...paymentTransactions, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="monthly-payments-${formatDate(startDateObj)}-to-${formatDate(endDateObj)}.csv"`,
    }
  });
}

// ==================== CUSTOMER HISTORY ====================

async function generateCustomerHistory(customerIdParam: string | null, startDateParam: string | null, endDateParam: string | null) {
  if (!customerIdParam) {
    return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
  }
  
  const start = startDateParam ? ensureDate(startDateParam) : startOfDay(new Date('2024-01-01'));
  const end = endDateParam ? ensureDate(endDateParam) : endOfDay(new Date());

  const customer = await prisma.customer.findUnique({
    where: { id: Number(customerIdParam) }
  });

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const sales = await prisma.sale.findMany({
    where: {
      customerId: Number(customerIdParam),
      date: { gte: start, lte: end },
      isDeleted: false
    },
    include: {
      payment: { orderBy: { paidAt: 'asc' } },
      customer: true,
      saleitem: {
        include: {
          product: true
        }
      }
    },
    orderBy: { date: 'asc' }
  });

  if (sales.length === 0) {
    return NextResponse.json({ error: 'No sales found for this customer' }, { status: 404 });
  }

  let runningBalance = 0;
  const transactions: any[] = [];

  for (const sale of sales) {
    const productsString = getProductsString(sale);
    
    runningBalance += sale.amount;
    transactions.push({
      'Date': formatDate(sale.date),
      'Type': 'SALE (CREDIT)',
      'Sale ID': sale.id,
      'Products': productsString,
      'Debit': formatCurrency(sale.amount),
      'Credit': '0.00',
      'Running Balance': formatCurrency(runningBalance),
      'Status': sale.status
    });

    for (const payment of sale.payment) {
      runningBalance -= payment.amount;
      transactions.push({
        'Date': formatDate(payment.paidAt),
        'Type': 'PAYMENT',
        'Sale ID': sale.id,
        'Products': `Payment via ${payment.method}`,
        'Debit': '0.00',
        'Credit': formatCurrency(payment.amount),
        'Running Balance': formatCurrency(runningBalance),
        'Status': runningBalance === 0 ? 'PAID' : 'PARTIAL'
      });
    }
  }

  const totalCredit = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalPayments = sales.reduce((sum, s) => sum + s.payment.reduce((ps, p) => ps + p.amount, 0), 0);
  const outstandingBalance = totalCredit - totalPayments;

  transactions.push(
    {
      'Date': '--- SUMMARY ---', 'Type': '', 'Sale ID': '', 'Products': '',
      'Debit': '', 'Credit': '', 'Running Balance': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'TOTAL CREDIT', 'Sale ID': '', 'Products': '',
      'Debit': formatCurrency(totalCredit), 'Credit': '', 'Running Balance': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'TOTAL PAYMENTS', 'Sale ID': '', 'Products': '',
      'Debit': '', 'Credit': formatCurrency(totalPayments), 'Running Balance': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'OUTSTANDING BALANCE', 'Sale ID': '', 'Products': '',
      'Debit': '', 'Credit': '', 'Running Balance': formatCurrency(outstandingBalance),
      'Status': outstandingBalance === 0 ? 'CLEARED' : 'PENDING'
    }
  );

  const csv = arrayToCSV(transactions);
  const safeCustomerName = customer.name.replace(/[^a-zA-Z0-9]/g, '-');
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeCustomerName}-payment-history-${formatDate(start)}-to-${formatDate(end)}.csv"`,
    }
  });
}

// ==================== OUTSTANDING REPORT ====================

async function generateOutstandingReport(asOfParam: string | null) {
  const asOfDate = ensureDate(asOfParam);
  const endOfAsOfDate = endOfDay(asOfDate);

  const sales = await prisma.sale.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIAL'] },
      isDeleted: false,
      date: { lte: endOfAsOfDate }
    },
    include: {
      customer: true,
      payment: true,
      paymentschedule: true,
      saleitem: {
        include: {
          product: true
        }
      }
    },
    orderBy: [
      { customer: { name: 'asc' } },
      { date: 'asc' }
    ]
  });

  const outstandingData = sales.map(sale => {
    const totalPaid = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const currentBalance = sale.amount - totalPaid;
    const nextPaymentDue = sale.paymentschedule.find(ps => !ps.isPaid);
    const productsString = getProductsString(sale);
    
    let daysOverdue = 0;
    if (sale.dueDate) {
      const dueDate = new Date(sale.dueDate);
      if (dueDate < asOfDate) {
        daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
      }
    }
    
    let lastPaymentDate = 'No payments';
    if (sale.payment.length > 0) {
      const lastPaymentTimes = sale.payment.map(p => p.paidAt.getTime());
      const lastPayment = new Date(Math.max(...lastPaymentTimes));
      lastPaymentDate = formatDate(lastPayment);
    }
    
    return {
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Sale ID': sale.id,
      'Sale Date': formatDate(sale.date),
      'Products Taken': productsString,
      'Original Amount': formatCurrency(sale.amount),
      'Total Paid': formatCurrency(totalPaid),
      'Outstanding Balance': formatCurrency(currentBalance),
      'Status': sale.status,
      'Payment Method': sale.paymentMethod || 'Not specified',
      'Due Date': sale.dueDate ? formatDate(sale.dueDate) : 'N/A',
      'Next Payment Due': nextPaymentDue ? formatDate(nextPaymentDue.dueDate) : 'N/A',
      'Days Overdue': daysOverdue,
      'Last Payment Date': lastPaymentDate,
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A'
    };
  });

  const totalOutstanding = outstandingData.reduce((sum, d) => sum + parseFloat(d['Outstanding Balance'] as string), 0);
  const totalOverdue = outstandingData
    .filter(d => d['Days Overdue'] > 0)
    .reduce((sum, d) => sum + parseFloat(d['Outstanding Balance'] as string), 0);
  const overdueCount = outstandingData.filter(d => d['Days Overdue'] > 0).length;

  const summaryRows = [
    {
      'Customer Name': '--- SUMMARY ---', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': '',
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': 'TOTAL OUTSTANDING', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': formatCurrency(totalOutstanding),
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': 'OVERDUE AMOUNT', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': formatCurrency(totalOverdue),
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': `Overdue Customers: ${overdueCount}`, 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': '',
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Created By': '', 'Updated By': ''
    }
  ];

  const finalData = [...outstandingData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outstanding-debts-${formatDate(asOfDate)}.csv"`,
    }
  });
}

// ==================== PAYMENT ACTIVITY REPORT ====================

async function generatePaymentActivityReport(period: string, startDateParam: string | null, endDateParam: string | null) {
  let start: Date, end: Date;
  
  switch (period) {
    case 'weekly':
      start = startOfWeek(ensureDate(startDateParam));
      end = endOfWeek(ensureDate(endDateParam || startDateParam));
      break;
    case 'monthly':
      start = startOfMonth(ensureDate(startDateParam));
      end = endOfMonth(ensureDate(endDateParam || startDateParam));
      break;
    default:
      start = startOfDay(ensureDate(startDateParam));
      end = endOfDay(ensureDate(endDateParam || startDateParam));
  }

  const salesWithPayments = await prisma.sale.findMany({
    where: {
      payment: {
        some: {
          paidAt: { gte: start, lte: end },
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      isDeleted: false
    },
    include: {
      customer: true,
      payment: {
        where: {
          paidAt: { gte: start, lte: end },
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      saleitem: { include: { product: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const activityData = salesWithPayments.map(sale => {
    const totalPaidInPeriod = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const totalPaidOverall = sale.payment.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = sale.amount - totalPaidOverall;
    const productsString = getProductsString(sale);
    
    return {
      'Sale ID': sale.id,
      'Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Products Taken': productsString,
      'Original Amount': formatCurrency(sale.amount),
      'Paid in Period': formatCurrency(totalPaidInPeriod),
      'Total Paid Overall': formatCurrency(totalPaidOverall),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Status': sale.status,
      'Payments Count': sale.payment.length,
      'Last Updated': formatDateTime(sale.updatedAt),
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A'
    };
  });

  const totalPaidInPeriod = activityData.reduce((sum, d) => sum + parseFloat(d['Paid in Period'] as string), 0);
  const totalSalesUpdated = activityData.length;

  const summaryRows = [
    {
      'Sale ID': '--- SUMMARY ---', 'Sale Date': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Original Amount': '', 'Paid in Period': '', 'Total Paid Overall': '',
      'Remaining Balance': '', 'Status': '', 'Payments Count': '', 'Last Updated': '',
      'Created By': '', 'Updated By': ''
    },
    {
      'Sale ID': 'TOTAL', 'Sale Date': '', 'Customer Name': '', 'Customer Phone': '',
      'Products Taken': '', 'Original Amount': '', 'Paid in Period': formatCurrency(totalPaidInPeriod),
      'Total Paid Overall': '', 'Remaining Balance': '', 'Status': '',
      'Payments Count': totalSalesUpdated, 'Last Updated': '', 'Created By': '', 'Updated By': ''
    }
  ];

  const finalData = [...activityData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  const periodLabel = period === 'daily' ? 'day' : period;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payment-activity-${periodLabel}-${formatDate(start)}.csv"`,
    }
  });
}

// ==================== POST ENDPOINTS ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'record-payment':
        return await recordPayment(data);
      case 'bulk-payment-report':
        return await generateBulkPaymentReport(data);
      case 'payment-trends':
        return await generatePaymentTrends(data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to process request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function recordPayment(data: any) {
  const { saleId, amount, method, note, referenceId, bankName, checkNumber, recordedBy } = data;
  
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { payment: true }
  });

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
  }

  const totalPaidSoFar = sale.payment.reduce((sum, p) => sum + p.amount, 0);
  const newTotalPaid = totalPaidSoFar + amount;
  const newStatus = newTotalPaid >= sale.amount ? 'PAID' : 'PARTIAL';

  const payment = await prisma.payment.create({
    data: {
      saleId,
      amount,
      method,
      note,
      referenceId,
      bankName,
      checkNumber,
      status: 'COMPLETED',
      paidAt: new Date()
    }
  });

  await prisma.sale.update({
    where: { id: saleId },
    data: { 
      status: newStatus,
      updatedAt: new Date(),
      updatedBy: recordedBy
    }
  });

  try {
    await prisma.saleauditlog.create({
      data: {
        saleId,
        action: 'PAYMENT',
        fieldName: 'amount',
        oldValue: JSON.stringify({ totalPaid: totalPaidSoFar }),
        newValue: JSON.stringify({ paymentAmount: amount, totalPaid: newTotalPaid }),
        difference: `Payment of ${formatCurrency(amount)} received. New status: ${newStatus}`,
        changedBy: recordedBy || 'system',
        changedAt: new Date()
      }
    });
  } catch (auditError) {
    console.warn('Audit log creation failed:', auditError);
  }

  return NextResponse.json({
    success: true,
    payment,
    newStatus,
    remainingBalance: sale.amount - newTotalPaid
  });
}

async function generateBulkPaymentReport(data: any) {
  const { customerIds, startDate, endDate } = data;
  
  const start = ensureDate(startDate);
  const end = ensureDate(endDate);
  
  const payments = await prisma.payment.findMany({
    where: {
      sale: {
        customerId: { in: customerIds?.map(Number) },
      },
      paidAt: { gte: startOfDay(start), lte: endOfDay(end) },
      status: { in: ['CLEARED', 'COMPLETED'] }
    },
    include: {
      sale: { 
        include: { 
          customer: true,
          saleitem: {
            include: {
              product: true
            }
          }
        } 
      }
    },
    orderBy: { paidAt: 'asc' }
  });

  const reportData = payments.map(payment => {
    const productsString = getProductsString(payment.sale);
    
    return {
      'Date': formatDate(payment.paidAt),
      'Time': formatTime(payment.paidAt),
      'Customer': payment.sale.customer.name,
      'Sale ID': payment.saleId,
      'Products': productsString,
      'Amount': formatCurrency(payment.amount),
      'Method': payment.method
    };
  });

  const csv = arrayToCSV(reportData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bulk-payments-${formatDate(start)}-to-${formatDate(end)}.csv"`,
    }
  });
}

async function generatePaymentTrends(data: any) {
  const { months = 6, asOfDate } = data;
  const endDate = ensureDate(asOfDate);
  const startDate = new Date(endDate);
  startDate.setMonth(endDate.getMonth() - months);

  const monthlyData = [];
  
  for (let i = 0; i < months; i++) {
    const monthStart = new Date(startDate);
    monthStart.setMonth(startDate.getMonth() + i);
    const monthEnd = endOfMonth(monthStart);
    
    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: startOfMonth(monthStart), lte: monthEnd },
        status: { in: ['CLEARED', 'COMPLETED'] }
      },
      include: {
        sale: { include: { customer: true } }
      }
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const uniqueCustomers = new Set(payments.map(p => p.sale.customerId)).size;
    
    monthlyData.push({
      'Month': formatDate(monthStart).substring(0, 7),
      'Total Payments': formatCurrency(totalAmount),
      'Payment Count': payments.length,
      'Unique Customers': uniqueCustomers,
      'Average Payment': formatCurrency(payments.length > 0 ? totalAmount / payments.length : 0)
    });
  }

  const csv = arrayToCSV(monthlyData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payment-trends-${months}-months.csv"`,
    }
  });
}