"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Trash2, Pencil, Check, X, Download, FileText, 
  Calendar, DollarSign, ShoppingCart, BarChart3, CreditCard,
  History, TrendingUp, AlertCircle, CheckCircle, Clock,
  ArrowRight, PiggyBank, Receipt, RefreshCw, Search,
  UserPlus, Phone, Mail, Filter, DownloadCloud, Printer,
  ChevronDown, ChevronUp, MoreVertical, Eye, Edit, Trash,
  Users, Wallet, TrendingDown, TrendingUp as TrendUp,
  UserCheck, UserX, MessageSquare, Bell, MessageCircle,
  Send, FileDown, FileSpreadsheet, ReceiptText
} from "lucide-react";

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  totalCredit?: number;
  totalPurchases?: number;
  totalSales?: number;
  averageOrderValue?: number;
  lastPurchase?: string | null;
  createdAt?: string;
}

interface OutstandingSale {
  id: number;
  date: string;
  amount: number;
  paidAmount: number;
  remainingBalance: number;
  status: string;
  paymentMethod?: string;
  dueDate?: string;
  saleitem?: SaleItem[];
}

interface SaleItem {
  id: number;
  productId: number;
  product?: {
    id: number;
    name: string;
  };
  quantity: number;
  price: number;
  total: number;
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  referenceId?: string;
  note?: string;
}

// Function to generate receipt download link
const generateReceiptLink = (saleId: number): string => {
  return `${window.location.origin}/api/receipt/${saleId}`;
};

// Generate statement download link (only outstanding sales)
const generateOutstandingStatementLink = (customerId: number): string => {
  return `${window.location.origin}/api/customer-receipt/${customerId}?status=outstanding`;
};

// Generate full statement download link (all sales)
const generateFullStatementLink = (customerId: number): string => {
  return `${window.location.origin}/api/customer-receipt/${customerId}`;
};

// Format phone to Kenya code
const formatPhoneToKenyaCode = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '254' + cleaned.slice(1);
  }
  
  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  
  if (phone.startsWith('+254')) {
    return cleaned;
  }
  
  return '254' + cleaned;
};

// Format currency
const formatCurrency = (amount: number) =>
  Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Search and Filter Bar Component
const SearchBar = ({ onSearch, onFilter }: { onSearch: (query: string) => void, onFilter: () => void }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onFilter}
            className="px-4 py-3 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-black transition-all flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            <span className="hidden md:inline">Filter</span>
          </button>
          <button
            className="px-4 py-3 bg-black text-white rounded-lg hover:bg-slate-900 transition-all flex items-center gap-2"
          >
            <DownloadCloud className="w-5 h-5" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Credit Management Component
const CreditManagement = ({ 
  customer, 
  onPaymentComplete 
}: { 
  customer: Customer | null;
  onPaymentComplete: () => void;
}) => {
  const [outstandingSales, setOutstandingSales] = useState<OutstandingSale[]>([]);
  const [allSales, setAllSales] = useState<OutstandingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [allocating, setAllocating] = useState(false);
  const [allocationPreview, setAllocationPreview] = useState<any[]>([]);
  const [processingSaleId, setProcessingSaleId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  
  // States for message flow
  const [showMessagePrompt, setShowMessagePrompt] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("");
  const [pendingReceipt, setPendingReceipt] = useState("");
  const [pendingPaymentResult, setPendingPaymentResult] = useState<any>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [messageType, setMessageType] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');

  // Generate receipt text
  const generateReceipt = (
    customerName: string,
    previousBalance: number,
    amountPaid: number,
    newBalance: number,
    sales: OutstandingSale[],
    paymentMethod: string,
    paymentReference?: string
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
    
    let receipt = `═══════════════════════════════════════\n`;
    receipt += `              PAYMENT RECEIPT              \n`;
    receipt += `═══════════════════════════════════════\n`;
    receipt += `Receipt No: ${receiptNumber}\n`;
    receipt += `Date: ${date} ${time}\n`;
    receipt += `Customer: ${customerName}\n`;
    receipt += `───────────────────────────────────────\n\n`;
    
    receipt += `PAYMENT DETAILS:\n`;
    receipt += `  Previous Balance: KSh ${previousBalance.toLocaleString()}\n`;
    receipt += `  Amount Paid:      KSh ${amountPaid.toLocaleString()}\n`;
    receipt += `  Payment Method:   ${paymentMethod}\n`;
    if (paymentReference) {
      receipt += `  Reference:        ${paymentReference}\n`;
    }
    receipt += `  New Balance:       KSh ${newBalance.toLocaleString()}\n\n`;
    
    if (sales.length > 0) {
      receipt += `ITEMS PAID FOR:\n`;
      receipt += `───────────────────────────────────────\n`;
      
      sales.forEach((sale, index) => {
        const receiptLink = generateReceiptLink(sale.id);
        receipt += `${index + 1}. Sale #${sale.id} (${new Date(sale.date).toLocaleDateString()})\n`;
        receipt += `   Receipt Link: ${receiptLink}\n`;
        
        if (sale.saleitem && sale.saleitem.length > 0) {
          sale.saleitem.forEach(item => {
            if (item.product) {
              receipt += `   • ${item.product.name.padEnd(20)} x${item.quantity} @ KSh ${item.price.toLocaleString()}\n`;
            }
          });
        }
        
        const paidThisTime = Math.min(sale.remainingBalance, amountPaid);
        receipt += `   Sale Total:      KSh ${sale.amount.toLocaleString()}\n`;
        receipt += `   Paid Now:        KSh ${paidThisTime.toLocaleString()}\n`;
        
        if (sale.remainingBalance - paidThisTime > 0) {
          receipt += `   Remaining:       KSh ${(sale.remainingBalance - paidThisTime).toLocaleString()}\n`;
        } else {
          receipt += `   Status:          ✅ FULLY PAID\n`;
        }
        receipt += `\n`;
      });
    }
    
    receipt += `═══════════════════════════════════════\n`;
    receipt += `           PAYMENT SUMMARY           \n`;
    receipt += `───────────────────────────────────────\n`;
    receipt += `Total Paid:        KSh ${amountPaid.toLocaleString()}\n`;
    receipt += `Payment Status:    ${newBalance === 0 ? '✅ FULLY PAID' : newBalance > 0 ? '⏳ PARTIAL PAYMENT' : '💰 OVERPAYMENT (CREDIT)'}\n`;
    
    if (newBalance < 0) {
      receipt += `Credit Balance:    KSh ${Math.abs(newBalance).toLocaleString()}\n`;
    }
    
    receipt += `───────────────────────────────────────\n`;
    receipt += `       Thank you for your business!       \n`;
    receipt += `              🙏 SWIFTMETALS 🙏            \n`;
    receipt += `═══════════════════════════════════════\n`;
    
    return receipt;
  };

  // Message Templates with Receipt Links (like in debtors section)
  const MESSAGE_TEMPLATES = {
    FULL_PAYMENT: (name: string, amount: number, receipt: string, receiptLinks: { saleId: number, link: string }[]) => {
      const links = receiptLinks.map(r => `• Sale #${r.saleId}: ${r.link}`).join('\n');
      const statementLink = generateOutstandingStatementLink(customer!.id);
      
      return `Hello ${name},

🎉 *PAYMENT CONFIRMATION - FULL SETTLEMENT*

We are pleased to confirm that you have fully cleared your outstanding balance of KSh ${amount.toLocaleString()}!

*RECEIPTS:*
${links}

*OUTSTANDING STATEMENT:*
${statementLink}

We truly appreciate your business and timely payment. It's customers like you who make our work worthwhile!

We look forward to serving you again soon.

Best regards,
Swiftmetals Team ✨`;
    },

    PARTIAL_PAYMENT: (name: string, amount: number, remaining: number, receipt: string, receiptLinks: { saleId: number, link: string }[]) => {
      const links = receiptLinks.map(r => `• Sale #${r.saleId}: ${r.link}`).join('\n');
      const statementLink = generateOutstandingStatementLink(customer!.id);
      
      return `Hello ${name},

💫 *PAYMENT CONFIRMATION - PARTIAL PAYMENT*

Thank you for your payment of KSh ${amount.toLocaleString()}!

*RECEIPTS:*
${links}

*OUTSTANDING STATEMENT:*
${statementLink}

Your remaining balance is KSh ${remaining.toLocaleString()}.

We appreciate your effort to reduce your outstanding balance. Would you like to set up a payment plan for the remaining amount? Feel free to contact us.

Thank you for your continued trust in us!

Best regards,
Swiftmetals Team`;
    },

    OVERPAYMENT: (name: string, amount: number, credit: number, receipt: string, receiptLinks: { saleId: number, link: string }[]) => {
      const links = receiptLinks.map(r => `• Sale #${r.saleId}: ${r.link}`).join('\n');
      const statementLink = generateFullStatementLink(customer!.id);
      
      return `Hello ${name},

🙏 *PAYMENT CONFIRMATION - CREDIT CREATED*

Thank you for your payment of KSh ${amount.toLocaleString()}!

*RECEIPTS:*
${links}

*FULL STATEMENT:*
${statementLink}

Your account now has a credit balance of KSh ${credit.toLocaleString()}. This credit will be automatically applied to your future purchases.

We're truly honored by your trust and generosity!

Best regards,
Swiftmetals Team`;
    }
  };

  useEffect(() => {
    if (customer) {
      fetchOutstandingSales();
      fetchAllSales();
    }
  }, [customer]);

  const fetchOutstandingSales = async () => {
    if (!customer) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?customerId=${customer.id}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      const data = await res.json();
      
      const sales = Array.isArray(data) ? data : (data.data || []);
      
      const outstanding = sales
        .map((sale: any) => {
          const totalPaid = sale.payment?.reduce((sum: number, p: Payment) => 
            p.status === "CLEARED" ? sum + p.amount : sum, 0) || 0;
          
          return {
            id: sale.id,
            date: sale.date,
            amount: sale.amount,
            paidAmount: totalPaid,
            remainingBalance: sale.amount - totalPaid,
            status: totalPaid === 0 ? 'UNPAID' : totalPaid >= sale.amount ? 'PAID' : 'PARTIAL',
            paymentMethod: sale.paymentMethod,
            dueDate: sale.dueDate,
            saleitem: sale.saleitem
          };
        })
        .filter((sale: OutstandingSale) => sale.remainingBalance > 0)
        .sort((a: OutstandingSale, b: OutstandingSale) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      
      setOutstandingSales(outstanding);
      
      if (paymentAmount && parseFloat(paymentAmount) > 0) {
        calculatePreview(parseFloat(paymentAmount), outstanding);
      }
    } catch (err) {
      console.error("Error fetching outstanding sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSales = async () => {
    if (!customer) return;
    
    try {
      const res = await fetch(`/api/sales?customerId=${customer.id}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      const data = await res.json();
      
      const sales = Array.isArray(data) ? data : (data.data || []);
      
      const all = sales.map((sale: any) => {
        const totalPaid = sale.payment?.reduce((sum: number, p: Payment) => 
          p.status === "CLEARED" ? sum + p.amount : sum, 0) || 0;
        
        return {
          id: sale.id,
          date: sale.date,
          amount: sale.amount,
          paidAmount: totalPaid,
          remainingBalance: sale.amount - totalPaid,
          status: totalPaid === 0 ? 'UNPAID' : totalPaid >= sale.amount ? 'PAID' : 'PARTIAL',
          paymentMethod: sale.paymentMethod,
          dueDate: sale.dueDate,
          saleitem: sale.saleitem
        };
      }).sort((a: OutstandingSale, b: OutstandingSale) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setAllSales(all);
    } catch (err) {
      console.error("Error fetching all sales:", err);
    }
  };

  const calculatePreview = (amount: number, sales = outstandingSales) => {
    let remaining = amount;
    const preview = [];
    
    for (const sale of sales) {
      if (remaining <= 0) break;
      
      const allocAmount = Math.min(remaining, sale.remainingBalance);
      preview.push({
        saleId: sale.id,
        saleDate: new Date(sale.date).toLocaleDateString(),
        amount: allocAmount,
        willBeFullyPaid: allocAmount === sale.remainingBalance,
        remainingAfter: sale.remainingBalance - allocAmount,
        originalAmount: sale.amount,
        paidAmount: sale.paidAmount,
        items: sale.saleitem
      });
      
      remaining -= allocAmount;
    }
    
    setAllocationPreview(preview);
    return { preview, remaining };
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPaymentAmount(value);
    
    if (value && parseFloat(value) > 0 && outstandingSales.length > 0) {
      calculatePreview(parseFloat(value));
    } else {
      setAllocationPreview([]);
    }
  };

  const getTotalOutstanding = () => {
    return outstandingSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);
  };

  const getPaymentType = (amount: number, totalOutstanding: number) => {
    if (amount > totalOutstanding) return 'overpayment';
    if (amount === totalOutstanding) return 'full';
    return 'partial';
  };

  const processPayment = async () => {
    if (!customer) {
      alert("Please select a customer");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }

    if (outstandingSales.length === 0) {
      alert("No outstanding sales for this customer");
      return;
    }

    setAllocating(true);
    
    try {
      let remainingAmount = amount;
      const processedSales = [];
      const paidSales = [];
      const failedSales = [];
      const receiptLinks = [];

      for (const sale of outstandingSales) {
        if (remainingAmount <= 0) break;
        
        const paymentForThisSale = Math.min(remainingAmount, sale.remainingBalance);
        if (paymentForThisSale <= 0) continue;

        setProcessingSaleId(sale.id);

        const saleRes = await fetch(`/api/sales/${sale.id}`);
        if (!saleRes.ok) {
          failedSales.push({ saleId: sale.id, reason: "Failed to fetch sale" });
          continue;
        }
        
        const saleData = await saleRes.json();

        const newPayment = {
          amount: paymentForThisSale,
          method: paymentMethod,
          referenceId: paymentNote ? `PAY-${Date.now()}` : undefined,
          note: paymentNote || `Payment of KSh ${paymentForThisSale} received`
        };

        const updateRes = await fetch(`/api/sales/${sale.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...saleData,
            newPayments: [newPayment]
          })
        });

        if (!updateRes.ok) {
          failedSales.push({ saleId: sale.id, reason: "Failed to update sale" });
          continue;
        }

        const updatedSale = await updateRes.json();
        processedSales.push({
          saleId: sale.id,
          amount: paymentForThisSale,
          fullyPaid: updatedSale.status === "PAID"
        });

        receiptLinks.push({
          saleId: sale.id,
          link: generateReceiptLink(sale.id)
        });

        paidSales.push({
          ...sale,
          paidThisTime: paymentForThisSale
        });

        remainingAmount -= paymentForThisSale;
      }

      let creditUpdate = null;
      const totalOutstanding = getTotalOutstanding();
      const paymentType = getPaymentType(amount, totalOutstanding);
      
      if (remainingAmount > 0) {
        const creditRes = await fetch(`/api/customer`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customer.id,
            totalCredit: (customer.totalCredit || 0) + remainingAmount
          })
        });
        
        if (creditRes.ok) {
          creditUpdate = {
            amount: remainingAmount,
            newTotal: (customer.totalCredit || 0) + remainingAmount
          };
        }
      }

      const newBalance = totalOutstanding - amount;

      const receipt = generateReceipt(
        customer.name,
        totalOutstanding,
        amount,
        newBalance,
        paidSales,
        paymentMethod,
        paymentNote || `PAY-${Date.now()}`
      );

      let message = '';
      if (paymentType === 'full') {
        message = MESSAGE_TEMPLATES.FULL_PAYMENT(customer.name, amount, receipt, receiptLinks);
      } else if (paymentType === 'partial') {
        message = MESSAGE_TEMPLATES.PARTIAL_PAYMENT(customer.name, amount, Math.abs(newBalance), receipt, receiptLinks);
      } else if (paymentType === 'overpayment') {
        const credit = amount - totalOutstanding;
        message = MESSAGE_TEMPLATES.OVERPAYMENT(customer.name, amount, credit, receipt, receiptLinks);
      }

      const result = {
        processedSales,
        failedSales,
        creditUpdate,
        totalAmount: amount,
        allocatedAmount: amount - remainingAmount,
        unallocatedAmount: remainingAmount,
        message,
        receipt,
        receiptLinks,
        paymentType,
        newBalance
      };
      
      setPendingPaymentResult(result);
      setPendingMessage(message);
      setPendingReceipt(receipt);
      setCustomMessage(message);
      setShowMessagePrompt(true);

      setPaymentAmount("");
      setPaymentNote("");
      setAllocationPreview([]);
      
      await fetchOutstandingSales();
      await fetchAllSales();
      
    } catch (err) {
      console.error("Error processing payment:", err);
      alert("Failed to process payment. Please try again.");
    } finally {
      setAllocating(false);
      setProcessingSaleId(null);
    }
  };

  const sendWhatsAppMessage = (phone: string, message: string) => {
    const formattedPhone = formatPhoneToKenyaCode(phone);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const sendSMSMessage = (phone: string, message: string) => {
    const formattedPhone = formatPhoneToKenyaCode(phone);
    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:${formattedPhone}?body=${encodedMessage}`;
    window.location.href = smsUrl;
  };

  const sendEmailMessage = (email: string, message: string) => {
    const subject = encodeURIComponent(`Payment Confirmation - Swiftmetals`);
    const body = encodeURIComponent(message.replace(/\*/g, ''));
    const emailUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    window.location.href = emailUrl;
  };

  const handleSendMessage = () => {
    if (!customer) return;
    
    if (!customer.phone && messageType !== 'email') {
      alert("Customer has no phone number");
      return;
    }
    if (messageType === 'email' && !customer.email) {
      alert("Customer has no email address");
      return;
    }

    if (messageType === 'whatsapp' && customer.phone) {
      sendWhatsAppMessage(customer.phone, pendingMessage);
    } else if (messageType === 'sms' && customer.phone) {
      sendSMSMessage(customer.phone, pendingMessage);
    } else if (messageType === 'email' && customer.email) {
      sendEmailMessage(customer.email, pendingMessage);
    }
    
    handleCompletePayment();
  };

  const handleEditAndSend = () => {
    setShowMessageDialog(true);
    setShowMessagePrompt(false);
  };

  const handleCustomMessageSend = () => {
    if (!customer) return;
    
    if (!customer.phone && messageType !== 'email') {
      alert("Customer has no phone number");
      return;
    }
    if (messageType === 'email' && !customer.email) {
      alert("Customer has no email address");
      return;
    }

    if (messageType === 'whatsapp' && customer.phone) {
      sendWhatsAppMessage(customer.phone, customMessage);
    } else if (messageType === 'sms' && customer.phone) {
      sendSMSMessage(customer.phone, customMessage);
    } else if (messageType === 'email' && customer.email) {
      sendEmailMessage(customer.email, customMessage);
    }
    
    setShowMessageDialog(false);
    handleCompletePayment();
  };

  const handleSkipMessage = () => {
    handleCompletePayment();
  };

  const handleCompletePayment = () => {
    fetchOutstandingSales();
    fetchAllSales();
    onPaymentComplete();
    
    if (customer && pendingPaymentResult?.creditUpdate) {
      fetch(`/api/customer?id=${customer.id}`)
        .then(res => res.json())
        .then(data => {
          const updatedCustomer = data.data || data;
          if (updatedCustomer) {
            onPaymentComplete();
          }
        })
        .catch(err => console.error("Error refreshing customer:", err));
    }
    
    setShowMessagePrompt(false);
    setShowMessageDialog(false);
    setPendingMessage("");
    setPendingReceipt("");
    setPendingPaymentResult(null);
  };

  const downloadReceipt = () => {
    if (!pendingReceipt || !customer) return;
    
    const blob = new Blob([pendingReceipt], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${customer.name}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Download outstanding statement (only unpaid/partial sales)
  const downloadOutstandingStatement = () => {
    if (!customer) return;
    
    const outstandingToExport = allSales.filter(sale => sale.status !== 'PAID');
    
    if (outstandingToExport.length === 0) {
      alert("No outstanding sales for this customer");
      return;
    }

    let csvContent = "Sale ID,Date,Amount,Paid Amount,Remaining Balance,Status,Due Date,Items,Receipt Link\n";
    
    outstandingToExport.forEach((sale) => {
      const itemsList = sale.saleitem?.map((item: any) => 
        `${item.product?.name} x${item.quantity}`
      ).join('; ') || 'No items';
      
      const receiptLink = generateReceiptLink(sale.id);
      
      csvContent += `${sale.id},${new Date(sale.date).toLocaleDateString()},${sale.amount},${sale.paidAmount},${sale.remainingBalance},${sale.status},${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'},"${itemsList}",${receiptLink}\n`;
    });

    csvContent += "\nOUTSTANDING SUMMARY\n";
    csvContent += `Total Outstanding,${outstandingToExport.reduce((sum, s) => sum + s.remainingBalance, 0)}\n`;
    csvContent += `Number of Outstanding Sales,${outstandingToExport.length}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customer.name}_outstanding_statement_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Download full statement (all sales)
  const downloadFullStatement = () => {
    if (!customer) return;
    
    if (allSales.length === 0) {
      alert("No sales found for this customer");
      return;
    }

    let csvContent = "Sale ID,Date,Amount,Paid Amount,Remaining Balance,Status,Due Date,Items,Receipt Link\n";
    
    allSales.forEach((sale) => {
      const itemsList = sale.saleitem?.map((item: any) => 
        `${item.product?.name} x${item.quantity}`
      ).join('; ') || 'No items';
      
      const receiptLink = generateReceiptLink(sale.id);
      
      csvContent += `${sale.id},${new Date(sale.date).toLocaleDateString()},${sale.amount},${sale.paidAmount},${sale.remainingBalance},${sale.status},${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'},"${itemsList}",${receiptLink}\n`;
    });

    csvContent += "\nSUMMARY\n";
    csvContent += `Total Sales,${allSales.reduce((sum, s) => sum + s.amount, 0)}\n`;
    csvContent += `Total Paid,${allSales.reduce((sum, s) => sum + s.paidAmount, 0)}\n`;
    csvContent += `Total Outstanding,${allSales.filter(s => s.status !== 'PAID').reduce((sum, s) => sum + s.remainingBalance, 0)}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customer.name}_full_statement_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleReceiptPreview = () => {
    setShowReceiptPreview(!showReceiptPreview);
  };

  if (!customer) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Credit Management</h2>
              <p className="text-sm text-slate-500">Select a customer to manage credit payments</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div 
        className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Credit Management</h2>
              <p className="text-sm text-slate-500">{customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600">
                KSh {getTotalOutstanding().toLocaleString()}
              </p>
            </div>
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-slate-100">
          {/* Download Statement Buttons - Like in debtors section */}
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={downloadOutstandingStatement}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all flex items-center gap-1.5 text-xs"
              title="Download only unpaid and partially paid sales"
            >
              <Download className="w-3.5 h-3.5" />
              Outstanding Statement (CSV)
            </button>
            <button
              onClick={downloadFullStatement}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-1.5 text-xs"
              title="Download all sales including paid"
            >
              <FileText className="w-3.5 h-3.5" />
              Full Statement (CSV)
            </button>
          </div>

          {/* Message Prompt Dialog */}
          {showMessagePrompt && pendingMessage && (
            <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Payment Successful! 🎉
                  </h3>
                  <p className="text-green-700 mb-4">
                    Thank you message ready to send to {customer.name}
                  </p>
                  
                  {/* Message Type Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-green-800 mb-2">
                      Send via:
                    </label>
                    <div className="flex gap-2">
                      {customer.phone && (
                        <>
                          <button
                            onClick={() => setMessageType('whatsapp')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                              messageType === 'whatsapp' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-white text-green-700 border border-green-300'
                            }`}
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </button>
                          <button
                            onClick={() => setMessageType('sms')}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                              messageType === 'sms' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white text-blue-700 border border-blue-300'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" />
                            SMS
                          </button>
                        </>
                      )}
                      {customer.email && (
                        <button
                          onClick={() => setMessageType('email')}
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                            messageType === 'email' 
                              ? 'bg-orange-600 text-white' 
                              : 'bg-white text-orange-700 border border-orange-300'
                            }`}
                        >
                          <Mail className="w-4 h-4" />
                          Email
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Receipt Preview Button */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={toggleReceiptPreview}
                      className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <ReceiptText className="w-4 h-4" />
                      {showReceiptPreview ? 'Hide Receipt' : 'Preview Receipt'}
                    </button>
                    
                    <button
                      onClick={downloadReceipt}
                      className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Receipt
                    </button>
                  </div>

                  {/* Receipt Preview */}
                  {showReceiptPreview && pendingReceipt && (
                    <div className="mb-4 bg-white rounded-lg p-4 border border-green-200 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {pendingReceipt}
                    </div>
                  )}

                  {/* Message Preview */}
                  <div className="bg-white rounded-lg p-4 mb-4 border border-green-200 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {pendingMessage}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSendMessage}
                      className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors flex items-center gap-2 font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Send {messageType === 'whatsapp' ? 'WhatsApp' : messageType === 'sms' ? 'SMS' : 'Email'}
                    </button>
                    
                    <button
                      onClick={handleEditAndSend}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Message
                    </button>
                    
                    <button
                      onClick={handleSkipMessage}
                      className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                      Skip
                    </button>
                  </div>

                  {!customer.phone && messageType !== 'email' && (
                    <p className="text-sm text-red-600 mt-2">
                      No phone number available for this customer. Add a phone number to send messages.
                    </p>
                  )}
                  
                  {messageType === 'email' && !customer.email && (
                    <p className="text-sm text-red-600 mt-2">
                      No email address available for this customer. Add an email to send messages.
                    </p>
                  )}

                  {/* Document Options Info - Like in debtors section */}
                  <div className="mt-4 text-xs text-gray-500 bg-white p-3 rounded-lg border border-green-100">
                    <p className="font-medium mb-1 text-green-800">Document Options:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                      <li><strong>Single Receipt</strong>: Each sale has its own receipt link above</li>
                      <li><strong>Outstanding Statement</strong>: Download only unpaid/partial sales (CSV)</li>
                      <li><strong>Full Statement</strong>: Download complete sales history (CSV)</li>
                      <li><strong>Messages</strong>: Include both individual receipt links and statement links</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Message Dialog */}
          {showMessageDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-black mb-4">Customize Your Message</h3>
                
                {/* Receipt Preview in Edit Mode */}
                {pendingReceipt && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Receipt:</p>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 font-mono text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {pendingReceipt}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message:
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black font-mono text-sm"
                    placeholder="Enter your message..."
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send via:
                  </label>
                  <div className="flex gap-2">
                    {customer.phone && (
                      <>
                        <button
                          onClick={() => setMessageType('whatsapp')}
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                            messageType === 'whatsapp' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </button>
                        <button
                          onClick={() => setMessageType('sms')}
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                            messageType === 'sms' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <MessageSquare className="w-4 h-4" />
                          SMS
                        </button>
                      </>
                    )}
                    {customer.email && (
                      <button
                        onClick={() => setMessageType('email')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                          messageType === 'email' 
                            ? 'bg-orange-600 text-white' 
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleCustomMessageSend}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  
                  <button
                    onClick={() => setShowMessageDialog(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent mb-3"></div>
              <p className="text-slate-500">Loading outstanding sales...</p>
            </div>
          ) : (
            <>
              {/* Outstanding Sales List */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-black flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Outstanding Sales (Not Fully Paid)
                  </h3>
                  <button 
                    onClick={fetchOutstandingSales}
                    className="p-2 text-slate-500 hover:text-black rounded-lg hover:bg-slate-100 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {outstandingSales.length === 0 ? (
                  <div className="bg-slate-50 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-slate-700 font-medium">No outstanding sales</p>
                    <p className="text-sm text-slate-500 mt-1">This customer has no pending payments.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outstandingSales.map((sale) => (
                      <div 
                        key={sale.id} 
                        className={`bg-slate-50 rounded-lg p-4 border transition-all ${
                          processingSaleId === sale.id 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-sm font-medium text-black">Sale #{sale.id}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                sale.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 
                                sale.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {sale.status}
                              </span>
                              {sale.dueDate && new Date(sale.dueDate) < new Date() && sale.status !== 'PAID' && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Overdue
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500">Date</p>
                                <p className="text-black">{new Date(sale.date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Total</p>
                                <p className="text-black font-medium">KSh {sale.amount.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Paid</p>
                                <p className="text-green-600 font-medium">KSh {sale.paidAmount.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Remaining</p>
                                <p className="text-red-600 font-bold">KSh {sale.remainingBalance.toLocaleString()}</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Payment Progress</span>
                                <span className="font-medium text-black">
                                  {((sale.paidAmount / sale.amount) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(sale.paidAmount / sale.amount) * 100}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Sale Items with Receipt Link */}
                            {sale.saleitem && sale.saleitem.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-xs font-medium text-slate-500">Items:</p>
                                  <a 
                                    href={generateReceiptLink(sale.id)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Receipt Link
                                  </a>
                                </div>
                                <div className="space-y-1">
                                  {sale.saleitem.map((item) => (
                                    <div key={item.id} className="flex justify-between text-xs">
                                      <span className="text-slate-600">
                                        {item.product?.name} x{item.quantity}
                                      </span>
                                      <span className="text-black font-medium">
                                        KSh {item.total.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {processingSaleId === sale.id && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                              Processing...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Form */}
              {outstandingSales.length > 0 && !showMessagePrompt && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="font-semibold text-black mb-4">Process Payment</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Payment Amount (KSh)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">KSh</span>
                          <input
                            type="number"
                            value={paymentAmount}
                            onChange={handleAmountChange}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
                        >
                          <option value="CASH">Cash</option>
                          <option value="MPESA">M-PESA</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Note / Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          placeholder="e.g., M-PESA Ref: ABC123"
                          className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
                        />
                      </div>
                    </div>

                    {/* Allocation Preview */}
                    <div>
                      {allocationPreview.length > 0 ? (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 h-full">
                          <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4" />
                            Payment Allocation Preview
                          </h4>
                          <div className="space-y-3">
                            {allocationPreview.map((alloc, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-blue-700 font-medium">
                                    Sale #{alloc.saleId}
                                  </span>
                                  <span className="font-medium text-blue-900">
                                    KSh {alloc.amount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs text-blue-600 mb-1">
                                  {alloc.saleDate}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
                                      style={{ 
                                        width: `${((alloc.paidAmount + alloc.amount) / alloc.originalAmount) * 100}%` 
                                      }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    alloc.willBeFullyPaid ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {alloc.willBeFullyPaid ? '✅ Fully Paid' : '⏳ Partial'}
                                  </span>
                                </div>
                              </div>
                            ))}
                            
                            {parseFloat(paymentAmount) > getTotalOutstanding() && (
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-sm text-blue-700 flex items-center gap-1">
                                  <PiggyBank className="w-4 h-4" />
                                  <strong>KSh {(parseFloat(paymentAmount) - getTotalOutstanding()).toLocaleString()}</strong> will be added to credit balance
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-8 text-center h-full flex items-center justify-center">
                          <div>
                            <DollarSign className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">Enter an amount to see allocation preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={processPayment}
                    disabled={allocating || !paymentAmount || parseFloat(paymentAmount) <= 0}
                    className="mt-6 w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {allocating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        Process Payment & Send Thank You
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    After payment, you'll have the option to send a thank you message with receipt links
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Payment History Component
const PaymentHistory = ({ customerId }: { customerId: number | null }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (customerId && expanded) {
      fetchPaymentHistory();
    }
  }, [customerId, expanded]);

  const fetchPaymentHistory = async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?customerId=${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      const data = await res.json();
      
      const sales = Array.isArray(data) ? data : (data.data || []);
      
      const allPayments = sales.flatMap((sale: any) => 
        (sale.payment || []).map((p: any) => ({
          ...p,
          saleId: sale.id,
          saleDate: sale.date,
          saleAmount: sale.amount
        }))
      ).sort((a: any, b: any) => 
        new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );
      
      setPayments(allPayments);
    } catch (err) {
      console.error("Error fetching payment history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!customerId) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div 
        className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black rounded-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Payment History</h2>
              <p className="text-sm text-slate-500">View all past transactions</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-slate-100">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No payment history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        payment.status === 'CLEARED' ? 'bg-green-100' : 
                        payment.status === 'PENDING' ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        <DollarSign className={`w-4 h-4 ${
                          payment.status === 'CLEARED' ? 'text-green-600' : 
                          payment.status === 'PENDING' ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-black">Sale #{payment.saleId}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            payment.status === 'CLEARED' ? 'bg-green-100 text-green-700' : 
                            payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(payment.paidAt).toLocaleString()} • {payment.method}
                        </p>
                        {payment.referenceId && (
                          <p className="text-xs text-slate-500 mt-1">Ref: {payment.referenceId}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        KSh {payment.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        on {new Date(payment.saleDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Customer Selector
const CustomerSelector = ({ 
  customers, 
  onSelect,
  onImportFromPhone
}: { 
  customers: Customer[]; 
  onSelect: (customer: Customer | null) => void;
  onImportFromPhone: (contact: any) => void;
}) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    
    if (id === "") {
      onSelect(null);
    } else {
      const customer = customers.find(c => c.id === parseInt(id));
      onSelect(customer || null);
    }
  };

  const handlePickContact = async () => {
    try {
      if (!('contacts' in navigator) || !('ContactsManager' in window)) {
        alert('Contact Picker API is not supported on this device/browser.');
        return;
      }

      const props = ['name', 'tel', 'email'];
      const opts = { multiple: false };

      // @ts-ignore
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        onImportFromPhone({
          name: contact.name?.[0] || '',
          phone: contact.tel?.[0] || '',
          email: contact.email?.[0] || ''
        });
      }
    } catch (err) {
      console.error('Error picking contact:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-black mb-4">Select Customer</h2>
        
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
            />
          </div>

          {/* Customer select */}
          <select
            value={selectedId}
            onChange={handleSelect}
            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
          >
            <option value="">-- Choose a customer --</option>
            {filteredCustomers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </option>
            ))}
          </select>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          <button
            onClick={handlePickContact}
            className="w-full bg-black hover:bg-slate-900 text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" /> Import from Phone Contacts
          </button>
        </div>

        {searchQuery && filteredCustomers.length === 0 && (
          <p className="text-sm text-slate-500 mt-3 text-center">
            No customers found matching "{searchQuery}"
          </p>
        )}
      </div>
    </div>
  );
};

// Add Customer Form
const AddCustomerForm = ({ 
  onAddCustomer,
  initialData
}: { 
  onAddCustomer: (customer: Customer) => void;
  initialData?: { name: string; phone: string; email: string } | null;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Customer name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = { name: name.trim() };
      if (phone.trim()) payload.phone = phone.trim();
      if (email.trim()) payload.email = email.trim();

      const res = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create customer");

      const response = await res.json();
      const newCustomer: Customer = response.data || response;
      onAddCustomer(newCustomer);

      setName("");
      setPhone("");
      setEmail("");
    } catch (err) {
      console.error("Error adding customer:", err);
      alert("Failed to add customer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-black mb-4">Add New Customer</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
              placeholder="Enter customer name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
              placeholder="Enter email address"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-black to-slate-800 hover:from-slate-900 hover:to-black text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Adding Customer...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Add Customer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Customer List Component
const CustomerList = ({
  customers,
  onDelete,
  onUpdate,
  onSelect
}: {
  customers: Customer[];
  onDelete: (id: number) => void;
  onUpdate: (customer: Customer) => void;
  onSelect: (customer: Customer) => void;
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", phone: "", email: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: "", phone: "", email: "" });
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch("/api/customer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editData }),
      });

      if (!res.ok) throw new Error("Failed to update customer");

      const response = await res.json();
      const updatedCustomer: Customer = response.data || response;
      onUpdate(updatedCustomer);
      cancelEdit();
    } catch (err) {
      console.error("Error updating customer:", err);
      alert("Failed to update customer. Please try again.");
    }
  };

  if (!customers.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
        <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-black mb-2">No Customers Yet</h3>
        <p className="text-slate-500">Add your first customer using the form above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-black focus:border-black text-black transition-all"
        />
      </div>

      {/* Customer count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {filteredCustomers.length} of {customers.length} customers
        </p>
      </div>

      {/* Customer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-200"
          >
            {editingId === customer.id ? (
              <div className="p-4 space-y-3">
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-black text-sm"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-black text-sm"
                  placeholder="Phone"
                />
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded text-black text-sm"
                  placeholder="Email"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveEdit(customer.id)}
                    className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => onSelect(customer)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-black text-lg">{customer.name}</h3>
                      <div className="space-y-1 mt-2">
                        {customer.phone && (
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </p>
                        )}
                        {customer.email && (
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <Mail className="w-3 h-3" /> {customer.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(customer);
                        }}
                        className="p-2 text-slate-500 hover:text-black hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(customer.id);
                        }}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {customer.totalSales !== undefined && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Total Sales</span>
                        <span className="font-medium text-black">
                          KSh {customer.totalSales.toLocaleString()}
                        </span>
                      </div>
                      {customer.totalCredit !== undefined && customer.totalCredit > 0 && (
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-slate-500">Credit Balance</span>
                          <span className="font-medium text-red-600">
                            KSh {customer.totalCredit.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    ID: #{customer.id}
                  </span>
                  <button
                    onClick={() => onSelect(customer)}
                    className="text-xs font-medium text-black hover:text-slate-700 flex items-center gap-1"
                  >
                    Select <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && searchQuery && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-black font-medium">No customers found</p>
          <p className="text-sm text-slate-500 mt-1">
            No results matching "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  );
};

// Customer Report Component
const CustomerReport = ({ customer }: { customer: Customer | null }) => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [reportType, setReportType] = useState<'full' | 'outstanding'>('outstanding');

  const generateReport = async (type: 'full' | 'outstanding') => {
    if (!customer) {
      alert('Please select a customer first');
      return;
    }

    setLoading(true);
    setReportType(type);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const salesRes = await fetch(`/api/sales?customerId=${customer.id}`);
      if (!salesRes.ok) throw new Error("Failed to fetch sales");
      const salesData = await salesRes.json();
      
      const sales = Array.isArray(salesData) ? salesData : (salesData.data || []);
      
      const processedSales = sales.map((sale: any) => {
        const totalPaid = sale.payment?.reduce((sum: number, p: any) => 
          p.status === "CLEARED" ? sum + p.amount : sum, 0) || 0;
        
        return {
          id: sale.id,
          date: sale.date,
          amount: sale.amount,
          paidAmount: totalPaid,
          remainingBalance: sale.amount - totalPaid,
          status: totalPaid === 0 ? 'UNPAID' : totalPaid >= sale.amount ? 'PAID' : 'PARTIAL',
          dueDate: sale.dueDate,
          items: sale.saleitem?.map((item: any) => ({
            name: item.product?.name,
            quantity: item.quantity,
            price: item.price
          }))
        };
      });

      const totalSales = processedSales.reduce((sum: number, s: any) => sum + s.amount, 0);
      const totalPaid = processedSales.reduce((sum: number, s: any) => sum + s.paidAmount, 0);
      const outstandingBalance = processedSales
        .filter((s: any) => s.status !== 'PAID')
        .reduce((sum: number, s: any) => sum + s.remainingBalance, 0);

      const report = {
        sales: processedSales,
        totalSales,
        totalPaid,
        outstandingBalance,
        customerName: customer.name,
        customerId: customer.id
      };

      setReportData(report);
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating report:', err);
      if ((err as any).name === 'AbortError') {
        alert('Report generation timed out. Try again.');
      } else {
        alert(err instanceof Error ? err.message : 'Failed to generate report. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const downloadCSV = (type: 'full' | 'outstanding') => {
    if (!reportData || !customer) return;
    
    let salesToExport = reportData.sales || [];
    if (type === 'outstanding') {
      salesToExport = salesToExport.filter((sale: any) => sale.status !== 'PAID');
    }

    if (salesToExport.length === 0) {
      alert(type === 'outstanding' 
        ? 'No outstanding sales found for this customer' 
        : 'No sales found for this customer');
      return;
    }

    let csvContent = "Sale ID,Date,Amount,Paid Amount,Remaining Balance,Status,Due Date,Items,Receipt Link\n";
    
    salesToExport.forEach((sale: any) => {
      const itemsList = sale.items?.map((item: any) => 
        `${item.name} x${item.quantity}`
      ).join('; ') || 'No items';
      
      const receiptLink = generateReceiptLink(sale.id);
      
      csvContent += `${sale.id},${new Date(sale.date).toLocaleDateString()},${sale.amount},${sale.paidAmount},${sale.remainingBalance},${sale.status},${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'},"${itemsList}",${receiptLink}\n`;
    });

    csvContent += "\nSUMMARY\n";
    csvContent += `Total Sales,${salesToExport.reduce((sum: number, s: any) => sum + s.amount, 0)}\n`;
    csvContent += `Total Paid,${salesToExport.reduce((sum: number, s: any) => sum + s.paidAmount, 0)}\n`;
    if (type === 'outstanding') {
      csvContent += `Total Outstanding,${salesToExport.reduce((sum: number, s: any) => sum + s.remainingBalance, 0)}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customer.name}_${type}_statement_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!customer) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Reports & Analytics</h2>
              <p className="text-sm text-slate-500">Select a customer to generate reports</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-black rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-black">Reports & Analytics</h2>
            <p className="text-sm text-slate-500">{customer.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => generateReport('full')}
            disabled={loading}
            className="bg-gradient-to-r from-black to-slate-800 hover:from-slate-900 hover:to-black text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            {loading && reportType === 'full' ? 'Generating...' : 'Full Statement'}
          </button>
          
          <button
            onClick={() => generateReport('outstanding')}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            {loading && reportType === 'outstanding' ? 'Generating...' : 'Outstanding Only'}
          </button>
        </div>

        {showPreview && reportData && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-black">Report Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadCSV('full')}
                  className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Download className="w-4 h-4" /> Full CSV
                </button>
                <button
                  onClick={() => downloadCSV('outstanding')}
                  className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1"
                >
                  <Download className="w-4 h-4" /> Outstanding CSV
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500">Total Sales</p>
                  <p className="text-lg font-bold text-black">KSh {reportData.totalSales?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Paid</p>
                  <p className="text-lg font-bold text-green-600">KSh {reportData.totalPaid?.toLocaleString() || 0}</p>
                </div>
              </div>
              
              {reportData.outstandingBalance > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-red-700">Outstanding Balance</p>
                  <p className="text-xl font-bold text-red-600">KSh {reportData.outstandingBalance?.toLocaleString()}</p>
                </div>
              )}
              
              <p className="text-xs text-slate-500 mt-3">
                {reportType === 'outstanding' 
                  ? `Showing ${reportData.sales.filter((s: any) => s.status !== 'PAID').length} unpaid/partial sales` 
                  : `Showing all ${reportData.sales.length} sales`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main CustomerPage Component
const CustomerPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [importedContact, setImportedContact] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("/api/customer", { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Failed to fetch customers");

        const response = await res.json();

        const list = (response.success && response.data) ? response.data : (Array.isArray(response) ? response : []);
        setCustomers(list);
      } catch (err) {
        console.error("Error fetching customers:", err);
        setError("Failed to load customers. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [refreshKey]);

  const handleAddCustomer = (customer: Customer) => {
    setCustomers(prev => [customer, ...prev]);
    setImportedContact(null);
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    
    try {
      const res = await fetch(`/api/customer?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      
      setCustomers(prev => prev.filter((c) => c.id !== id));
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert("Failed to delete customer. Please try again.");
    }
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers(prev => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated);
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
  };

  const handleImportFromPhone = (contact: any) => {
    setImportedContact(contact);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handlePaymentComplete = () => {
    setRefreshKey(prev => prev + 1);
    
    if (selectedCustomer) {
      fetch(`/api/customer?id=${selectedCustomer.id}`)
        .then(res => res.json())
        .then(data => {
          const updatedCustomer = data.data || data;
          if (updatedCustomer) {
            setSelectedCustomer(updatedCustomer);
            setCustomers(prev => prev.map(c => 
              c.id === updatedCustomer.id ? updatedCustomer : c
            ));
          }
        })
        .catch(err => console.error("Error refreshing customer:", err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-transparent mb-4"></div>
          <p className="text-slate-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-black mb-2">Error Loading Customers</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-900 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Customers</h1>
          <p className="text-slate-500 mt-1">Manage your customer database, track credit, and process payments</p>
        </div>

        {/* Search Bar */}
        <SearchBar 
          onSearch={setGlobalSearchQuery} 
          onFilter={() => {}}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Selection & Add Form */}
          <div className="lg:col-span-1 space-y-6">
            <CustomerSelector 
              customers={customers} 
              onSelect={handleSelectCustomer}
              onImportFromPhone={handleImportFromPhone}
            />
            
            {importedContact && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg">
                <p className="font-medium mb-1">Contact imported!</p>
                <p className="text-sm">Review details below and click Add Customer.</p>
              </div>
            )}
            
            <AddCustomerForm 
              onAddCustomer={handleAddCustomer}
              initialData={importedContact}
            />
          </div>

          {/* Right Column - Customer Details & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCustomer && (
              <>
                {/* Selected Customer Banner */}
                <div className="bg-gradient-to-r from-black to-slate-800 text-white rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm opacity-75 mb-1">Selected Customer</p>
                      <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                      <div className="flex flex-wrap gap-4 mt-3">
                        {selectedCustomer.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 opacity-75" />
                            <span>{selectedCustomer.phone}</span>
                          </div>
                        )}
                        {selectedCustomer.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 opacity-75" />
                            <span>{selectedCustomer.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-75">Customer ID</p>
                      <p className="text-2xl font-mono">#{selectedCustomer.id}</p>
                    </div>
                  </div>
                </div>

                {/* Credit Management */}
                <CreditManagement 
                  customer={selectedCustomer} 
                  onPaymentComplete={handlePaymentComplete}
                />

                {/* Payment History */}
                <PaymentHistory customerId={selectedCustomer.id} />

                {/* Customer Report */}
                <CustomerReport customer={selectedCustomer} />
              </>
            )}

            {/* Customer List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-black mb-4">All Customers</h2>
                <CustomerList
                  customers={customers}
                  onDelete={handleDeleteCustomer}
                  onUpdate={handleUpdateCustomer}
                  onSelect={handleSelectCustomer}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerPage;