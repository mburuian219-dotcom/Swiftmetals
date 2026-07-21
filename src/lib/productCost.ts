// lib/productCost.ts
import prisma from "@/lib/prisma";

export async function getProductCostAtDate(productId: number, date: Date) {
  // Try to get the cost that was effective at the given date
  const costHistory = await prisma.productCostHistory.findFirst({
    where: {
      productId: productId,
      effectiveDate: {
        lte: date, // Cost effective on or before the sale date
      },
    },
    orderBy: {
      effectiveDate: 'desc', // Get the most recent cost before the sale
    },
  });

  if (costHistory) {
    return costHistory.costPrice;
  }

  // Fallback to current production cost if no history exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { productionCost: true },
  });

  return product?.productionCost || 0;
}

export async function recordProductCostHistory(
  productId: number,
  costPrice: number,
  notes?: string
) {
  // Check if we already have a record for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.productCostHistory.findFirst({
    where: {
      productId,
      effectiveDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  // Only create a new record if the cost has changed
  if (!existing || existing.costPrice !== costPrice) {
    return await prisma.productCostHistory.create({
      data: {
        productId,
        costPrice,
        effectiveDate: new Date(),
        notes: notes || `Cost updated to ${costPrice}`,
      },
    });
  }

  return existing;
}