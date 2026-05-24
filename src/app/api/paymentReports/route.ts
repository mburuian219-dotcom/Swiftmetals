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

// Helper to calculate actual sale status based on payments
const calculateActualSaleStatus = (sale: any): string => {
  let totalPaid = 0;
  for (const p of sale.payment || []) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      totalPaid += p.amount;
    }
  }
  
  if (totalPaid >= sale.amount) {
    return 'PAID';
  } else if (totalPaid > 0) {
    return 'PARTIAL';
  } else {
    return 'UNPAID';
  }
};

// Helper to get products string from sale
const getProductsString = (sale: any): string => {
  if (!sale.saleitem || sale.saleitem.length === 0) {
    return 'Debt record (no products)';
  }
  
  const productStrings: string[] = [];
  for (const item of sale.saleitem) {
    const productName = item.product?.name || `Product ID: ${item.productId}`;
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    productStrings.push(`${productName} (${quantity} x KSh ${formatCurrency(price)})`);
  }
  
  return productStrings.join('; ');
};

// Helper to get payment method string (handles unpaid sales)
const getPaymentMethodString = (sale: any): string => {
  if (!sale.payment || sale.payment.length === 0) {
    return '-';
  }
  
  const methods: string[] = [];
  for (const p of sale.payment) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      if (!methods.includes(p.method)) {
        methods.push(p.method);
      }
    }
  }
  
  if (methods.length === 0) {
    return '-';
  }
  
  if (methods.length > 1) {
    return methods.join('/');
  }
  
  return methods[0];
};

// Helper to get total paid amount
const getTotalPaid = (sale: any): number => {
  let total = 0;
  for (const p of sale.payment || []) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      total += p.amount;
    }
  }
  return total;
};

// Helper to get payment methods summary
const getPaymentMethodsSummary = (sale: any): string => {
  if (!sale.payment || sale.payment.length === 0) {
    return 'No payment';
  }
  
  const summaries: string[] = [];
  for (const p of sale.payment) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      summaries.push(`${p.method}: KSh ${formatCurrency(p.amount)}`);
    }
  }
  return summaries.length > 0 ? summaries.join('; ') : 'No cleared payments';
};

// Helper to get assigned staff name
const getAssignedStaffName = (sale: any): string => {
  if (!sale.assignedStaff) {
    return '-';
  }
  return sale.assignedStaff.name || '-';
};

// Helper to get assigned staff phone
const getAssignedStaffPhone = (sale: any): string => {
  if (!sale.assignedStaff) {
    return '-';
  }
  return sale.assignedStaff.phone || '-';
};

// Helper to get assigned staff email
const getAssignedStaffEmail = (sale: any): string => {
  if (!sale.assignedStaff) {
    return '-';
  }
  return sale.assignedStaff.email || '-';
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

  const sales = await prisma.sale.findMany({
    where: {
      date: { gte: startDateObj, lte: endDateObj },
      isDeleted: false
    },
    include: {
      customer: true,
      payment: {
        where: {
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      saleitem: {
        include: {
          product: true
        }
      },
      assignedStaff: true  // Include assigned staff
    },
    orderBy: { date: 'asc' }
  });

  const transactionData = [];
  for (const sale of sales) {
    const totalPaid = getTotalPaid(sale);
    const actualStatus = calculateActualSaleStatus(sale);
    const remainingBalance = sale.amount - totalPaid;
    const productsString = getProductsString(sale);
    const paymentMethod = getPaymentMethodString(sale);
    
    transactionData.push({
      'Date': formatDate(sale.date),
      'Time': formatTime(sale.date),
      'Sale ID': sale.id,
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(sale.amount),
      'Total Paid': formatCurrency(totalPaid),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': actualStatus,
      'Payment Method': paymentMethod,
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A',
      'Last Updated': sale.updatedAt ? formatDateTime(sale.updatedAt) : formatDateTime(sale.date)
    });
  }

  let totalSales = 0;
  let totalPayments = 0;
  const uniqueCustomersSet = new Set<number>();
  let unpaidSales = 0;
  let partialSales = 0;
  let paidSales = 0;

  for (const sale of sales) {
    totalSales += sale.amount;
    const totalPaid = getTotalPaid(sale);
    totalPayments += totalPaid;
    const actualStatus = calculateActualSaleStatus(sale);
    
    if (sale.customer?.id) uniqueCustomersSet.add(sale.customer.id);
    if (actualStatus === 'UNPAID') unpaidSales++;
    else if (actualStatus === 'PARTIAL') partialSales++;
    else if (actualStatus === 'PAID') paidSales++;
  }
  
  const uniqueCustomers = uniqueCustomersSet.size;

  const summaryRows = [
    {
      'Date': '--- SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES VALUE', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalSales), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS RECEIVED', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': formatCurrency(totalPayments), 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNPAID SALES', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': unpaidSales.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'PARTIAL SALES', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': partialSales.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'PAID SALES', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': paidSales.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': uniqueCustomers.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES COUNT', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': sales.length.toString(), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
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

  const sales = await prisma.sale.findMany({
    where: {
      date: { gte: startDateObj, lte: endDateObj },
      isDeleted: false
    },
    include: {
      customer: true,
      payment: {
        where: {
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      saleitem: {
        include: {
          product: true
        }
      },
      assignedStaff: true  // Include assigned staff
    },
    orderBy: { date: 'asc' }
  });

  const salesData = [];
  for (const sale of sales) {
    const totalPaid = getTotalPaid(sale);
    const actualStatus = calculateActualSaleStatus(sale);
    const remainingBalance = sale.amount - totalPaid;
    const productsString = getProductsString(sale);
    const paymentMethod = getPaymentMethodString(sale);
    
    salesData.push({
      'Date': formatDate(sale.date),
      'Time': formatTime(sale.date),
      'Sale ID': sale.id,
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(sale.amount),
      'Total Paid': formatCurrency(totalPaid),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': actualStatus,
      'Payment Method': paymentMethod,
      'Payments Summary': getPaymentMethodsSummary(sale),
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A',
      'Last Updated': sale.updatedAt ? formatDateTime(sale.updatedAt) : formatDateTime(sale.date)
    });
  }

  let totalSales = 0;
  let totalPayments = 0;
  const uniqueCustomersSet = new Set<number>();
  let unpaidSales = 0;

  for (const sale of sales) {
    totalSales += sale.amount;
    const totalPaid = getTotalPaid(sale);
    totalPayments += totalPaid;
    const actualStatus = calculateActualSaleStatus(sale);
    
    if (sale.customer?.id) uniqueCustomersSet.add(sale.customer.id);
    if (actualStatus === 'UNPAID') unpaidSales++;
  }
  
  const uniqueCustomers = uniqueCustomersSet.size;

  const summaryRows = [
    {
      'Date': '--- WEEKLY SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': `Week: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES VALUE', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalSales), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': formatCurrency(totalPayments), 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNPAID SALES', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': unpaidSales.toString(),
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': uniqueCustomers.toString(),
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES COUNT', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': sales.length.toString(), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Payments Summary': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...salesData, ...summaryRows];
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

  const sales = await prisma.sale.findMany({
    where: {
      date: { gte: startDateObj, lte: endDateObj },
      isDeleted: false
    },
    include: {
      customer: true,
      payment: {
        where: {
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      saleitem: {
        include: {
          product: true
        }
      },
      assignedStaff: true  // Include assigned staff
    },
    orderBy: { date: 'asc' }
  });

  const salesData = [];
  for (const sale of sales) {
    const totalPaid = getTotalPaid(sale);
    const actualStatus = calculateActualSaleStatus(sale);
    const remainingBalance = sale.amount - totalPaid;
    const productsString = getProductsString(sale);
    const paymentMethod = getPaymentMethodString(sale);
    
    salesData.push({
      'Date': formatDate(sale.date),
      'Time': formatTime(sale.date),
      'Sale ID': sale.id,
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products Taken': productsString,
      'Total Sale Amount': formatCurrency(sale.amount),
      'Total Paid': formatCurrency(totalPaid),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Payment Status': actualStatus,
      'Payment Method': paymentMethod,
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A',
      'Last Updated': sale.updatedAt ? formatDateTime(sale.updatedAt) : formatDateTime(sale.date)
    });
  }

  let totalSales = 0;
  let totalPayments = 0;
  const uniqueCustomersSet = new Set<number>();
  let unpaidSales = 0;

  for (const sale of sales) {
    totalSales += sale.amount;
    const totalPaid = getTotalPaid(sale);
    totalPayments += totalPaid;
    const actualStatus = calculateActualSaleStatus(sale);
    
    if (sale.customer?.id) uniqueCustomersSet.add(sale.customer.id);
    if (actualStatus === 'UNPAID') unpaidSales++;
  }
  
  const uniqueCustomers = uniqueCustomersSet.size;

  const summaryRows = [
    {
      'Date': '--- MONTHLY SUMMARY ---', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': `Month: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES VALUE', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': formatCurrency(totalSales), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL PAYMENTS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': formatCurrency(totalPayments), 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNPAID SALES', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': unpaidSales.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'UNIQUE CUSTOMERS', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': '', 'Total Paid': '', 'Remaining Balance': uniqueCustomers.toString(),
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    },
    {
      'Date': 'TOTAL SALES COUNT', 'Time': '', 'Sale ID': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Total Sale Amount': sales.length.toString(), 'Total Paid': '', 'Remaining Balance': '',
      'Payment Status': '', 'Payment Method': '', 'Created By': '', 'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...salesData, ...summaryRows];
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
      payment: {
        where: {
          status: { in: ['CLEARED', 'COMPLETED'] }
        },
        orderBy: { paidAt: 'asc' }
      },
      customer: true,
      saleitem: {
        include: {
          product: true
        }
      },
      assignedStaff: true  // Include assigned staff
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
    const actualStatus = calculateActualSaleStatus(sale);
    
    runningBalance += sale.amount;
    transactions.push({
      'Date': formatDate(sale.date),
      'Type': 'SALE (CREDIT)',
      'Sale ID': sale.id,
      'Products': productsString,
      'Assigned Staff': getAssignedStaffName(sale),
      'Debit': formatCurrency(sale.amount),
      'Credit': '0.00',
      'Running Balance': formatCurrency(runningBalance),
      'Status': actualStatus,
      'Payment Method': '-'
    });

    for (const payment of sale.payment) {
      runningBalance -= payment.amount;
      const newStatus = runningBalance === 0 ? 'PAID' : (runningBalance > 0 ? 'PARTIAL' : 'OVERPAID');
      transactions.push({
        'Date': formatDate(payment.paidAt),
        'Type': 'PAYMENT',
        'Sale ID': sale.id,
        'Products': `Payment via ${payment.method}`,
        'Assigned Staff': getAssignedStaffName(sale),
        'Debit': '0.00',
        'Credit': formatCurrency(payment.amount),
        'Running Balance': formatCurrency(runningBalance),
        'Status': newStatus,
        'Payment Method': payment.method
      });
    }
  }

  let totalCredit = 0;
  let totalPayments = 0;
  for (const sale of sales) {
    totalCredit += sale.amount;
    totalPayments += getTotalPaid(sale);
  }
  const outstandingBalance = totalCredit - totalPayments;

  transactions.push(
    {
      'Date': '--- SUMMARY ---', 'Type': '', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit': '', 'Credit': '', 'Running Balance': '', 'Status': '', 'Payment Method': ''
    },
    {
      'Date': '', 'Type': 'TOTAL CREDIT', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit': formatCurrency(totalCredit), 'Credit': '', 'Running Balance': '', 'Status': '', 'Payment Method': ''
    },
    {
      'Date': '', 'Type': 'TOTAL PAYMENTS', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit': '', 'Credit': formatCurrency(totalPayments), 'Running Balance': '', 'Status': '', 'Payment Method': ''
    },
    {
      'Date': '', 'Type': 'OUTSTANDING BALANCE', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit': '', 'Credit': '', 'Running Balance': formatCurrency(outstandingBalance),
      'Status': outstandingBalance === 0 ? 'CLEARED' : 'PENDING', 'Payment Method': ''
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
      isDeleted: false,
      date: { lte: endOfAsOfDate }
    },
    include: {
      customer: true,
      payment: {
        where: {
          status: { in: ['CLEARED', 'COMPLETED'] }
        }
      },
      paymentschedule: true,
      saleitem: {
        include: {
          product: true
        }
      },
      assignedStaff: true  // Include assigned staff
    },
    orderBy: [
      { customer: { name: 'asc' } },
      { date: 'asc' }
    ]
  });

  // Filter to only unpaid and partial sales based on actual payments
  const unpaidPartialSales = sales.filter(sale => {
    const totalPaid = getTotalPaid(sale);
    const remaining = sale.amount - totalPaid;
    return remaining > 0;
  });

  const outstandingData = [];
  for (const sale of unpaidPartialSales) {
    const totalPaid = getTotalPaid(sale);
    const currentBalance = sale.amount - totalPaid;
    const actualStatus = calculateActualSaleStatus(sale);
    const nextPaymentDue = sale.paymentschedule.find(ps => !ps.isPaid);
    const productsString = getProductsString(sale);
    const paymentMethod = getPaymentMethodString(sale);
    
    let daysOverdue = 0;
    if (sale.dueDate) {
      const dueDate = new Date(sale.dueDate);
      if (dueDate < asOfDate) {
        daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
      }
    }
    
    let lastPaymentDate = 'No payments';
    let lastPaymentMethod = '-';
    if (sale.payment.length > 0) {
      let latestPayment = sale.payment[0];
      for (const p of sale.payment) {
        if (p.paidAt > latestPayment.paidAt) {
          latestPayment = p;
        }
      }
      lastPaymentDate = formatDate(latestPayment.paidAt);
      lastPaymentMethod = latestPayment.method;
    }
    
    outstandingData.push({
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Sale ID': sale.id,
      'Sale Date': formatDate(sale.date),
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products Taken': productsString,
      'Original Amount': formatCurrency(sale.amount),
      'Total Paid': formatCurrency(totalPaid),
      'Outstanding Balance': formatCurrency(currentBalance),
      'Status': actualStatus,
      'Payment Method': paymentMethod,
      'Due Date': sale.dueDate ? formatDate(sale.dueDate) : 'N/A',
      'Next Payment Due': nextPaymentDue ? formatDate(nextPaymentDue.dueDate) : 'N/A',
      'Days Overdue': daysOverdue,
      'Last Payment Date': lastPaymentDate,
      'Last Payment Method': lastPaymentMethod,
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A'
    });
  }

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  
  for (const d of outstandingData) {
    const outstanding = parseFloat(d['Outstanding Balance'] as string);
    totalOutstanding += outstanding;
    if (d['Days Overdue'] > 0) {
      totalOverdue += outstanding;
      overdueCount++;
    }
  }

  const summaryRows = [
    {
      'Customer Name': '--- SUMMARY ---', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': '',
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Method': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': 'TOTAL OUTSTANDING', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': formatCurrency(totalOutstanding),
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Method': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': 'OVERDUE AMOUNT', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': formatCurrency(totalOverdue),
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Method': '', 'Created By': '', 'Updated By': ''
    },
    {
      'Customer Name': `Overdue Accounts: ${overdueCount}`, 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Total Paid': '', 'Outstanding Balance': '',
      'Status': '', 'Payment Method': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Method': '', 'Created By': '', 'Updated By': ''
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
      saleitem: { include: { product: true } },
      assignedStaff: true  // Include assigned staff
    },
    orderBy: { updatedAt: 'desc' }
  });

  const activityData = [];
  for (const sale of salesWithPayments) {
    let totalPaidInPeriod = 0;
    for (const p of sale.payment) {
      totalPaidInPeriod += p.amount;
    }
    const totalPaidOverall = getTotalPaid(sale);
    const remainingBalance = sale.amount - totalPaidOverall;
    const actualStatus = calculateActualSaleStatus(sale);
    const productsString = getProductsString(sale);
    const paymentMethod = getPaymentMethodString(sale);
    
    activityData.push({
      'Sale ID': sale.id,
      'Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products Taken': productsString,
      'Original Amount': formatCurrency(sale.amount),
      'Paid in Period': formatCurrency(totalPaidInPeriod),
      'Total Paid Overall': formatCurrency(totalPaidOverall),
      'Remaining Balance': formatCurrency(remainingBalance),
      'Status': actualStatus,
      'Payment Method': paymentMethod,
      'Payments Count': sale.payment.length,
      'Last Updated': formatDateTime(sale.updatedAt),
      'Created By': sale.createdBy || 'N/A',
      'Updated By': sale.updatedBy || 'N/A'
    });
  }

  let totalPaidInPeriod = 0;
  for (const d of activityData) {
    totalPaidInPeriod += parseFloat(d['Paid in Period'] as string);
  }
  const totalSalesUpdated = activityData.length;

  const summaryRows = [
    {
      'Sale ID': '--- SUMMARY ---', 'Sale Date': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Paid in Period': '', 'Total Paid Overall': '',
      'Remaining Balance': '', 'Status': '', 'Payment Method': '', 'Payments Count': '', 'Last Updated': '',
      'Created By': '', 'Updated By': ''
    },
    {
      'Sale ID': 'TOTAL', 'Sale Date': '', 'Customer Name': '', 'Customer Phone': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products Taken': '', 'Original Amount': '', 'Paid in Period': formatCurrency(totalPaidInPeriod),
      'Total Paid Overall': '', 'Remaining Balance': '', 'Status': '',
      'Payment Method': '', 'Payments Count': totalSalesUpdated, 'Last Updated': '', 'Created By': '', 'Updated By': ''
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

  let totalPaidSoFar = 0;
  for (const p of sale.payment) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      totalPaidSoFar += p.amount;
    }
  }
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
          },
          assignedStaff: true  // Include assigned staff
        } 
      }
    },
    orderBy: { paidAt: 'asc' }
  });

  const reportData = [];
  for (const payment of payments) {
    const productsString = getProductsString(payment.sale);
    
    reportData.push({
      'Date': formatDate(payment.paidAt),
      'Time': formatTime(payment.paidAt),
      'Customer': payment.sale.customer.name,
      'Customer Phone': payment.sale.customer.phone || '',
      'Assigned Staff': getAssignedStaffName(payment.sale),
      'Sale ID': payment.saleId,
      'Products': productsString,
      'Amount': formatCurrency(payment.amount),
      'Method': payment.method
    });
  }

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
        sale: { 
          include: { 
            customer: true,
            assignedStaff: true  // Include assigned staff
          } 
        }
      }
    });

    let totalAmount = 0;
    for (const p of payments) {
      totalAmount += p.amount;
    }
    const uniqueCustomersSet = new Set<number>();
    const uniqueStaffSet = new Set<number>();
    for (const p of payments) {
      if (p.sale.customerId) uniqueCustomersSet.add(p.sale.customerId);
      if (p.sale.assignedStaffId) uniqueStaffSet.add(p.sale.assignedStaffId);
    }
    const uniqueCustomers = uniqueCustomersSet.size;
    const uniqueStaff = uniqueStaffSet.size;
    
    monthlyData.push({
      'Month': formatDate(monthStart).substring(0, 7),
      'Total Payments': formatCurrency(totalAmount),
      'Payment Count': payments.length,
      'Unique Customers': uniqueCustomers,
      'Unique Staff Involved': uniqueStaff,
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