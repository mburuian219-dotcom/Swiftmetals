import cron from "node-cron";
import { prisma } from "./prisma";
import { sendSMS } from "./sms";

/**
 * Run every day at 9:00 AM to notify customers about upcoming dues
 */
cron.schedule("0 9 * * *", async () => {
  const today = new Date();
  const upcomingDebts = await prisma.sale.findMany({
    where: {
      dueDate: { gte: today, lte: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000) },
      status: "PENDING",
    },
    include: { customer: true },
  });

  for (const debt of upcomingDebts) {
    if (debt.customer?.phone) {
      const message = `Hello ${debt.customer.name}, your payment of KSh ${debt.amount.toLocaleString()} is due on ${debt.dueDate?.toDateString()}. Please make your payment.`;
      await sendSMS(debt.customer.phone, message);
    }
  }

  console.log("Debt reminders sent:", upcomingDebts.length);
});
