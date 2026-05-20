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
  Send, FileDown, FileSpreadsheet, ReceiptText, Share2,
  Smartphone, Mail as MailIcon, CheckCircle2, XCircle,
  AlertTriangle, Info, Copy, ExternalLink
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

interface PaymentAllocation {
  saleId: number;
  saleDate: string;
  amount: number;
  fullyPaid: boolean;
  remainingAfter: number;
  originalAmount: number;
  paidAmount: number;
  items?: SaleItem[];
}

interface ProcessedSale {
  id: number;
  date: string;
  amount: number;
  paidAmount: number;
  remainingBalance: number;
  status: string;
  paymentMethod?: string;
  dueDate?: string;
  saleitem?: SaleItem[];
  paidThisTime?: number;
  fullyPaid?: boolean;
}

interface PaymentResult {
  processedSales: { saleId: number; amount: number; fullyPaid: boolean }[];
  failedSales: { saleId: number; reason: string }[];
  creditUpdate: { amount: number; newTotal: number } | null;
  totalAmount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  newBalance: number;
  previousBalance: number;
  paidSales: ProcessedSale[];
  createdSaleIds: number[];
  allocations: PaymentAllocation[];
}

// Helper function to normalize phone number for duplicate checking
const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading 0 or +254
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '254' + cleaned.slice(1);
  } else if (cleaned.startsWith('254') && cleaned.length === 12) {
    // Already in correct format
  } else if (cleaned.startsWith('254') && cleaned.length === 13) {
    cleaned = cleaned.slice(3);
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
};

// Function to generate receipt link
const generateReceiptLink = (saleId: number): string => {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'https://swiftsuppliers.co.ke';
  
  return `${baseUrl}/api/receipt/${saleId}`;
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
const formatCurrency = (amount: number): string =>
  Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Format date with time
const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate customer statement message
const generateCustomerStatement = (
  customer: Customer,
  outstandingSales: OutstandingSale[],
  paymentAmount?: number,
  paymentAllocations?: PaymentAllocation[],
  paymentMethod?: string
): string => {
  const date = new Date().toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  let message = `*🏢 SWIFT SUPPLIERS*\n`;
  message += `*Customer Statement*\n`;
  message += `📅 ${date}\n`;
  message += `👤 ${customer.name}\n`;
  const totalOutstanding = outstandingSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);
  const totalPurchases = outstandingSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalPaid = outstandingSales.reduce((sum, sale) => sum + sale.paidAmount, 0);
  
  if (paymentAmount && paymentAllocations && paymentAllocations.length > 0) {
    message += `*✅ PAYMENT RECEIVED*\n`;
    message += `Amount: KSh ${formatCurrency(paymentAmount)}\n`;
    if (paymentMethod) message += `Method: ${paymentMethod}\n`;
    message += `*📊 HOW YOUR PAYMENT WAS APPLIED:*\n`;
    message += `─────────────────────\n\n`;
    paymentAllocations.forEach((alloc) => {
      message += `*Sale #${alloc.saleId}* - ${alloc.saleDate}\n`;
      message += `─────────────────────\n`;
      if (alloc.items && alloc.items.length > 0) {
        alloc.items.forEach(item => {
          if (item.product) {
            message += `• ${item.quantity}x ${item.product.name}\n`;
            message += `  @ KSh ${formatCurrency(item.price)} = KSh ${formatCurrency(item.price * item.quantity)}\n`;
          }
        });
      }
      message += `\n`;
      message += `Subtotal: KSh ${formatCurrency(alloc.originalAmount)}\n`;
      message += `Previously Paid: KSh ${formatCurrency(alloc.paidAmount)}\n`;
      message += `Paid Today: KSh ${formatCurrency(alloc.amount)}\n`;
      if (alloc.fullyPaid) {
        message += `Status: *✅ FULLY PAID*\n`;
      } else {
        message += `Remaining: KSh ${formatCurrency(alloc.remainingAfter)}\n`;
        message += `Status: *⏳ PARTIAL PAYMENT*\n`;
      }
      message += `🔗 Receipt: ${generateReceiptLink(alloc.saleId)}\n`;
      message += `─────────────────────\n\n`;
    });
  }
  
  if (outstandingSales.length > 0) {
    message += `*📋 OUTSTANDING SALES SUMMARY*\n`;
    message += `─────────────────────\n\n`;
    outstandingSales.forEach((sale) => {
      message += `*Sale #${sale.id}* - ${new Date(sale.date).toLocaleDateString()}\n`;
      message += `─────────────────────\n`;      
      if (sale.saleitem && sale.saleitem.length > 0) {
        sale.saleitem.forEach(item => {
          if (item.product) {
            message += `• ${item.quantity}x ${item.product.name}\n`;
            message += `  KSh ${formatCurrency(item.price)} each = KSh ${formatCurrency(item.price * item.quantity)}\n`;
          }
        });
      }     
      message += `\n`;
      message += `Total: KSh ${formatCurrency(sale.amount)}\n`;
      message += `Paid: KSh ${formatCurrency(sale.paidAmount)}\n`;
      message += `Balance: KSh ${formatCurrency(sale.remainingBalance)}\n`;    
      if (sale.dueDate) {
        const dueDate = new Date(sale.dueDate);
        const today = new Date();
        if (dueDate < today && sale.remainingBalance > 0) {
          message += `⚠️ *OVERDUE* - Due: ${new Date(sale.dueDate).toLocaleDateString()}\n`;
        } else {
          message += `Due: ${new Date(sale.dueDate).toLocaleDateString()}\n`;
        }
      } 
      message += `🔗 View Receipt: ${generateReceiptLink(sale.id)}\n`;
      message += `─────────────────────\n\n`;
    });
    message += `*💰 SUMMARY*\n`;
    message += `─────────────────────\n`;
    message += `Total Purchases: KSh ${formatCurrency(totalPurchases)}\n`;
    message += `Total Paid: KSh ${formatCurrency(totalPaid)}\n`;   
    if (totalOutstanding > 0) {
      message += `*Total Outstanding: KSh ${formatCurrency(totalOutstanding)}*\n`;     
    } else {
      message += `\n*✨ ACCOUNT FULLY PAID*\n`;
      message += `Thank you for being a valued customer!\n`;
    }
    message += `─────────────────────\n\n`;
  }

  message += `*🙏 THANK YOU*\n`;
  message += `─────────────────────\n`;
  
  if (totalOutstanding === 0) {
    message += `Thank you for being an amazing customer!\n`;
  } else {
    message += `Thank you for your continued business!\n`;
  }

  return message;
};

// Generate thank you message
const generateThankYouMessage = (
  customer: Customer, 
  outstandingSales: OutstandingSale[]
): string => {
  const date = new Date().toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const totalOutstanding = outstandingSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);
  const hasOutstanding = outstandingSales.length > 0 && totalOutstanding > 0;
  let message = `*🏢 SWIFT SUPPLIERS*\n`;
  message += `📅 ${date}\n`;
  message += `👤 ${customer.name}\n`; 
  message += `Dear ${customer.name},\n\n`;
  message += `*✨ Thank you for your purchase at SwiftMetals!! ✨*\n\n`; 
  
  if (hasOutstanding) {
    message += `*📊 ACCOUNT SUMMARY*\n`;
    message += `─────────────────────\n`;
    message += `*Outstanding Balance: KSh ${formatCurrency(totalOutstanding)}*\n\n`; 
    message += `*Outstanding Sales:*\n`;
    outstandingSales.forEach((sale) => {
      message += `• *Sale #${sale.id}* - ${new Date(sale.date).toLocaleDateString()}\n`;
      message += `  Amount: KSh ${formatCurrency(sale.amount)}\n`;
      message += `  Paid: KSh ${formatCurrency(sale.paidAmount)}\n`;
      message += `  Balance: KSh ${formatCurrency(sale.remainingBalance)}\n`;     
      message += `  🔗 Receipt: ${generateReceiptLink(sale.id)}\n`;
      message += `\n`;
    });
    message += `*⚠️ Payment Reminder*\n`;
    message += `Please help us clear your outstanding balance at your earliest convenience.\n`;    
    if (outstandingSales.some(s => s.dueDate && new Date(s.dueDate) < new Date())) {
      message += `\n*❗ Some payments are overdue*\n`;
    }
    message += `\n`;
  } else {
    message += `*🎉 Account Status: GOOD STANDING*\n`;
    message += `• No outstanding balance\n`;
    message += `• Account fully paid up\n`;
    message += `• Eligible for loyalty benefits\n\n`;   
    const recentPaidSales = outstandingSales.filter(s => s.status === 'PAID').slice(0, 3);
    if (recentPaidSales.length > 0) {
      message += `*📋 Recent Transactions:*\n`;
      recentPaidSales.forEach(sale => {
        message += `• Sale #${sale.id} - ${new Date(sale.date).toLocaleDateString()}\n`;
        message += `  Amount: KSh ${formatCurrency(sale.amount)}\n`;
        message += `  🔗 Receipt: ${generateReceiptLink(sale.id)}\n`;
      });
      message += `\n`;
    }
  }
  message += `Thank you once again for being part of the Swift Suppliers family.\n`;
  message += `We look forward to serving you again soon!\n\n`;
  message += `Warm regards,\n`;
  message += `*The Swift Suppliers Team*\n`;

  return message;
};

// Search and Filter Bar Component
const SearchBar = ({ onSearch, onFilter }: { onSearch: (query: string) => void; onFilter: () => void }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onFilter}
            className="px-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-black transition-all flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            <span className="hidden md:inline">Filter</span>
          </button>
          <button
            className="px-4 py-3 bg-black dark:bg-blue-600 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <DownloadCloud className="w-5 h-5" />
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Message Preview Component
const MessagePreview = ({
  customer,
  message,
  onSend,
  onClose,
  messageType,
  setMessageType
}: {
  customer: Customer;
  message: string;
  onSend: () => void;
  onClose: () => void;
  messageType: 'whatsapp' | 'sms' | 'email';
  setMessageType: (type: 'whatsapp' | 'sms' | 'email') => void;
}) => {
  const [editedMessage, setEditedMessage] = useState(message);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white">Message Preview</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400">Review and edit message before sending</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Message Type Selector */}
          <div className="flex gap-2">
            {customer.phone && (
              <>
                <button
                  onClick={() => setMessageType('whatsapp')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    messageType === 'whatsapp' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                <button
                  onClick={() => setMessageType('sms')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    messageType === 'sms' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  SMS
                </button>
              </>
            )}
            {customer.email && (
              <button
                onClick={() => setMessageType('email')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  messageType === 'email' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-600'
                }`}
              >
                <MailIcon className="w-4 h-4" />
                Email
              </button>
            )}
          </div>

          {/* Message Editor */}
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Message Content:
            </label>
            <textarea
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              rows={12}
              className="w-full p-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 font-mono text-sm"
            />
          </div>

          {/* Character Count */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 dark:text-gray-400">
              Characters: {editedMessage.length}
            </span>
            {messageType === 'sms' && editedMessage.length > 160 && (
              <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Will be sent as {Math.ceil(editedMessage.length / 160)} SMS parts
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
            <button
              onClick={() => {
                onSend();
                onClose();
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send via {messageType === 'whatsapp' ? 'WhatsApp' : messageType === 'sms' ? 'SMS' : 'Email'}
            </button>
          </div>

          {/* Delivery Info */}
          <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4 text-sm">
            <p className="font-medium text-black dark:text-white mb-2">📱 Delivery Information:</p>
            {messageType === 'whatsapp' && customer.phone && (
              <p className="text-slate-600 dark:text-gray-300">Sending to WhatsApp: {customer.phone}</p>
            )}
            {messageType === 'sms' && customer.phone && (
              <p className="text-slate-600 dark:text-gray-300">Sending SMS to: {customer.phone}</p>
            )}
            {messageType === 'email' && customer.email && (
              <p className="text-slate-600 dark:text-gray-300">Sending email to: {customer.email}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Credit Management Component - Updated with TILL instead of MPESA
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
  const [allocationPreview, setAllocationPreview] = useState<PaymentAllocation[]>([]);
  const [processingSaleId, setProcessingSaleId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  
  // States for message flow
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [pendingPaymentResult, setPendingPaymentResult] = useState<PaymentResult | null>(null);
  const [messageType, setMessageType] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [processedSales, setProcessedSales] = useState<ProcessedSale[]>([]);
  const [generatedMessage, setGeneratedMessage] = useState<string>("");

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
            saleitem: sale.saleitem?.map((item: any) => ({
              ...item,
              product: item.product
            }))
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
          saleitem: sale.saleitem?.map((item: any) => ({
            ...item,
            product: item.product
          }))
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
    const preview: PaymentAllocation[] = [];
    
    for (const sale of sales) {
      if (remaining <= 0) break;
      
      const allocAmount = Math.min(remaining, sale.remainingBalance);
      preview.push({
        saleId: sale.id,
        saleDate: new Date(sale.date).toLocaleDateString(),
        amount: allocAmount,
        fullyPaid: Math.abs(allocAmount - sale.remainingBalance) < 0.01,
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

  const getTotalOutstanding = (): number => {
    return outstandingSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);
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
      const processedSalesList: { saleId: number; amount: number; fullyPaid: boolean }[] = [];
      const paidSalesList: ProcessedSale[] = [];
      const failedSales: { saleId: number; reason: string }[] = [];
      const createdSaleIds: number[] = [];

      // Calculate previous balance
      const previousBalance = outstandingSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);

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
        
        createdSaleIds.push(sale.id);
        
        processedSalesList.push({
          saleId: sale.id,
          amount: paymentForThisSale,
          fullyPaid: updatedSale.status === "PAID"
        });

        paidSalesList.push({
          ...sale,
          paidThisTime: paymentForThisSale,
          fullyPaid: updatedSale.status === "PAID"
        });

        remainingAmount -= paymentForThisSale;
      }

      let creditUpdate: { amount: number; newTotal: number } | null = null;
      
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

      // Calculate new balance
      const newBalance = previousBalance - amount;

      // Store processed sales for display
      setProcessedSales(paidSalesList);

      const result: PaymentResult = {
        processedSales: processedSalesList,
        failedSales,
        creditUpdate,
        totalAmount: amount,
        allocatedAmount: amount - remainingAmount,
        unallocatedAmount: remainingAmount,
        newBalance,
        previousBalance,
        paidSales: paidSalesList,
        createdSaleIds,
        allocations: allocationPreview
      };
      
      setPendingPaymentResult(result);

      // Generate message
      const message = generateCustomerStatement(
        customer,
        outstandingSales.map(sale => {
          const paidSale = paidSalesList.find(ps => ps.id === sale.id);
          return {
            ...sale,
            paidAmount: paidSale ? sale.paidAmount + (paidSale.paidThisTime || 0) : sale.paidAmount,
            remainingBalance: paidSale ? sale.remainingBalance - (paidSale.paidThisTime || 0) : sale.remainingBalance
          };
        }),
        amount,
        allocationPreview,
        paymentMethod
      );
      
      setGeneratedMessage(message);
      setShowMessagePreview(true);

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

  const sendThankYouMessage = () => {
    if (!customer) return;
    
    const message = generateThankYouMessage(customer, outstandingSales);
    setGeneratedMessage(message);
    setShowMessagePreview(true);
  };

  const sendStatementMessage = () => {
    if (!customer) return;
    
    const message = generateCustomerStatement(customer, outstandingSales);
    setGeneratedMessage(message);
    setShowMessagePreview(true);
  };

  const handleSendMessage = () => {
    if (!customer || !generatedMessage) return;

    if (messageType === 'whatsapp' && customer.phone) {
      const formattedPhone = formatPhoneToKenyaCode(customer.phone);
      const encodedMessage = encodeURIComponent(generatedMessage);
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
    } else if (messageType === 'sms' && customer.phone) {
      const formattedPhone = formatPhoneToKenyaCode(customer.phone);
      const encodedMessage = encodeURIComponent(generatedMessage);
      const smsUrl = `sms:${formattedPhone}?body=${encodedMessage}`;
      window.location.href = smsUrl;
    } else if (messageType === 'email' && customer.email) {
      const subject = encodeURIComponent(`Customer Statement - Swift Suppliers`);
      const emailUrl = `mailto:${customer.email}?subject=${subject}&body=${encodeURIComponent(generatedMessage)}`;
      window.location.href = emailUrl;
    }
    
    handleCompletePayment();
  };

  const handleCompletePayment = () => {
    fetchOutstandingSales();
    fetchAllSales();
    onPaymentComplete();
    
    setShowMessagePreview(false);
    setPendingPaymentResult(null);
    setProcessedSales([]);
    setGeneratedMessage("");
  };

  const viewReceipt = (saleId: number) => {
    const receiptLink = generateReceiptLink(saleId);
    window.open(receiptLink, '_blank');
  };

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
        `${item.product?.name} x${item.quantity} @ KSh ${item.price}`
      ).join('; ') || 'No items';
      
      const receiptLink = generateReceiptLink(sale.id);
      
      csvContent += `${sale.id},${new Date(sale.date).toLocaleDateString()},${sale.amount},${sale.paidAmount},${sale.remainingBalance},${sale.status},${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'},"${itemsList}",${receiptLink}\n`;
    });

    csvContent += "\nOUTSTANDING SUMMARY\n";
    csvContent += `Total Outstanding,${outstandingToExport.reduce((sum, s) => sum + s.remainingBalance, 0)}\n`;
    csvContent += `Number of Outstanding Sales,${outstandingToExport.length}\n`;
    csvContent += `As of,${new Date().toLocaleString()}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customer.name}_outstanding_statement_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!customer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 dark:bg-gray-700 rounded-lg">
              <CreditCard className="w-6 h-6 text-slate-600 dark:text-gray-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white">Credit Management</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Select a customer to manage credit payments</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
      <div 
        className="p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black dark:bg-blue-600 rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white">Credit Management</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">{customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-gray-400">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                KSh {formatCurrency(getTotalOutstanding())}
              </p>
            </div>
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-slate-100 dark:border-gray-700">
          {/* Message Preview Modal */}
          {showMessagePreview && customer && generatedMessage && (
            <MessagePreview
              customer={customer}
              message={generatedMessage}
              onSend={handleSendMessage}
              onClose={handleCompletePayment}
              messageType={messageType}
              setMessageType={setMessageType}
            />
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <button
              onClick={sendStatementMessage}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <FileText className="w-4 h-4" />
              Send Statement
            </button>
            
            <button
              onClick={sendThankYouMessage}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Thank You Message
            </button>
            
            <button
              onClick={downloadOutstandingStatement}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Download Statement
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-black dark:border-blue-500 border-t-transparent mb-3"></div>
              <p className="text-slate-500 dark:text-gray-400">Loading outstanding sales...</p>
            </div>
          ) : (
            <>
              {/* Outstanding Sales List */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-black dark:text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Outstanding Sales (Not Fully Paid)
                  </h3>
                  <button 
                    onClick={fetchOutstandingSales}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                
                {outstandingSales.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-slate-700 dark:text-gray-300 font-medium">No outstanding sales</p>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">This customer has no pending payments.</p>
                    
                    {/* Send Thank You Button for Clean Account */}
                    <button
                      onClick={sendThankYouMessage}
                      className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center gap-2 mx-auto"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Send Thank You Message
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outstandingSales.map((sale) => (
                      <div 
                        key={sale.id} 
                        className={`bg-slate-50 dark:bg-gray-700 rounded-lg p-4 border transition-all ${
                          processingSaleId === sale.id 
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' 
                            : 'border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="text-sm font-medium text-black dark:text-white">Sale #{sale.id}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                sale.status === 'OVERDUE' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 
                                sale.status === 'PARTIAL' ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 
                                'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                              }`}>
                                {sale.status}
                              </span>
                              {sale.dueDate && new Date(sale.dueDate) < new Date() && sale.status !== 'PAID' && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Overdue
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Date</p>
                                <p className="text-black dark:text-white">{new Date(sale.date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Total</p>
                                <p className="text-black dark:text-white font-medium">KSh {formatCurrency(sale.amount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Paid</p>
                                <p className="text-green-600 dark:text-green-400 font-medium">KSh {formatCurrency(sale.paidAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-gray-400">Remaining</p>
                                <p className="text-red-600 dark:text-red-400 font-bold">KSh {formatCurrency(sale.remainingBalance)}</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500 dark:text-gray-400">Payment Progress</span>
                                <span className="font-medium text-black dark:text-white">
                                  {((sale.paidAmount / sale.amount) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(sale.paidAmount / sale.amount) * 100}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Sale Items with Receipt Link */}
                            {sale.saleitem && sale.saleitem.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-600">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-xs font-medium text-slate-500 dark:text-gray-400">Items Purchased:</p>
                                  <button
                                    onClick={() => viewReceipt(sale.id)}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <ReceiptText className="w-3 h-3" />
                                    View Receipt
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {sale.saleitem.map((item) => (
                                    <div key={item.id} className="flex justify-between text-xs">
                                      <span className="text-slate-600 dark:text-gray-300">
                                        {item.product?.name} x{item.quantity}
                                      </span>
                                      <span className="text-black dark:text-white font-medium">
                                        KSh {formatCurrency(item.price * item.quantity)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {processingSaleId === sale.id && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg">
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

              {/* Payment Form - Updated with TILL instead of MPESA */}
              {outstandingSales.length > 0 && !showMessagePreview && (
                <div className="border-t border-slate-200 dark:border-gray-700 pt-6">
                  <h3 className="font-semibold text-black dark:text-white mb-4">Process Payment</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-black dark:text-white mb-2">
                          Payment Amount (KSh)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">KSh</span>
                          <input
                            type="number"
                            value={paymentAmount}
                            onChange={handleAmountChange}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black dark:text-white mb-2">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full p-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
                        >
                          <option value="CASH">Cash</option>
                          <option value="TILL">Till</option>
                          <option value="BANK">Bank Transfer</option>
                          <option value="CHECK">Cheque</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black dark:text-white mb-2">
                          Note / Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          placeholder="e.g., Till Ref: ABC123"
                          className="w-full p-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
                        />
                      </div>
                    </div>

                    {/* Allocation Preview */}
                    <div>
                      {allocationPreview.length > 0 ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800 h-full">
                          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4" />
                            Payment Allocation Preview
                          </h4>
                          <div className="space-y-4">
                            {allocationPreview.map((alloc, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                                    Sale #{alloc.saleId}
                                  </span>
                                  <span className="font-bold text-blue-900 dark:text-blue-200">
                                    KSh {formatCurrency(alloc.amount)}
                                  </span>
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                                  {alloc.saleDate}
                                </div>
                                
                                {/* Items in this sale */}
                                {alloc.items && alloc.items.length > 0 && (
                                  <div className="mb-2 text-xs">
                                    {alloc.items.slice(0, 2).map((item) => (
                                      <div key={item.id} className="text-blue-600 dark:text-blue-400">
                                        • {item.product?.name} x{item.quantity}
                                      </div>
                                    ))}
                                    {alloc.items.length > 2 && (
                                      <div className="text-blue-400">
                                        +{alloc.items.length - 2} more items
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-blue-200 dark:bg-blue-700 rounded-full overflow-hidden">
                                    <div 
                                      className="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
                                      style={{ 
                                        width: `${((alloc.paidAmount + alloc.amount) / alloc.originalAmount) * 100}%` 
                                      }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    alloc.fullyPaid ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                                  }`}>
                                    {alloc.fullyPaid ? '✅ Paid' : '⏳ Partial'}
                                  </span>
                                </div>
                                {!alloc.fullyPaid && (
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    Remaining: KSh {formatCurrency(alloc.remainingAfter)}
                                  </p>
                                )}
                              </div>
                            ))}
                            
                            {parseFloat(paymentAmount) > getTotalOutstanding() && (
                              <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                  <PiggyBank className="w-4 h-4" />
                                  <strong>KSh {formatCurrency(parseFloat(paymentAmount) - getTotalOutstanding())}</strong> will be added to credit balance
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-8 text-center h-full flex items-center justify-center">
                          <div>
                            <DollarSign className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-500 dark:text-gray-400">Enter an amount to see allocation preview</p>
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
                        Process Payment & Send Statement
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-2 text-center">
                    After payment, you can review and send a detailed statement to the customer
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
          saleAmount: sale.amount,
          receiptLink: generateReceiptLink(sale.id)
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

  const viewReceipt = (saleId: number) => {
    window.open(generateReceiptLink(saleId), '_blank');
  };

  if (!customerId) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
      <div 
        className="p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black dark:bg-blue-600 rounded-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white">Payment History</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">View all past transactions</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-6 border-t border-slate-100 dark:border-gray-700">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-black dark:border-blue-500 border-t-transparent"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-gray-400">No payment history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4 border border-slate-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-gray-500 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        payment.status === 'CLEARED' ? 'bg-green-100 dark:bg-green-900' : 
                        payment.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        <DollarSign className={`w-4 h-4 ${
                          payment.status === 'CLEARED' ? 'text-green-600 dark:text-green-400' : 
                          payment.status === 'PENDING' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-black dark:text-white">Sale #{payment.saleId}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            payment.status === 'CLEARED' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 
                            payment.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {formatDateTime(payment.paidAt)} • {payment.method}
                        </p>
                        {payment.referenceId && (
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Ref: {payment.referenceId}</p>
                        )}
                        {payment.note && (
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Note: {payment.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          KSh {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          on {new Date(payment.saleDate).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => viewReceipt(payment.saleId)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="View Receipt"
                      >
                        <ReceiptText className="w-5 h-5" />
                      </button>
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Select Customer</h2>
        
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
            />
          </div>

          {/* Customer select */}
          <select
            value={selectedId}
            onChange={handleSelect}
            className="w-full p-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
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
              <div className="w-full border-t border-slate-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={handlePickContact}
            className="w-full bg-black dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" /> Import from Phone Contacts
          </button>
        </div>

        {searchQuery && filteredCustomers.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-3 text-center">
            No customers found matching "{searchQuery}"
          </p>
        )}
      </div>
    </div>
  );
};

// Add Customer Form with Duplicate Prevention
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
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; email?: string }>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
    }
  }, [initialData]);

  // Real-time validation for phone and email
  const validatePhone = (value: string): boolean => {
    if (!value) return true; // Optional field
    const normalized = normalizePhoneNumber(value);
    return normalized.length === 12; // 254XXXXXXXXX format
  };

  const validateEmail = (value: string): boolean => {
    if (!value) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    if (value && !validatePhone(value)) {
      setFieldErrors(prev => ({ ...prev, phone: "Invalid phone number format" }));
    } else {
      setFieldErrors(prev => ({ ...prev, phone: undefined }));
    }
    setDuplicateError(null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !validateEmail(value)) {
      setFieldErrors(prev => ({ ...prev, email: "Invalid email format" }));
    } else {
      setFieldErrors(prev => ({ ...prev, email: undefined }));
    }
    setDuplicateError(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setDuplicateError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setDuplicateError("Customer name is required");
      return;
    }

    if (phone && !validatePhone(phone)) {
      setDuplicateError("Please enter a valid phone number");
      return;
    }

    if (email && !validateEmail(email)) {
      setDuplicateError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    setDuplicateError(null);

    try {
      const payload: any = { 
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null
      };

      const res = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await res.json();

      if (!res.ok) {
        // Check for duplicate error
        if (response.error && (
          response.error.includes("duplicate") || 
          response.error.includes("already exists") ||
          response.error.includes("unique")
        )) {
          setDuplicateError("A customer with similar details already exists. Please check the phone number or email.");
        } else {
          throw new Error(response.error || "Failed to create customer");
        }
        return;
      }

      const newCustomer: Customer = response.data || response;
      onAddCustomer(newCustomer);

      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setDuplicateError(null);
      setFieldErrors({});
      
    } catch (err) {
      console.error("Error adding customer:", err);
      setDuplicateError("Failed to add customer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Add New Customer</h2>
        
        {/* Duplicate Error Display */}
        {duplicateError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{duplicateError}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Please check if this customer already exists in the list above.
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all ${
                duplicateError ? 'border-red-500' : 'border-slate-200 dark:border-gray-600'
              }`}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black dark:text-white mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Phone (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all ${
                fieldErrors.phone ? 'border-red-500' : 'border-slate-200 dark:border-gray-600'
              }`}
              placeholder="Enter phone number (e.g., 0712345678)"
            />
            {fieldErrors.phone && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.phone}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              Format: 07XXXXXXXX or 254XXXXXXXXX
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-black dark:text-white mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all ${
                fieldErrors.email ? 'border-red-500' : 'border-slate-200 dark:border-gray-600'
              }`}
              placeholder="Enter email address"
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-black to-slate-800 dark:from-blue-600 dark:to-blue-700 hover:from-slate-900 hover:to-black dark:hover:from-blue-700 dark:hover:to-blue-800 text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

      if (!res.ok) {
        const response = await res.json();
        if (response.error && response.error.includes("duplicate")) {
          alert("A customer with these details already exists.");
          return;
        }
        throw new Error("Failed to update customer");
      }

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-12 text-center">
        <Users className="w-16 h-16 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-black dark:text-white mb-2">No Customers Yet</h3>
        <p className="text-slate-500 dark:text-gray-400">Add your first customer using the form above.</p>
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
          className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-blue-500 focus:border-black dark:focus:border-blue-500 text-black dark:text-white bg-white dark:bg-gray-700 transition-all"
        />
      </div>

      {/* Customer count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-gray-400">
          Showing {filteredCustomers.length} of {customers.length} customers
        </p>
      </div>

      {/* Customer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all duration-200"
          >
            {editingId === customer.id ? (
              <div className="p-4 space-y-3">
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full p-2 border border-slate-200 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  placeholder="Phone"
                />
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full p-2 border border-slate-200 dark:border-gray-600 rounded text-black dark:text-white bg-white dark:bg-gray-700 text-sm"
                  placeholder="Email"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveEdit(customer.id)}
                    className="flex-1 bg-black dark:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-900 dark:hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1"
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
                      <h3 className="font-semibold text-black dark:text-white text-lg">{customer.name}</h3>
                      <div className="space-y-1 mt-2">
                        {customer.phone && (
                          <p className="text-sm text-slate-600 dark:text-gray-300 flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {customer.phone}
                          </p>
                        )}
                        {customer.email && (
                          <p className="text-sm text-slate-600 dark:text-gray-300 flex items-center gap-2">
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
                        className="p-2 text-slate-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(customer.id);
                        }}
                        className="p-2 text-slate-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {customer.totalSales !== undefined && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-700">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 dark:text-gray-400">Total Sales</span>
                        <span className="font-medium text-black dark:text-white">
                          KSh {formatCurrency(customer.totalSales)}
                        </span>
                      </div>
                      {customer.totalCredit !== undefined && customer.totalCredit > 0 && (
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-slate-500 dark:text-gray-400">Credit Balance</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            KSh {formatCurrency(customer.totalCredit)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-gray-700 px-4 py-2 border-t border-slate-100 dark:border-gray-600 flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    ID: #{customer.id}
                  </span>
                  <button
                    onClick={() => onSelect(customer)}
                    className="text-xs font-medium text-black dark:text-white hover:text-slate-700 dark:hover:text-gray-300 flex items-center gap-1"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-8 text-center">
          <Search className="w-12 h-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-black dark:text-white font-medium">No customers found</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
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

  const generateReport = async () => {
    if (!customer) {
      alert('Please select a customer first');
      return;
    }

    setLoading(true);
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
            price: item.price,
            total: item.price * item.quantity
          })),
          receiptLink: generateReceiptLink(sale.id)
        };
      });

      const outstandingSales = processedSales.filter((s: any) => s.status !== 'PAID');
      const totalOutstanding = outstandingSales.reduce((sum: number, s: any) => sum + s.remainingBalance, 0);
      const totalPurchases = outstandingSales.reduce((sum: number, s: any) => sum + s.amount, 0);
      const totalPaid = outstandingSales.reduce((sum: number, s: any) => sum + s.paidAmount, 0);

      const report = {
        sales: outstandingSales,
        totalSales: totalPurchases,
        totalPaid,
        totalOutstanding,
        customerName: customer.name,
        customerId: customer.id,
        numberOfOutstanding: outstandingSales.length,
        generatedAt: new Date().toISOString()
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

  const downloadCSV = () => {
    if (!reportData || !customer) return;
    
    const salesToExport = reportData.sales || [];

    if (salesToExport.length === 0) {
      alert('No outstanding sales found for this customer');
      return;
    }

    let csvContent = "Sale ID,Date,Amount,Paid Amount,Remaining Balance,Status,Due Date,Items,Receipt Link\n";
    
    salesToExport.forEach((sale: any) => {
      const itemsList = sale.items?.map((item: any) => 
        `${item.name} x${item.quantity} @ KSh ${item.price}`
      ).join('; ') || 'No items';
      
      csvContent += `${sale.id},${new Date(sale.date).toLocaleDateString()},${sale.amount},${sale.paidAmount},${sale.remainingBalance},${sale.status},${sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'N/A'},"${itemsList}",${sale.receiptLink}\n`;
    });

    csvContent += "\nOUTSTANDING SUMMARY\n";
    csvContent += `Total Outstanding,${reportData.totalOutstanding}\n`;
    csvContent += `Number of Outstanding Sales,${reportData.numberOfOutstanding}\n`;
    csvContent += `Generated on,${new Date(reportData.generatedAt).toLocaleString()}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customer.name}_outstanding_statement_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!customer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 dark:bg-gray-700 rounded-lg">
              <BarChart3 className="w-6 h-6 text-slate-600 dark:text-gray-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black dark:text-white">Reports & Analytics</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">Select a customer to generate reports</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-black dark:bg-blue-600 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-black dark:text-white">Outstanding Report</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400">{customer.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            {loading ? 'Generating...' : 'Generate Outstanding Report'}
          </button>
        </div>

        {showPreview && reportData && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-black dark:text-white">Outstanding Sales Preview</h3>
              <button
                onClick={downloadCSV}
                className="px-3 py-1 text-sm bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Download CSV
              </button>
            </div>
            
            <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Total Outstanding</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">KSh {formatCurrency(reportData.totalOutstanding)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Number of Sales</p>
                  <p className="text-lg font-bold text-black dark:text-white">{reportData.numberOfOutstanding}</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-3">
                Showing {reportData.sales.length} unpaid/partial sales
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black dark:border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-slate-600 dark:text-gray-400">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-black dark:text-white mb-2">Error Loading Customers</h2>
          <p className="text-slate-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-black dark:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-900 dark:hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-white">Customer Management</h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">Manage customers, track credit, process payments, and send statements</p>
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
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 p-4 rounded-lg">
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
                <div className="bg-gradient-to-r from-black to-slate-800 dark:from-gray-800 dark:to-gray-900 text-white rounded-xl p-6">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-black dark:text-white mb-4">All Customers</h2>
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