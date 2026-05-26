// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const period = searchParams.get('period') || 'monthly';

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer ID is required',
          message: 'Please provide a customerId query parameter',
        },
        { status: 400 }
      );
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        previousEndDate = startDate;
        break;
      case 'all':
      default:
        startDate = new Date(0);
        previousStartDate = new Date(0);
        previousEndDate = new Date(0);
        break;
    }

    // Fetch customer with sales
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(customerId),
      },
      include: {
        sale: {
          where: {
            createdAt: {
              gte: startDate,
            },
          },
          include: {
            saleitem: {
              include: {
                product: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer not found',
          message: `No customer found with ID ${customerId}`,
        },
        { status: 404 }
      );
    }

    // Fetch all sales for customer (for first/last purchase dates)
    const allSales = await prisma.sale.findMany({
      where: {
        customerId: parseInt(customerId),
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
        amount: true,
      },
    });

    // Fetch previous period sales for comparison
    const previousPeriodSales =
      period !== 'all'
        ? await prisma.sale.findMany({
            where: {
              customerId: parseInt(customerId),
              createdAt: {
                gte: previousStartDate,
                lt: previousEndDate,
              },
            },
            select: {
              amount: true,
            },
          })
        : [];

    // Calculate previous period total
    const previousPeriodTotal = previousPeriodSales.reduce(
      (sum, sale) => sum + sale.amount,
      0
    );

    // Format purchases for the report
    const formattedPurchases = customer.sale.map((sale) => {
      const itemsSubtotal = sale.saleitem.reduce(
        (sum, item) => sum + item.total,
        0
      );

      return {
        date: new Date(sale.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        invoiceNumber: `INV-${sale.id}`,
        items:
          sale.saleitem
            .map((item) => `${item.product.name} (x${item.quantity})`)
            .join(', ') || 'No items',
        itemDetails: sale.saleitem.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        subtotal: itemsSubtotal,
        discount: 0,
        tax: 0,
        total: sale.amount,
        paymentMethod: sale.paymentMethod || 'CASH',
        paymentStatus: sale.status || 'UNPAID',
        notes: '',
      };
    });

    // Calculate summary metrics
    const totalAmount = customer.sale.reduce(
      (sum, sale) => sum + sale.amount,
      0
    );
    const totalPurchases = customer.sale.length;
    const averageOrder = totalPurchases > 0 ? totalAmount / totalPurchases : 0;

    // Find largest and smallest purchases
    const purchaseAmounts = customer.sale.map((sale) => sale.amount);
    const largestPurchase =
      purchaseAmounts.length > 0 ? Math.max(...purchaseAmounts) : 0;
    const smallestPurchase =
      purchaseAmounts.length > 0 ? Math.min(...purchaseAmounts) : 0;

    // Calculate top products
    const productMap = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    customer.sale.forEach((sale) => {
      sale.saleitem.forEach((item) => {
        const productName = item.product.name;

        if (productMap.has(productName)) {
          const existing = productMap.get(productName)!;
          productMap.set(productName, {
            name: productName,
            quantity: existing.quantity + item.quantity,
            total: existing.total + item.total,
          });
        } else {
          productMap.set(productName, {
            name: productName,
            quantity: item.quantity,
            total: item.total,
          });
        }
      });
    });

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Calculate purchase frequency
    const paymentMethods = customer.sale.map(
      (sale) => sale.paymentMethod || 'CASH'
    );
    const paymentMethodCounts: { [key: string]: number } = {};
    paymentMethods.forEach((method) => {
      paymentMethodCounts[method] = (paymentMethodCounts[method] || 0) + 1;
    });
    const preferredPayment =
      Object.keys(paymentMethodCounts).length > 0
        ? Object.keys(paymentMethodCounts).reduce((a, b) =>
            paymentMethodCounts[a] > paymentMethodCounts[b] ? a : b
          )
        : 'CASH';

    // Calculate days between purchases
    let avgDaysBetween: string | number = 'N/A';
    if (customer.sale.length > 1) {
      const sortedDates = customer.sale
        .map((sale) => new Date(sale.createdAt).getTime())
        .sort((a, b) => a - b);

      let totalDays = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        totalDays +=
          (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      avgDaysBetween = (totalDays / (sortedDates.length - 1)).toFixed(1);
    }

    // Calculate most active day of week
    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const dayCounts: { [key: string]: number } = {};
    customer.sale.forEach((sale) => {
      const dayName = daysOfWeek[new Date(sale.createdAt).getDay()];
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });
    const mostActiveDay =
      Object.keys(dayCounts).length > 0
        ? Object.keys(dayCounts).reduce((a, b) =>
            dayCounts[a] > dayCounts[b] ? a : b
          )
        : 'N/A';

    // Calculate most active time period
    const hourCounts: { [key: string]: number } = {};
    customer.sale.forEach((sale) => {
      const hour = new Date(sale.createdAt).getHours();
      let period: string;
      if (hour >= 5 && hour < 12) period = 'Morning (5AM-12PM)';
      else if (hour >= 12 && hour < 17) period = 'Afternoon (12PM-5PM)';
      else if (hour >= 17 && hour < 21) period = 'Evening (5PM-9PM)';
      else period = 'Night (9PM-5AM)';

      hourCounts[period] = (hourCounts[period] || 0) + 1;
    });
    const mostActiveTime =
      Object.keys(hourCounts).length > 0
        ? Object.keys(hourCounts).reduce((a, b) =>
            hourCounts[a] > hourCounts[b] ? a : b
          )
        : 'N/A';

    // Calculate customer since days
    const firstPurchaseDate =
      allSales.length > 0
        ? new Date(allSales[0].createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : null;

    const lastPurchaseDate =
      allSales.length > 0
        ? new Date(allSales[allSales.length - 1].createdAt).toLocaleDateString(
            'en-US',
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }
          )
        : null;

    const customerSince =
      allSales.length > 0
        ? Math.floor(
            (now.getTime() - new Date(allSales[0].createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    // Calculate loyalty score
    let loyaltyScore = 0;
    if (totalPurchases > 0) {
      const frequencyScore = Math.min((totalPurchases / 10) * 5, 5);
      const recencyScore =
        allSales.length > 0
          ? Math.max(
              5 -
                (now.getTime() -
                  new Date(allSales[allSales.length - 1].createdAt).getTime()) /
                  (1000 * 60 * 60 * 24 * 30),
              0
            )
          : 0;
      loyaltyScore = Math.min(Math.round(frequencyScore + recencyScore), 10);
    }

    // Category breakdown
    const categoryMap = new Map<string, number>();
    customer.sale.forEach((sale) => {
      sale.saleitem.forEach((item) => {
        const category = item.product.category || 'Uncategorized';
        categoryMap.set(category, (categoryMap.get(category) || 0) + item.total);
      });
    });

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage:
          totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      data: {
        purchases: formattedPurchases,
        totalPurchases,
        totalAmount,
        averageOrder,
        largestPurchase,
        smallestPurchase,
        previousPeriodTotal: period !== 'all' ? previousPeriodTotal : undefined,
        firstPurchaseDate,
        lastPurchaseDate,
        customerSince,
        topProducts,
        purchaseFrequency: {
          avgDaysBetween,
          mostActiveDay,
          mostActiveTime,
          preferredPayment,
        },
        loyaltyScore,
        categoryBreakdown,
        customerInfo: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          totalCredit: customer.totalCredit,
        },
      },
      period,
    });
  } catch (error) {
    console.error('Error generating customer report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate report',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}