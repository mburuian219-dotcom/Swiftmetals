// lib/whatsapp-service.ts
import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

// WhatsApp number from Twilio (sandbox or approved number)
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER!; // e.g., 'whatsapp:+14155238886'

interface Customer {
  id: number;
  name: string;
  phone: string; // Should include country code, e.g., '+254712345678'
}

interface Sale {
  id: number;
  customer: Customer;
  amount: number;
  status: 'PAID' | 'UNPAID';
  dueDate?: string;
  checkDepositDate?: string;
  paymentMethod: 'CASH' | 'MPESA' | 'BANK' | 'CHECK';
  saleItems: Array<{
    product: { name: string };
    quantity: number;
    price: number;
  }>;
}

export class WhatsAppMessagingService {
  
  /**
   * Format phone number for WhatsApp
   */
  private formatWhatsAppNumber(phone: string): string {
    // Ensure the number has the whatsapp: prefix
    if (!phone.startsWith('whatsapp:')) {
      // Remove any spaces, dashes, or parentheses
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      // Add + if not present
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
      return `whatsapp:${formattedPhone}`;
    }
    return phone;
  }

  /**
   * Send delivery confirmation message
   */
  async sendDeliveryConfirmation(sale: Sale): Promise<boolean> {
    try {
      const customerPhone = this.formatWhatsAppNumber(sale.customer.phone);
      
      // Generate product list
      const productList = sale.saleItems
        .map(item => `• ${item.product.name} (×${item.quantity}) - Ksh ${(item.quantity * item.price).toFixed(2)}`)
        .join('\n');

      const message = `
🎉 *Order Delivered Successfully!*

Dear ${sale.customer.name},

Your order has been delivered! Here are the details:

📦 *Order Details:*
${productList}

💰 *Total Amount:* Ksh ${sale.amount.toFixed(2)}
💳 *Payment Method:* ${sale.paymentMethod}
✅ *Status:* ${sale.status === 'PAID' ? 'Paid in Full' : 'Payment Pending'}

${sale.status === 'UNPAID' ? `⏰ *Payment Due:* ${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'Please contact us'}

Please complete your payment at your earliest convenience.` : ''}

Thank you for choosing our services! 🙏

*Customer Service*
Reply to this message for any questions.
      `.trim();

      await client.messages.create({
        body: message,
        from: twilioWhatsAppNumber,
        to: customerPhone,
      });

      console.log(`Delivery confirmation sent to ${sale.customer.name} at ${customerPhone}`);
      return true;
    } catch (error) {
      console.error('Error sending delivery confirmation:', error);
      return false;
    }
  }

  /**
   * Send payment reminder for unpaid orders
   */
  async sendPaymentReminder(sale: Sale): Promise<boolean> {
    try {
      const customerPhone = this.formatWhatsAppNumber(sale.customer.phone);
      
      const daysOverdue = sale.dueDate 
        ? Math.ceil((new Date().getTime() - new Date(sale.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const isOverdue = daysOverdue > 0;
      const urgencyLevel = isOverdue 
        ? (daysOverdue > 7 ? '🚨 URGENT' : '⚠️ OVERDUE') 
        : '🔔 REMINDER';

      // Generate product list
      const productList = sale.saleItems
        .map(item => `• ${item.product.name} (×${item.quantity})`)
        .join('\n');

      const message = `
${urgencyLevel} *Payment Reminder*

Dear ${sale.customer.name},

This is a friendly reminder about your pending payment:

📦 *Items Delivered:*
${productList}

💰 *Outstanding Amount:* Ksh ${sale.amount.toFixed(2)}
📅 *Due Date:* ${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'Please contact us'}
${isOverdue ? `⏰ *Days Overdue:* ${daysOverdue} days` : ''}

*Payment Options:*
💵 Cash Payment
📱 M-Pesa: [Your M-Pesa Number]
🏦 Bank Transfer: [Your Bank Details]

${isOverdue 
  ? 'Please settle this payment immediately to avoid any service interruption.' 
  : 'Please complete your payment before the due date.'}

Contact us if you need to discuss payment arrangements.

*Customer Service*
Reply to this message or call us directly.
      `.trim();

      await client.messages.create({
        body: message,
        from: twilioWhatsAppNumber,
        to: customerPhone,
      });

      console.log(`Payment reminder sent to ${sale.customer.name} at ${customerPhone}`);
      return true;
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return false;
    }
  }

  /**
   * Send check deposit notification
   */
  async sendCheckDepositNotification(sale: Sale): Promise<boolean> {
    try {
      const customerPhone = this.formatWhatsAppNumber(sale.customer.phone);
      
      if (!sale.checkDepositDate) {
        throw new Error('Check deposit date is required');
      }

      const depositDate = new Date(sale.checkDepositDate);
      const isToday = depositDate.toDateString() === new Date().toDateString();
      const isTomorrow = depositDate.toDateString() === new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
      
      let timeFrame = '';
      if (isToday) {
        timeFrame = 'TODAY';
      } else if (isTomorrow) {
        timeFrame = 'TOMORROW';
      } else {
        timeFrame = `on ${depositDate.toLocaleDateString()}`;
      }

      // Generate product list
      const productList = sale.saleItems
        .map(item => `• ${item.product.name} (×${item.quantity})`)
        .join('\n');

      const message = `
🏦 *Check Deposit Notification*

Dear ${sale.customer.name},

We will be depositing your check ${timeFrame}.

📋 *Transaction Details:*
${productList}

💰 *Check Amount:* Ksh ${sale.amount.toFixed(2)}
📅 *Deposit Date:* ${depositDate.toLocaleDateString()}
🏦 *Bank Processing Time:* 2-3 business days

${isToday || isTomorrow 
  ? '⚠️ Please ensure sufficient funds are available in your account.' 
  : 'This is an advance notice. Please ensure funds availability.'}

*Important Notes:*
• Check clearance may take 2-3 business days
• Contact us immediately if there are any issues
• Keep your transaction records for reference

If you have any concerns or need to make alternative arrangements, please contact us immediately.

*Customer Service*
Reply to this message or call us directly.
      `.trim();

      await client.messages.create({
        body: message,
        from: twilioWhatsAppNumber,
        to: customerPhone,
      });

      console.log(`Check deposit notification sent to ${sale.customer.name} at ${customerPhone}`);
      return true;
    } catch (error) {
      console.error('Error sending check deposit notification:', error);
      return false;
    }
  }

  /**
   * Send bulk messages to multiple customers
   */
  async sendBulkMessages(
    sales: Sale[], 
    messageType: 'delivery' | 'payment' | 'check_deposit'
  ): Promise<{ success: number; failed: number; results: Array<{ saleId: number; success: boolean; error?: string }> }> {
    const results: Array<{ saleId: number; success: boolean; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const sale of sales) {
      try {
        let sent = false;
        
        switch (messageType) {
          case 'delivery':
            sent = await this.sendDeliveryConfirmation(sale);
            break;
          case 'payment':
            sent = await this.sendPaymentReminder(sale);
            break;
          case 'check_deposit':
            sent = await this.sendCheckDepositNotification(sale);
            break;
        }

        if (sent) {
          success++;
          results.push({ saleId: sale.id, success: true });
        } else {
          failed++;
          results.push({ saleId: sale.id, success: false, error: 'Failed to send message' });
        }

        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        failed++;
        results.push({ 
          saleId: sale.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { success, failed, results };
  }

  /**
   * Send custom message to a customer
   */
  async sendCustomMessage(customerPhone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatWhatsAppNumber(customerPhone);
      
      await client.messages.create({
  body: message,
  from: `whatsapp:${twilioWhatsAppNumber}`,   // ✅ ensure "whatsapp:" prefix
  to: `whatsapp:${customerPhone}`,            // ✅ ensure "whatsapp:" prefix
});

      

      console.log(`Custom message sent to ${formattedPhone}`);
      return true;
    } catch (error) {
      console.error('Error sending custom message:', error);
      return false;
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string) {
    try {
      const message = await client.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      return null;
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppMessagingService();