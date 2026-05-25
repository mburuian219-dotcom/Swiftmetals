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

// Helper to calculate actual sale status based on remaining amount
const calculateSaleStatus = (sale: any): string => {
  const totalPaid = getTotalPaid(sale);
  const remainingBalance = sale.amount - totalPaid;
  
  if (remainingBalance <= 0.01) {
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
    return 'No products';
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

// Helper to get payment methods summary
const getPaymentMethodsSummary = (sale: any): string => {
  if (!sale.payment || sale.payment.length === 0) {
    return 'No payments';
  }
  
  const summaries: string[] = [];
  for (const p of sale.payment) {
    if (p.status === 'CLEARED' || p.status === 'COMPLETED') {
      summaries.push(`${p.method}: KSh ${formatCurrency(p.amount)}`);
    }
  }
  return summaries.length > 0 ? summaries.join('; ') : 'No cleared payments';
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

// Helper to get payments made during a period
const getPaymentsInPeriod = (sale: any, startDate: Date, endDate: Date): any[] => {
  if (!sale.payment || sale.payment.length === 0) return [];
  return sale.payment.filter((p: any) => {
    const paymentDate = new Date(p.paidAt);
    return paymentDate >= startDate && paymentDate <= endDate &&
      (p.status === 'CLEARED' || p.status === 'COMPLETED');
  });
};

// Helper to get total paid during a period
const getTotalPaidInPeriod = (sale: any, startDate: Date, endDate: Date): number => {
  const paymentsInPeriod = getPaymentsInPeriod(sale, startDate, endDate);
  let total = 0;
  for (const p of paymentsInPeriod) {
    total += p.amount;
  }
  return total;
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
        return await generateDailyActivityReport(date);
      case 'weekly':
        return await generateWeeklyActivityReport(startDate, endDate);
      case 'monthly':
        return await generateMonthlyActivityReport(startDate, endDate);
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

// ==================== DAILY ACTIVITY REPORT ====================

async function generateDailyActivityReport(dateParam: string | null) {
  const targetDate = ensureDate(dateParam);
  const startDateObj = startOfDay(targetDate);
  const endDateObj = endOfDay(targetDate);

  // Fetch ALL sales that were UPDATED on this day (any activity: payment, edit, status change)
  const sales = await prisma.sale.findMany({
    where: {
      updatedAt: { gte: startDateObj, lte: endDateObj },
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
      assignedStaff: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  const transactionData = [];
  for (const sale of sales) {
    const totalPaidOverall = getTotalPaid(sale);
    const remainingBalance = sale.amount - totalPaidOverall;
    const status = calculateSaleStatus(sale);
    const paidInPeriod = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    const paymentsInPeriod = getPaymentsInPeriod(sale, startDateObj, endDateObj);
    const productsString = getProductsString(sale);
    
    // Determine activity type
    let activityType = 'Updated';
    if (paymentsInPeriod.length > 0) {
      activityType = 'Payment Received';
    } else if (status === 'PAID') {
      activityType = 'Marked as Paid';
    } else if (sale.status !== status) {
      activityType = 'Status Changed';
    }
    
    transactionData.push({
      'Update Date': formatDate(sale.updatedAt),
      'Update Time': formatTime(sale.updatedAt),
      'Sale ID': sale.id,
      'Original Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products': productsString,
      'Total Sale Amount (KSh)': formatCurrency(sale.amount),
      'Total Paid Overall (KSh)': formatCurrency(totalPaidOverall),
      'Remaining Balance (KSh)': formatCurrency(remainingBalance),
      'Payment Status': status,
      'Activity Type': activityType,
      'Payments Today (KSh)': paidInPeriod > 0 ? formatCurrency(paidInPeriod) : '-',
      'Payment Methods': getPaymentMethodsSummary(sale),
      'Updated By': sale.updatedBy || 'N/A',
      'Last Updated': formatDateTime(sale.updatedAt)
    });
  }

  // Calculate summary statistics
  let totalSalesValue = 0;
  let totalPaymentsOverall = 0;
  let totalPaymentsToday = 0;
  let paidSales = 0;
  let partialSales = 0;
  let unpaidSales = 0;
  const uniqueCustomersSet = new Set<number>();
  let paymentActivityCount = 0;

  for (const sale of sales) {
    totalSalesValue += sale.amount;
    const totalPaid = getTotalPaid(sale);
    totalPaymentsOverall += totalPaid;
    const paidToday = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    totalPaymentsToday += paidToday;
    
    if (paidToday > 0) paymentActivityCount++;
    
    if (sale.customer?.id) uniqueCustomersSet.add(sale.customer.id);
    
    const status = calculateSaleStatus(sale);
    if (status === 'PAID') paidSales++;
    else if (status === 'PARTIAL') partialSales++;
    else unpaidSales++;
  }
  
  const uniqueCustomers = uniqueCustomersSet.size;
  const totalRemaining = totalSalesValue - totalPaymentsOverall;

  const summaryRows = [
    {
      'Update Date': '--- DAILY ACTIVITY SUMMARY ---', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': `Report Date: ${formatDate(startDateObj)}`, 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'SALES UPDATED TODAY', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': sales.length.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'TOTAL SALE VALUE', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': formatCurrency(totalSalesValue), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'TOTAL PAID (OVERALL)', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': formatCurrency(totalPaymentsOverall), 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'PAYMENTS RECEIVED TODAY', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': formatCurrency(totalPaymentsToday), 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'TOTAL REMAINING BALANCE', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': formatCurrency(totalRemaining),
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'PAID SALES', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': paidSales.toString(),
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'PARTIAL SALES', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': partialSales.toString(),
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'UNPAID SALES', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': unpaidSales.toString(),
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'UNIQUE CUSTOMERS', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': uniqueCustomers.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    },
    {
      'Update Date': 'SALES WITH PAYMENT TODAY', 'Update Time': '', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Total Sale Amount (KSh)': paymentActivityCount.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Payment Status': '', 'Activity Type': '', 'Payments Today (KSh)': '', 'Payment Methods': '',
      'Updated By': '', 'Last Updated': ''
    }
  ];

  const finalData = [...transactionData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="daily-activity-${formatDate(targetDate)}.csv"`,
    }
  });
}

// ==================== WEEKLY ACTIVITY REPORT ====================

async function generateWeeklyActivityReport(startDateParam: string | null, endDateParam: string | null) {
  const startDateObj = startDateParam ? startOfDay(ensureDate(startDateParam)) : startOfWeek(new Date());
  const endDateObj = endDateParam ? endOfDay(ensureDate(endDateParam)) : endOfWeek(new Date());

  // Fetch ALL sales that were UPDATED during this week
  const sales = await prisma.sale.findMany({
    where: {
      updatedAt: { gte: startDateObj, lte: endDateObj },
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
      assignedStaff: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  const salesData = [];
  for (const sale of sales) {
    const totalPaidOverall = getTotalPaid(sale);
    const remainingBalance = sale.amount - totalPaidOverall;
    const status = calculateSaleStatus(sale);
    const paidInPeriod = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    const productsString = getProductsString(sale);
    
    salesData.push({
      'Last Updated': formatDateTime(sale.updatedAt),
      'Sale ID': sale.id,
      'Original Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Products': productsString,
      'Total Amount (KSh)': formatCurrency(sale.amount),
      'Total Paid (KSh)': formatCurrency(totalPaidOverall),
      'Remaining Balance (KSh)': formatCurrency(remainingBalance),
      'Status': status,
      'Paid This Week (KSh)': paidInPeriod > 0 ? formatCurrency(paidInPeriod) : '-',
      'Payment Methods': getPaymentMethodsSummary(sale),
      'Updated By': sale.updatedBy || 'N/A'
    });
  }

  // Calculate summary statistics
  let totalPaidThisWeek = 0;
  let totalSalesValue = 0;
  let paidSales = 0;
  let partialSales = 0;
  let unpaidSales = 0;
  let paymentActivityCount = 0;
  
  for (const sale of sales) {
    totalSalesValue += sale.amount;
    const paidInPeriod = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    totalPaidThisWeek += paidInPeriod;
    if (paidInPeriod > 0) paymentActivityCount++;
    
    const status = calculateSaleStatus(sale);
    if (status === 'PAID') paidSales++;
    else if (status === 'PARTIAL') partialSales++;
    else unpaidSales++;
  }

  const summaryRows = [
    {
      'Last Updated': '--- WEEKLY ACTIVITY SUMMARY ---', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': `Week: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'SALES WITH ACTIVITY', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': sales.length.toString(), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'TOTAL SALE VALUE', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': formatCurrency(totalSalesValue), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PAYMENTS RECEIVED', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': formatCurrency(totalPaidThisWeek), 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': paidSales.toString(),
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PARTIAL SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': partialSales.toString(),
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'UNPAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': unpaidSales.toString(),
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'SALES WITH PAYMENTS', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': paymentActivityCount.toString(), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Week (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    }
  ];

  const finalData = [...salesData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="weekly-activity-${formatDate(startDateObj)}-to-${formatDate(endDateObj)}.csv"`,
    }
  });
}

// ==================== MONTHLY ACTIVITY REPORT ====================

async function generateMonthlyActivityReport(startDateParam: string | null, endDateParam: string | null) {
  const startDateObj = startDateParam ? startOfDay(ensureDate(startDateParam)) : startOfMonth(new Date());
  const endDateObj = endDateParam ? endOfDay(ensureDate(endDateParam)) : endOfMonth(new Date());

  // Fetch ALL sales that were UPDATED during this month
  const sales = await prisma.sale.findMany({
    where: {
      updatedAt: { gte: startDateObj, lte: endDateObj },
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
      assignedStaff: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  const salesData = [];
  for (const sale of sales) {
    const totalPaidOverall = getTotalPaid(sale);
    const remainingBalance = sale.amount - totalPaidOverall;
    const status = calculateSaleStatus(sale);
    const paidInPeriod = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    const productsString = getProductsString(sale);
    
    salesData.push({
      'Last Updated': formatDateTime(sale.updatedAt),
      'Sale ID': sale.id,
      'Original Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer?.name || 'Unknown',
      'Customer Phone': sale.customer?.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Products': productsString,
      'Total Amount (KSh)': formatCurrency(sale.amount),
      'Total Paid (KSh)': formatCurrency(totalPaidOverall),
      'Remaining Balance (KSh)': formatCurrency(remainingBalance),
      'Status': status,
      'Paid This Month (KSh)': paidInPeriod > 0 ? formatCurrency(paidInPeriod) : '-',
      'Payment Methods': getPaymentMethodsSummary(sale),
      'Updated By': sale.updatedBy || 'N/A'
    });
  }

  // Calculate summary statistics
  let totalPaidThisMonth = 0;
  let totalSalesValue = 0;
  let paidSales = 0;
  let partialSales = 0;
  let unpaidSales = 0;
  let paymentActivityCount = 0;
  
  for (const sale of sales) {
    totalSalesValue += sale.amount;
    const paidInPeriod = getTotalPaidInPeriod(sale, startDateObj, endDateObj);
    totalPaidThisMonth += paidInPeriod;
    if (paidInPeriod > 0) paymentActivityCount++;
    
    const status = calculateSaleStatus(sale);
    if (status === 'PAID') paidSales++;
    else if (status === 'PARTIAL') partialSales++;
    else unpaidSales++;
  }

  const summaryRows = [
    {
      'Last Updated': '--- MONTHLY ACTIVITY SUMMARY ---', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': `Month: ${formatDate(startDateObj)} to ${formatDate(endDateObj)}`, 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'SALES WITH ACTIVITY', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': sales.length.toString(), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'TOTAL SALE VALUE', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': formatCurrency(totalSalesValue), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PAYMENTS RECEIVED', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': formatCurrency(totalPaidThisMonth), 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': paidSales.toString(),
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'PARTIAL SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': partialSales.toString(),
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'UNPAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': '', 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': unpaidSales.toString(),
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    },
    {
      'Last Updated': 'SALES WITH PAYMENTS', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Total Amount (KSh)': paymentActivityCount.toString(), 'Total Paid (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Paid This Month (KSh)': '', 'Payment Methods': '', 'Updated By': ''
    }
  ];

  const finalData = [...salesData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="monthly-activity-${formatDate(startDateObj)}-to-${formatDate(endDateObj)}.csv"`,
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
      assignedStaff: true
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
    const status = calculateSaleStatus(sale);
    
    runningBalance += sale.amount;
    transactions.push({
      'Date': formatDate(sale.date),
      'Type': 'SALE (DEBIT)',
      'Sale ID': sale.id,
      'Products': productsString,
      'Assigned Staff': getAssignedStaffName(sale),
      'Debit (KSh)': formatCurrency(sale.amount),
      'Credit (KSh)': '0.00',
      'Running Balance (KSh)': formatCurrency(runningBalance),
      'Status': status
    });

    for (const payment of sale.payment) {
      runningBalance -= payment.amount;
      const newStatus = runningBalance === 0 ? 'PAID' : (runningBalance > 0 ? 'PARTIAL' : 'OVERPAID');
      transactions.push({
        'Date': formatDate(payment.paidAt),
        'Type': 'PAYMENT (CREDIT)',
        'Sale ID': sale.id,
        'Products': `Payment via ${payment.method}`,
        'Assigned Staff': getAssignedStaffName(sale),
        'Debit (KSh)': '0.00',
        'Credit (KSh)': formatCurrency(payment.amount),
        'Running Balance (KSh)': formatCurrency(runningBalance),
        'Status': newStatus
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
      'Debit (KSh)': '', 'Credit (KSh)': '', 'Running Balance (KSh)': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'TOTAL PURCHASES', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit (KSh)': formatCurrency(totalCredit), 'Credit (KSh)': '', 'Running Balance (KSh)': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'TOTAL PAYMENTS', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit (KSh)': '', 'Credit (KSh)': formatCurrency(totalPayments), 'Running Balance (KSh)': '', 'Status': ''
    },
    {
      'Date': '', 'Type': 'OUTSTANDING BALANCE', 'Sale ID': '', 'Products': '', 'Assigned Staff': '',
      'Debit (KSh)': '', 'Credit (KSh)': '', 'Running Balance (KSh)': formatCurrency(outstandingBalance),
      'Status': outstandingBalance === 0 ? 'PAID' : (outstandingBalance > 0 ? 'PARTIAL' : 'OVERPAID')
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
      assignedStaff: true
    },
    orderBy: [
      { customer: { name: 'asc' } },
      { date: 'asc' }
    ]
  });

  // Filter to only unpaid and partial sales based on remaining balance
  const unpaidPartialSales = sales.filter(sale => {
    const totalPaid = getTotalPaid(sale);
    const remaining = sale.amount - totalPaid;
    return remaining > 0.01; // More than 1 cent remaining
  });

  const outstandingData = [];
  for (const sale of unpaidPartialSales) {
    const totalPaid = getTotalPaid(sale);
    const currentBalance = sale.amount - totalPaid;
    const status = calculateSaleStatus(sale);
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
    let lastPaymentMethod = '-';
    let lastPaymentAmount = 0;
    if (sale.payment.length > 0) {
      let latestPayment = sale.payment[0];
      for (const p of sale.payment) {
        if (p.paidAt > latestPayment.paidAt) {
          latestPayment = p;
        }
      }
      lastPaymentDate = formatDate(latestPayment.paidAt);
      lastPaymentMethod = latestPayment.method;
      lastPaymentAmount = latestPayment.amount;
    }
    
    outstandingData.push({
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Sale ID': sale.id,
      'Sale Date': formatDate(sale.date),
      'Assigned Staff': getAssignedStaffName(sale),
      'Staff Phone': getAssignedStaffPhone(sale),
      'Staff Email': getAssignedStaffEmail(sale),
      'Products': productsString,
      'Original Amount (KSh)': formatCurrency(sale.amount),
      'Total Paid (KSh)': formatCurrency(totalPaid),
      'Outstanding Balance (KSh)': formatCurrency(currentBalance),
      'Status': status,
      'Due Date': sale.dueDate ? formatDate(sale.dueDate) : 'N/A',
      'Next Payment Due': nextPaymentDue ? formatDate(nextPaymentDue.dueDate) : 'N/A',
      'Days Overdue': daysOverdue > 0 ? daysOverdue : 0,
      'Last Payment Date': lastPaymentDate,
      'Last Payment Amount (KSh)': lastPaymentAmount > 0 ? formatCurrency(lastPaymentAmount) : '-',
      'Last Payment Method': lastPaymentMethod,
      'Created By': sale.createdBy || 'N/A',
      'Last Updated By': sale.updatedBy || 'N/A',
      'Last Updated': formatDateTime(sale.updatedAt)
    });
  }

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  
  for (const d of outstandingData) {
    const outstanding = parseFloat(d['Outstanding Balance (KSh)'] as string);
    totalOutstanding += outstanding;
    if (d['Days Overdue'] > 0) {
      totalOverdue += outstanding;
      overdueCount++;
    }
    if (d['Status'] === 'PARTIAL') partialCount++;
    else if (d['Status'] === 'UNPAID') unpaidCount++;
  }

  const summaryRows = [
    {
      'Customer Name': '--- OUTSTANDING DEBTS SUMMARY ---', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': `Report Date: ${formatDate(asOfDate)}`, 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'OUTSTANDING ACCOUNTS', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': outstandingData.length.toString(), 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'TOTAL OUTSTANDING', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': formatCurrency(totalOutstanding),
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'OVERDUE AMOUNT', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': formatCurrency(totalOverdue),
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'OVERDUE ACCOUNTS', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': overdueCount.toString(), 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'PARTIAL PAYMENT ACCOUNTS', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': partialCount.toString(), 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
    },
    {
      'Customer Name': 'UNPAID ACCOUNTS', 'Customer Phone': '', 'Sale ID': '', 'Sale Date': '',
      'Assigned Staff': '', 'Staff Phone': '', 'Staff Email': '',
      'Products': '', 'Original Amount (KSh)': unpaidCount.toString(), 'Total Paid (KSh)': '', 'Outstanding Balance (KSh)': '',
      'Status': '', 'Due Date': '', 'Next Payment Due': '', 'Days Overdue': '',
      'Last Payment Date': '', 'Last Payment Amount (KSh)': '', 'Last Payment Method': '',
      'Created By': '', 'Last Updated By': '', 'Last Updated': ''
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
    default: // daily
      start = startOfDay(ensureDate(startDateParam));
      end = endOfDay(ensureDate(endDateParam || startDateParam));
  }

  // Fetch sales that had PAYMENT activity during the period
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
      assignedStaff: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  const activityData = [];
  for (const sale of salesWithPayments) {
    const totalPaidInPeriod = getTotalPaidInPeriod(sale, start, end);
    const totalPaidOverall = getTotalPaid(sale);
    const remainingBalance = sale.amount - totalPaidOverall;
    const status = calculateSaleStatus(sale);
    const productsString = getProductsString(sale);
    const paymentsInPeriod = getPaymentsInPeriod(sale, start, end);
    
    // Create payment details string
    const paymentDetails = paymentsInPeriod.map(p => 
      `${p.method}: KSh ${formatCurrency(p.amount)} on ${formatDate(p.paidAt)}`
    ).join('; ');
    
    activityData.push({
      'Payment Date': formatDate(paymentsInPeriod[0]?.paidAt || sale.updatedAt),
      'Sale ID': sale.id,
      'Original Sale Date': formatDate(sale.date),
      'Customer Name': sale.customer.name,
      'Customer Phone': sale.customer.phone || '',
      'Assigned Staff': getAssignedStaffName(sale),
      'Products': productsString,
      'Original Amount (KSh)': formatCurrency(sale.amount),
      'Total Paid Overall (KSh)': formatCurrency(totalPaidOverall),
      'Remaining Balance (KSh)': formatCurrency(remainingBalance),
      'Status': status,
      'Payments in Period (KSh)': formatCurrency(totalPaidInPeriod),
      'Payment Details': paymentDetails,
      'Updated By': sale.updatedBy || 'N/A'
    });
  }

  let totalPaidInPeriod = 0;
  let paidSales = 0;
  let partialSales = 0;
  let unpaidSales = 0;
  
  for (const d of activityData) {
    totalPaidInPeriod += parseFloat(d['Payments in Period (KSh)'] as string);
    const status = d['Status'] as string;
    if (status === 'PAID') paidSales++;
    else if (status === 'PARTIAL') partialSales++;
    else unpaidSales++;
  }

  const periodLabel = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly';
  const summaryRows = [
    {
      'Payment Date': `--- ${periodLabel} PAYMENT ACTIVITY ---`, 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': `Period: ${formatDate(start)} to ${formatDate(end)}`, 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': 'SALES WITH PAYMENTS', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': activityData.length.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': 'TOTAL PAYMENTS RECEIVED', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': '', 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': formatCurrency(totalPaidInPeriod), 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': 'PAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': paidSales.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': 'PARTIAL SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': partialSales.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    },
    {
      'Payment Date': 'UNPAID SALES', 'Sale ID': '', 'Original Sale Date': '',
      'Customer Name': '', 'Customer Phone': '', 'Assigned Staff': '',
      'Products': '', 'Original Amount (KSh)': unpaidSales.toString(), 'Total Paid Overall (KSh)': '', 'Remaining Balance (KSh)': '',
      'Status': '', 'Payments in Period (KSh)': '', 'Payment Details': '', 'Updated By': ''
    }
  ];

  const finalData = [...activityData, ...summaryRows];
  const csv = arrayToCSV(finalData);
  
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payment-activity-${periodLabel.toLowerCase()}-${formatDate(start)}.csv"`,
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

  let totalPaidSoFar = getTotalPaid(sale);
  const newTotalPaid = totalPaidSoFar + amount;
  const remainingBalance = sale.amount - newTotalPaid;
  let newStatus = 'UNPAID';
  if (remainingBalance <= 0.01) {
    newStatus = 'PAID';
  } else if (newTotalPaid > 0) {
    newStatus = 'PARTIAL';
  }

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

  return NextResponse.json({
    success: true,
    payment,
    newStatus,
    remainingBalance: remainingBalance > 0 ? remainingBalance : 0
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
          assignedStaff: true
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
      'Amount (KSh)': formatCurrency(payment.amount),
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
            assignedStaff: true
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
    
    monthlyData.push({
      'Month': formatDate(monthStart).substring(0, 7),
      'Total Payments (KSh)': formatCurrency(totalAmount),
      'Payment Count': payments.length,
      'Unique Customers': uniqueCustomersSet.size,
      'Unique Staff': uniqueStaffSet.size,
      'Average Payment (KSh)': formatCurrency(payments.length > 0 ? totalAmount / payments.length : 0)
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