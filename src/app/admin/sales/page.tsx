// @ts-nocheck
"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { 
  Download, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, 
  Calculator, Save, ChevronDown, ChevronUp, Filter, Calendar, Search, XCircle, 
  User, DollarSign, Banknote, Smartphone, Landmark, CreditCard as CardIcon, 
  Archive, RotateCcw, Info, History, TrendingUp, TrendingDown, Clock as ClockIcon, 
  Users, Receipt, FileSpreadsheet, Moon, Sun, Menu, UserCheck, Gift
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// ==================== INTERFACES ====================

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

interface Product {
  id: number;
  name: string;
  price?: number;
  stock?: Array<{ quantity: number; costPrice: number }> | { quantity: number } | number;
  totalStock?: number;
}

interface SaleItem {
  id: number;
  product: Product;
  quantity: number;
  price: number;
}

interface Payment {
  id?: number;
  amount: number;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "TRADE_IN";
  date: string;
  referenceId?: string | null;
  checkDepositDate?: string | null;
  dueDate?: string | null;
  status?: "PENDING" | "COMPLETED" | "BOUNCED" | "CLEARED";
  bankName?: string | null;
}

// Trade-In item — one line item the customer is giving us
interface TradeInItem {
  id?: number;
  itemName: string;
  description?: string;
  category?: string;
  condition: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  quantity: number;
  unitValue: number;
  totalValue: number;
}

// Trade-In row as returned by the API (one row per item in DB)
interface TradeInRow {
  id: number;
  saleId: number;
  paymentId?: number | null;
  customerId: number;
  itemName: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  estimatedValue: number;
  agreedValue: number;
  condition: string;
  status: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface NewPayment {
  id?: number;
  amount: string;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "TRADE_IN";
  referenceId?: string;
  checkDepositDate?: string;
  checkNumber?: string;
  dueDate?: string;
  bankName?: string;
  checkDate?: string;
  isVerified?: boolean;
  status?: "PENDING" | "CLEARED" | "BOUNCED";
  tradeInItems?: TradeInItem[];
}

interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Sale {
  id: number;
  saleitems: SaleItem[];
  amount: number;
  date: string;
  status: "PAID" | "PARTIAL" | "UNPAID";
  dueDate?: string | null;
  customer: Customer;
  payments: Payment[];
  remainingAmount: number;
  paymentMethod?: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "TRADE_IN" | "MULTIPLE";
  checkDepositDate?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  assignedStaff?: Staff | null;
  assignedStaffId?: number | null;
  tradeins?: TradeInRow[];
}

interface NewSaleItem {
  id?: number;
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  originalPrice?: number;
}

interface UserDetail {
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
}

interface AuditLog {
  id: number;
  saleId: number;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  difference?: string;
  changedBy: string;
  changedByEmail?: string;
  changedAt: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  snapshot?: any;
  changeSummary?: string;
  changeCategory?: string;
}

interface DeletedSale {
  id: number;
  originalSaleId: number;
  saleData: any;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  saleDate: string;
  deletedAt: string;
  deletedBy: string;
  deletedByEmail: string;
  restockedItems: boolean;
  deletionReason: string | null;
  saleItemsSummary: string;
  paymentsSummary: string;
  statusAtDeletion: string;
  expiresAt: string;
  restoredAt?: string;
  restoredBy?: string;
}

interface RecentlyClearedDebt {
  saleId: number;
  customerName: string;
  customerPhone: string | null;
  originalAmount: number;
  clearedAmount: number;
  clearedAt: string;
  clearedBy: string;
  previousStatus: string;
  paymentMethod: string;
}

// ==================== TRADE-IN HELPERS ====================
const tradeInUnitValue = (t: any): number => Number(t?.agreedValue ?? t?.unitValue ?? 0);
const tradeInLineTotal = (t: any): number => (Number(t?.quantity) || 1) * tradeInUnitValue(t);
const tradeInSaleTotal = (tradeins: any[] | undefined): number => {
  if (!Array.isArray(tradeins)) return 0;
  return tradeins.reduce((s, t) => s + tradeInLineTotal(t), 0);
};

// ==================== THEME CONTEXT ====================
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });
function useTheme() { return React.useContext(ThemeContext); }

// ==================== MOBILE SALE CARD ====================
const MobileSaleCard = ({ sale, expandedSaleId, setExpandedSaleId, formatCurrency, formatDate, formatDateTime, getUserDisplayName, paymentMethods, isRecentlyUpdated, isSaleModified, handleViewAuditLog, handleEditSale, showDeleteConfirmationWithReason, loading }: any) => {
  const isExpanded = expandedSaleId === sale.id;
  const tradeInCount = Array.isArray(sale.tradeins) ? sale.tradeins.length : 0;
  const tradeInTotal = tradeInSaleTotal(sale.tradeins);

  const statusColors: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    UNPAID: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
      <div
        className="p-3 cursor-pointer select-none active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors"
        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-white text-[13px] truncate">
                {sale.customer?.name || "—"}
              </p>
              <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                #{sale.id}
              </span>
            </div>
            {sale.customer?.phone && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sale.customer.phone}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-[13px]">
              Ksh {formatCurrency(sale.amount)}
            </p>
            {sale.remainingAmount > 0 && (
              <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5">
                Due: Ksh {formatCurrency(sale.remainingAmount)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[sale.status] || statusColors.UNPAID}`}>
            {sale.status}
          </span>
          {sale.assignedStaff && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <UserCheck size={9} />
              {sale.assignedStaff.name.split(' ')[0]}
            </span>
          )}
          {tradeInCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <Gift size={9} />
              Trade-In · {tradeInCount}
            </span>
          )}
          {isRecentlyUpdated(sale) && isSaleModified(sale) && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              Updated
            </span>
          )}
          {sale.payments?.slice(0, 2).map((p: any, i: number) => {
            const m = paymentMethods.find((pm: any) => pm.value === p.method);
            const Icon = m?.icon || Banknote;
            return (
              <span key={i} className={`px-1.5 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${m?.color || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                <Icon size={9} />
                {p.method === "TRADE_IN" ? "Trade-In" : p.method}
              </span>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar size={10} />
            <span>{formatDate(sale.date)}</span>
          </div>
          <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
            <ChevronDown size={12} />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Receipt size={12} className="text-gray-400" />
                <span className="text-[11px] text-gray-600 dark:text-gray-400">Sale ID:</span>
                <span className="text-[11px] font-mono font-semibold text-gray-900 dark:text-white">#{sale.id}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  sale.status === "PAID" ? "bg-green-500" : 
                  sale.status === "PARTIAL" ? "bg-orange-500" : "bg-red-500"
                }`} />
                <span className="text-[10px] text-gray-500">{sale.status}</span>
              </div>
            </div>

            {sale.assignedStaff && (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-2.5 py-2 border border-indigo-100 dark:border-indigo-800">
                <UserCheck size={12} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-300">
                    <span className="font-medium">Assigned Staff:</span> {sale.assignedStaff.name}
                  </span>
                  {sale.assignedStaff.phone && (
                    <span className="text-[10px] text-indigo-400 ml-2">· {sale.assignedStaff.phone}</span>
                  )}
                </div>
              </div>
            )}

            {sale.createdBy && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2.5 py-2 border border-blue-100 dark:border-blue-800">
                <User size={12} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-[11px] text-blue-600 dark:text-blue-300">
                    <span className="font-medium">Created by:</span> {getUserDisplayName(sale.createdBy).name}
                  </span>
                  {sale.createdAt && (
                    <span className="text-[10px] text-blue-400 ml-2">· {formatDateTime(sale.createdAt)}</span>
                  )}
                </div>
              </div>
            )}

            {sale.updatedBy && sale.updatedAt && sale.updatedAt !== sale.createdAt && (
              <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg px-2.5 py-2 border border-teal-100 dark:border-teal-800">
                <ClockIcon size={12} className="text-teal-500 dark:text-teal-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-[11px] text-teal-600 dark:text-teal-300">
                    <span className="font-medium">Last updated by:</span> {getUserDisplayName(sale.updatedBy).name}
                  </span>
                  <span className="text-[10px] text-teal-400 ml-2">· {formatDateTime(sale.updatedAt)}</span>
                </div>
              </div>
            )}

            {sale.dueDate && (
              <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-2.5 py-2 border border-yellow-100 dark:border-yellow-800">
                <Calendar size={12} className="text-yellow-500 flex-shrink-0" />
                <span className="text-[11px] text-yellow-700 dark:text-yellow-300">
                  <span className="font-medium">Due Date:</span> {formatDate(sale.dueDate)}
                </span>
              </div>
            )}

            {sale.payments?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Payments</p>
                <div className="flex flex-wrap gap-1.5">
                  {sale.payments.map((p: any, i: number) => {
                    const m = paymentMethods.find((pm: any) => pm.value === p.method);
                    const Icon = m?.icon || Banknote;
                    return (
                      <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${m?.color || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}>
                        <Icon size={9} />
                        <span>{p.method === "TRADE_IN" ? "Trade-In" : p.method}</span>
                        {p.amount > 0 && <span className="opacity-80">· Ksh {formatCurrency(p.amount)}</span>}
                        {p.referenceId && <span className="text-[8px] opacity-70">({p.referenceId})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trade-In Items */}
            {tradeInCount > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Gift size={10} /> Trade-In Items ({tradeInCount})
                </p>
                <div className="space-y-1">
                  {sale.tradeins.map((t: any, i: number) => {
                    const qty = Number(t.quantity) || 1;
                    const unit = tradeInUnitValue(t);
                    const lineTotal = tradeInLineTotal(t);
                    return (
                      <div key={t.id ?? i} className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg px-2.5 py-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-purple-800 dark:text-purple-200 truncate">
                              {t.itemName || "Trade-In Item"}
                            </p>
                            <p className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5">
                              {t.category ? `${t.category} · ` : ""}
                              {t.condition ? <span className="font-semibold">{t.condition}</span> : null}
                              {t.condition ? " · " : ""}
                              {qty} × Ksh {formatCurrency(unit)}
                            </p>
                            {t.description && (
                              <p className="text-[9px] text-purple-500 dark:text-purple-400 mt-0.5 italic truncate">
                                {t.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] font-bold text-purple-800 dark:text-purple-200">
                              Ksh {formatCurrency(lineTotal)}
                            </p>
                            {t.status && (
                              <span className="text-[8px] text-purple-500 dark:text-purple-400">{t.status}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-[10px] font-bold text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/40 rounded-lg px-2.5 py-1.5 mt-1">
                    <span>Trade-In Total</span>
                    <span>Ksh {formatCurrency(tradeInTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {sale.saleitems?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg">
                  {sale.saleitems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1.5 border border-gray-100 dark:border-gray-700">
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 pr-2">{item.product.name}</span>
                      <span className="text-gray-400 flex-shrink-0 text-[10px]">×{item.quantity} · Ksh {formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
                className="flex items-center justify-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg py-2 text-[11px] font-medium active:scale-95 transition-transform border border-violet-100 dark:border-violet-800"
              >
                <Download size={11} />
                Receipt
              </button>
              <button
                onClick={() => handleEditSale(sale)}
                className="flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg py-2 text-[11px] font-medium active:scale-95 transition-transform border border-blue-100 dark:border-blue-800"
              >
                <Edit size={11} />
                Edit
              </button>
              <button
                onClick={() => handleViewAuditLog(sale)}
                className="flex items-center justify-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-lg py-2 text-[11px] font-medium active:scale-95 transition-transform border border-gray-200 dark:border-gray-600"
              >
                <History size={11} />
                History
              </button>
              <button
                onClick={() => showDeleteConfirmationWithReason(sale.id)}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg py-2 text-[11px] font-medium active:scale-95 transition-transform border border-rose-100 dark:border-rose-800 disabled:opacity-40"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== ACCOUNTING REPORTS MODAL ====================
interface AccountingReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  getUserDisplayName: (email: string | null | undefined) => { name: string; email: string };
}

function AccountingReportsModal({ isOpen, onClose, customers, getUserDisplayName }: AccountingReportsModalProps) {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "outstanding" | "customer" | "payment-activity">("daily");
  const [accountingDate, setAccountingDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountingStartDate, setAccountingStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [accountingEndDate, setAccountingEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountingCustomerId, setAccountingCustomerId] = useState("");
  const [accountingCustomerSearch, setAccountingCustomerSearch] = useState("");
  const [accountingShowCustomerDropdown, setAccountingShowCustomerDropdown] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [accountingPeriod, setAccountingPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const filteredCustomers = useMemo(() => {
    if (!accountingCustomerSearch.trim()) return customers;
    const searchLower = accountingCustomerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchLower) ||
      (c.phone && c.phone.includes(searchLower))
    );
  }, [customers, accountingCustomerSearch]);

  const downloadAccountingReport = async () => {
    setDownloadingReport(true);
    setError(null);
    
    try {
      let url = "";
      let filename = "";
      
      switch (reportType) {
        case "daily":
          url = `/api/paymentReports?type=daily&date=${accountingDate}`;
          filename = `daily-payments-${accountingDate}.csv`;
          break;
        case "weekly":
          url = `/api/paymentReports?type=weekly&date=${accountingDate}`;
          filename = `weekly-report-${accountingDate}.csv`;
          break;
        case "monthly":
          url = `/api/paymentReports?type=monthly&date=${accountingDate}`;
          filename = `monthly-report-${accountingDate}.csv`;
          break;
        case "outstanding":
          url = `/api/paymentReports?type=outstanding&asOf=${accountingDate}`;
          filename = `outstanding-debts-${accountingDate}.csv`;
          break;
        case "customer":
          if (!accountingCustomerId) {
            setError("Please select a customer");
            setDownloadingReport(false);
            return;
          }
          url = `/api/paymentReports?type=customer&customerId=${accountingCustomerId}&startDate=${accountingStartDate}&endDate=${accountingEndDate}`;
          const customer = customers.find(c => c.id === Number(accountingCustomerId));
          filename = `${customer?.name || 'customer'}-payment-history-${accountingStartDate}-to-${accountingEndDate}.csv`;
          break;
        case "payment-activity":
          url = `/api/paymentReports?type=payment-activity&period=${accountingPeriod}&startDate=${accountingStartDate}&endDate=${accountingEndDate}`;
          filename = `payment-activity-${accountingPeriod}-${accountingStartDate}.csv`;
          break;
      }
      
      const response = await fetch(url, {
        headers: { 'Accept': 'text/csv' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to download report");
      }
      
      const blob = await response.blob();
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      
      link.href = objectUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      onClose();
    } catch (err: any) {
      console.error("Error downloading report:", err);
      setError(err.message || "Failed to download report");
    } finally {
      setDownloadingReport(false);
    }
  };

  if (!isOpen) return null;

  const reportTypes = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "outstanding", label: "Outstanding" },
    { key: "customer", label: "Customer" },
    { key: "payment-activity", label: "Activity" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-purple-500" />
              Reports
            </h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Report Type</label>
            <div className="grid grid-cols-3 gap-2">
              {reportTypes.map(rt => (
                <button
                  key={rt.key}
                  onClick={() => setReportType(rt.key as any)}
                  className={`py-2.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                    reportType === rt.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-800 flex gap-2">
            <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
              {reportType === "daily" && "All payments received on the selected date."}
              {reportType === "weekly" && "All payments received within the selected week range."}
              {reportType === "monthly" && "All payments received within the selected month range."}
              {reportType === "outstanding" && "All UNPAID and PARTIAL sales as of the selected date."}
              {reportType === "customer" && "Complete transaction history for the selected customer."}
              {reportType === "payment-activity" && "Sales with payments recorded in the selected period."}
            </p>
          </div>

          {(reportType === "daily" || reportType === "weekly" || reportType === "monthly") && (
            <>
              {reportType === "daily" && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Date</label>
                  <input type="date" value={accountingDate} onChange={e => setAccountingDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                </div>
              )}
              {(reportType === "weekly" || reportType === "monthly") && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">From</label>
                    <input type="date" value={accountingStartDate} onChange={e => setAccountingStartDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">To</label>
                    <input type="date" value={accountingEndDate} onChange={e => setAccountingEndDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                  </div>
                </div>
              )}
            </>
          )}

          {reportType === "outstanding" && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">As of Date</label>
              <input type="date" value={accountingDate} onChange={e => setAccountingDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
            </div>
          )}

          {reportType === "payment-activity" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Period</label>
                <div className="grid grid-cols-3 gap-2">
                  {["daily", "weekly", "monthly"].map(p => (
                    <button key={p} onClick={() => setAccountingPeriod(p as any)} className={`py-2.5 rounded-lg text-xs font-medium transition-all ${accountingPeriod === p ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">From</label>
                  <input type="date" value={accountingStartDate} onChange={e => setAccountingStartDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">To</label>
                  <input type="date" value={accountingEndDate} onChange={e => setAccountingEndDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                </div>
              </div>
            </>
          )}

          {reportType === "customer" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Customer</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="text"
                    placeholder="Search customer…"
                    value={accountingCustomerSearch}
                    onChange={e => { setAccountingCustomerSearch(e.target.value); setAccountingShowCustomerDropdown(true); }}
                    onFocus={() => setAccountingShowCustomerDropdown(true)}
                    className="w-full pl-8 pr-2.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs"
                  />
                  {accountingShowCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <div key={c.id} onClick={() => { setAccountingCustomerId(c.id.toString()); setAccountingCustomerSearch(c.name); setAccountingShowCustomerDropdown(false); }} className="p-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-b-0">
                          <p className="font-medium text-xs text-gray-900 dark:text-white">{c.name}</p>
                          {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Start Date</label>
                  <input type="date" value={accountingStartDate} onChange={e => setAccountingStartDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">End Date</label>
                  <input type="date" value={accountingEndDate} onChange={e => setAccountingEndDate(e.target.value)} className="w-full p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-xs" />
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium text-xs transition-colors active:scale-95">
              Cancel
            </button>
            <button
              onClick={downloadAccountingReport}
              disabled={downloadingReport || (reportType === "customer" && !accountingCustomerId)}
              className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
            >
              {downloadingReport ? (
                <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Download…</>
              ) : (
                <><Download size={13} />CSV</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ACCOUNTING PAGE COMPONENT ====================
function AccountingPage({ sales, getUserDisplayName }: { sales: Sale[], getUserDisplayName: (email: string | null | undefined) => { name: string, email: string } }) {
  const [recentlyCleared, setRecentlyCleared] = useState<RecentlyClearedDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("week");

  const analyzeRecentlyUpdatedSales = useCallback(() => {
    const clearedDebts: RecentlyClearedDebt[] = [];
    const now = new Date();
    let thresholdDate = new Date();
    
    switch (timeRange) {
      case "today": 
        thresholdDate.setHours(0, 0, 0, 0); 
        break;
      case "week": 
        thresholdDate.setDate(now.getDate() - 7); 
        thresholdDate.setHours(0, 0, 0, 0);
        break;
      case "month": 
        thresholdDate.setMonth(now.getMonth() - 1); 
        thresholdDate.setHours(0, 0, 0, 0);
        break;
    }

    sales.forEach(sale => {
      if (sale.updatedAt) {
        const updatedDate = new Date(sale.updatedAt);
        if (updatedDate >= thresholdDate && sale.status === "PAID") {
          const totalPayments = sale.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
          const recentPayments = sale.payments?.filter(p => new Date(p.date) >= thresholdDate);
          const lastPayment = recentPayments?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          if (totalPayments >= sale.amount - 0.01) {
            clearedDebts.push({
              saleId: sale.id,
              customerName: sale.customer?.name || "Unknown",
              customerPhone: sale.customer?.phone || null,
              originalAmount: sale.amount,
              clearedAmount: totalPayments,
              clearedAt: sale.updatedAt,
              clearedBy: sale.updatedBy || "System",
              previousStatus: "UNPAID",
              paymentMethod: lastPayment?.method || "Unknown"
            });
          }
        }
      }
    });
    
    clearedDebts.sort((a, b) => new Date(b.clearedAt).getTime() - new Date(a.clearedAt).getTime());
    
    setRecentlyCleared(clearedDebts);
    setLoading(false);
  }, [sales, timeRange]);

  useEffect(() => {
    analyzeRecentlyUpdatedSales();
  }, [analyzeRecentlyUpdatedSales]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ""; }
  };

  const totalCleared = recentlyCleared.reduce((sum, debt) => sum + debt.clearedAmount, 0);

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg p-3 text-white">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold">Accounting</h2>
            <p className="text-[10px] opacity-90">Track cleared debts</p>
          </div>
          <div className="flex gap-1.5">
            {["today", "week", "month"].map((range) => (
              <button key={range} onClick={() => setTimeRange(range as any)} className={`px-2.5 py-1 rounded-md text-[10px] transition-colors ${timeRange === range ? "bg-white text-green-700 font-semibold" : "bg-green-700 text-white hover:bg-green-800"}`}>
                {range === "today" ? "Today" : range === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border-l-4 border-green-500">
          <div className="flex items-center gap-1.5 mb-0.5"><TrendingUp size={12} className="text-green-600" /><span className="text-[10px] text-gray-600 dark:text-gray-400">Cleared</span></div>
          <div className="text-base font-bold text-green-700 dark:text-green-400">{recentlyCleared.length}</div>
          <div className="text-[9px] text-gray-500">debts</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border-l-4 border-blue-500">
          <div className="flex items-center gap-1.5 mb-0.5"><Receipt size={12} className="text-blue-600" /><span className="text-[10px] text-gray-600 dark:text-gray-400">Amount</span></div>
          <div className="text-base font-bold text-blue-700 dark:text-blue-400">Ksh {formatCurrency(totalCleared)}</div>
          <div className="text-[9px] text-gray-500">recovered</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-2.5 border-b dark:border-gray-700">
          <h3 className="font-semibold text-xs text-black dark:text-white flex items-center gap-1.5"><ClockIcon size={12} className="text-green-600" />Cleared Debts</h3>
        </div>
        <div className="divide-y dark:divide-gray-700">
          {loading ? (<div className="p-6 text-center text-gray-500 text-xs">Loading...</div>) : recentlyCleared.length === 0 ? (
            <div className="p-6 text-center text-gray-500"><CheckCircle size={24} className="mx-auto text-green-300 mb-1.5" /><span className="text-xs">No debts cleared</span></div>
          ) : (
            recentlyCleared.map((debt, idx) => (
              <div key={idx} className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex justify-between items-start mb-1.5">
                  <div><div className="font-medium text-xs text-black dark:text-white">{debt.customerName}</div>{debt.customerPhone && <div className="text-[9px] text-gray-500">{debt.customerPhone}</div>}</div>
                  <div className="text-right"><div className="text-xs font-bold text-green-700 dark:text-green-400">Ksh {formatCurrency(debt.clearedAmount)}</div><div className="text-[9px] text-gray-500">#{debt.saleId}</div></div>
                </div>
                <div className="flex flex-wrap gap-2 text-[9px] text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-0.5"><Calendar size={8} /><span>{formatDateTime(debt.clearedAt)}</span></div>
                  <div className="flex items-center gap-0.5"><User size={8} /><span>{getUserDisplayName(debt.clearedBy).name}</span></div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1"><div className="bg-green-600 rounded-full h-1 transition-all" style={{ width: `${(debt.clearedAmount / debt.originalAmount) * 100}%` }} /></div>
                  <span className="text-[9px] text-gray-500">{Math.round((debt.clearedAmount / debt.originalAmount) * 100)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== ENHANCED AUDIT LOG MODAL ====================
function EnhancedAuditLogModal({ isOpen, onClose, auditLogs, loading, sale, getUserDisplayName, formatDateTime }: { isOpen: boolean; onClose: () => void; auditLogs: AuditLog[]; loading: boolean; sale: Sale | null; getUserDisplayName: (email: string | null | undefined) => { name: string, email: string }; formatDateTime: (date: string | null | undefined) => string; }) {
  if (!isOpen || !sale) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "UPDATE": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "DELETE": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "RESTORE": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE": return <CheckCircle size={12} />;
      case "UPDATE": return <Edit size={12} />;
      case "DELETE": return <Trash2 size={12} />;
      case "RESTORE": return <RotateCcw size={12} />;
      default: return <History size={12} />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CREATE": return "Created";
      case "UPDATE": return "Updated";
      case "DELETE": return "Deleted";
      case "RESTORE": return "Restored";
      default: return action;
    }
  };

  // Try to parse a value that might be JSON, a number, or a plain string
  const renderValue = (value: any): { text: string; isNumeric: boolean } => {
    if (value === null || value === undefined || value === "") {
      return { text: "—", isNumeric: false };
    }
    const str = String(value);
    const num = Number(str);
    if (!isNaN(num) && str.trim() !== "") {
      return { text: `Ksh ${formatCurrency(num)}`, isNumeric: true };
    }
    return { text: str, isNumeric: false };
  };

  // Humanise field names: "paymentMethod" -> "Payment Method"
  const humanizeField = (fieldName: string | undefined): string => {
    if (!fieldName) return "Field";
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/_/g, " ");
  };

  // Categorise the change for a colour-coded badge
  const getChangeCategory = (log: AuditLog): { label: string; color: string; icon: any } => {
    const f = (log.fieldName || "").toLowerCase();
    const d = (log.difference || "").toLowerCase();
    if (log.action === "CREATE") return { label: "Creation", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: <Plus size={9} /> };
    if (log.action === "DELETE") return { label: "Deletion", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: <Trash2 size={9} /> };
    if (log.action === "RESTORE") return { label: "Restoration", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: <RotateCcw size={9} /> };
    if (f.includes("payment") || d.includes("payment")) return { label: "Payment", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: <DollarSign size={9} /> };
    if (f.includes("item") || f.includes("product") || d.includes("item")) return { label: "Product", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: <Receipt size={9} /> };
    if (f.includes("status")) return { label: "Status", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: <Info size={9} /> };
    if (f.includes("amount") || f.includes("price") || f.includes("total") || f.includes("balance")) return { label: "Amount", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: <Calculator size={9} /> };
    if (f.includes("customer") || f.includes("phone") || f.includes("email")) return { label: "Customer", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: <User size={9} /> };
    if (f.includes("staff") || f.includes("assigned")) return { label: "Staff", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: <Users size={9} /> };
    if (f.includes("trade")) return { label: "Trade-In", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: <Gift size={9} /> };
    return { label: "General", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300", icon: <Edit size={9} /> };
  };

  // Build a rich description of what happened
  const buildChangeDescription = (log: AuditLog): string => {
    if (log.action === "CREATE") return "This sale was first created in the system.";
    if (log.action === "DELETE") return "This sale was removed from active records.";
    if (log.action === "RESTORE") return "This sale was restored from the deleted archive.";
    if (log.fieldName && (log.oldValue || log.newValue)) {
      const field = humanizeField(log.fieldName);
      return `The ${field.toLowerCase()} was modified.`;
    }
    if (log.difference) return log.difference;
    return "Details of this sale were updated.";
  };

  // Check whether we can show a side-by-side before/after diff
  const hasFieldDiff = (log: AuditLog): boolean => {
    return !!(log.fieldName && (log.oldValue !== undefined || log.newValue !== undefined));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-lg z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <History size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black dark:text-white">Audit Trail</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Sale <span className="font-mono font-semibold">#{sale.id}</span> · {sale.customer?.name || "Unknown"}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {auditLogs.length} {auditLogs.length === 1 ? "record" : "records"} found
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-3 text-xs">Loading audit trail...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium">No audit records found</p>
              <p className="text-[11px] text-gray-400 mt-1">This sale has no recorded changes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log, index) => {
                const category = getChangeCategory(log);
                const user = getUserDisplayName(log.changedBy);
                const isLatest = index === 0;
                const showDiff = hasFieldDiff(log);
                const oldRendered = renderValue(log.oldValue);
                const newRendered = renderValue(log.newValue);

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isLatest
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    }`}
                  >
                    {/* Card header — WHO + WHEN + ACTION */}
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${getActionColor(log.action)}`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getActionColor(log.action)}`}>
                                {getActionIcon(log.action)}
                                {getActionLabel(log.action)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${category.color}`}>
                                {category.icon}
                                {category.label}
                              </span>
                              {isLatest && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  Latest
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1.5">
                              {buildChangeDescription(log)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Field-level diff */}
                    {showDiff && (
                      <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Field: {humanizeField(log.fieldName || undefined)}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Old */}
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              <span className="text-[9px] font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">Before</span>
                            </div>
                            <p className={`text-sm font-mono break-all ${oldRendered.isNumeric ? "text-red-800 dark:text-red-200 font-semibold" : "text-gray-800 dark:text-gray-200"}`}>
                              {oldRendered.text}
                            </p>
                          </div>
                          {/* New */}
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              <span className="text-[9px] font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">After</span>
                            </div>
                            <p className={`text-sm font-mono break-all ${newRendered.isNumeric ? "text-green-800 dark:text-green-200 font-semibold" : "text-gray-800 dark:text-gray-200"}`}>
                              {newRendered.text}
                            </p>
                          </div>
                        </div>
                        {log.difference && (
                          <div className="mt-2 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2">
                            <Info size={11} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Difference</p>
                              <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5">{log.difference}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes / reason */}
                    {log.notes && (
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-start gap-2">
                          <FileSpreadsheet size={12} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-0.5">Note / Reason</p>
                            <p className="text-[11px] text-amber-800 dark:text-amber-200">{log.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* WHO / WHEN / WHERE footer */}
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-900/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        {/* User */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <User size={11} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-500 dark:text-gray-400 text-[9px] uppercase tracking-wide">Changed by</p>
                            <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{user.name}</p>
                            {log.changedByEmail && (
                              <p className="text-gray-400 dark:text-gray-500 text-[9px] truncate">{log.changedByEmail}</p>
                            )}
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                            <ClockIcon size={11} className="text-teal-600 dark:text-teal-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-500 dark:text-gray-400 text-[9px] uppercase tracking-wide">When</p>
                            <p className="text-gray-800 dark:text-gray-200 font-medium">{formatDateTime(log.changedAt)}</p>
                          </div>
                        </div>

                        {/* IP */}
                        {log.ipAddress && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                              <Info size={11} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-500 dark:text-gray-400 text-[9px] uppercase tracking-wide">IP Address</p>
                              <p className="text-gray-800 dark:text-gray-200 font-mono text-[10px]">{log.ipAddress}</p>
                            </div>
                          </div>
                        )}

                        {/* User agent */}
                        {log.userAgent && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <Smartphone size={11} className="text-gray-600 dark:text-gray-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-gray-500 dark:text-gray-400 text-[9px] uppercase tracking-wide">Device / Browser</p>
                              <p className="text-gray-700 dark:text-gray-300 text-[10px] break-all">{log.userAgent}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Snapshot (collapsible) */}
                    {log.snapshot && (
                      <details className="border-t border-gray-100 dark:border-gray-700">
                        <summary className="px-3 py-2 cursor-pointer text-[10px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors select-none">
                          <span className="inline-flex items-center gap-1.5">
                            <FileSpreadsheet size={11} />
                            Full snapshot at this point in time
                          </span>
                        </summary>
                        <div className="px-3 pb-3">
                          <pre className="text-[10px] bg-gray-900 dark:bg-black text-green-300 p-2.5 rounded-lg overflow-x-auto max-h-64 leading-relaxed">
{JSON.stringify(log.snapshot, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== PAYMENT BREAKDOWN COMPONENT ====================
interface PaymentBreakdownProps {
  stats: {
    cashAmount: number; mpesaAmount: number; bankAmount: number; checkAmount: number; cardAmount: number; creditAmount: number; tradeInAmount: number;
    todayCash: number; todayMpesa: number; todayBank: number; todayCheck: number; todayCard: number; todayCredit: number; todayTradeIn: number;
  };
  dateFilter: string;
}

function PaymentBreakdown({ stats, dateFilter }: PaymentBreakdownProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const paymentCategories = [
    { method: "Cash", amount: dateFilter === "today" ? stats.todayCash : stats.cashAmount, color: "green", icon: Banknote },
    { method: "M-Pesa", amount: dateFilter === "today" ? stats.todayMpesa : stats.mpesaAmount, color: "blue", icon: Smartphone },
    { method: "Bank", amount: dateFilter === "today" ? stats.todayBank : stats.bankAmount, color: "purple", icon: Landmark },
    { method: "Check", amount: dateFilter === "today" ? stats.todayCheck : stats.checkAmount, color: "orange", icon: DollarSign },
    { method: "Card", amount: dateFilter === "today" ? stats.todayCard : stats.cardAmount, color: "pink", icon: CardIcon },
    { method: "Credit", amount: dateFilter === "today" ? stats.todayCredit : stats.creditAmount, color: "yellow", icon: CreditCard },
    { method: "Trade-In", amount: dateFilter === "today" ? stats.todayTradeIn : stats.tradeInAmount, color: "purple", icon: Gift },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-3">
      <h2 className="text-xs font-bold text-black dark:text-white mb-2">{dateFilter === "today" ? "Today's Payments" : "Payment Breakdown"}</h2>
      <div className="grid grid-cols-3 gap-1.5">
        {paymentCategories.map((category) => (
          <div key={category.method} className={`bg-${category.color}-50 dark:bg-${category.color}-900/20 p-1.5 rounded-md border border-${category.color}-200 dark:border-${category.color}-800`}>
            <div className="flex items-center gap-0.5 mb-0.5"><category.icon className={`text-${category.color}-600 dark:text-${category.color}-400`} size={9} /><span className={`text-[9px] font-medium text-${category.color}-800 dark:text-${category.color}-300`}>{category.method}</span></div>
            <div className={`text-[10px] font-bold text-${category.color}-700 dark:text-${category.color}-400`}>Ksh {formatCurrency(category.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TRADE-IN MODAL ====================
interface TradeInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems: TradeInItem[];
  onSave: (items: TradeInItem[]) => void;
  saleTotal: number;
  formatCurrency: (n: number) => string;
}

function TradeInModal({ isOpen, onClose, initialItems, onSave, saleTotal, formatCurrency }: TradeInModalProps) {
  const [items, setItems] = useState<TradeInItem[]>(initialItems || []);
  const [draft, setDraft] = useState<TradeInItem>({
    itemName: "",
    description: "",
    category: "",
    condition: "GOOD",
    quantity: 1,
    unitValue: 0,
    totalValue: 0,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItems(initialItems || []);
      setDraft({
        itemName: "",
        description: "",
        category: "",
        condition: "GOOD",
        quantity: 1,
        unitValue: 0,
        totalValue: 0,
      });
      setEditingIndex(null);
      setError(null);
    }
  }, [isOpen, initialItems]);

  const tradeInTotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.totalValue || 0), 0),
    [items]
  );

  const difference = saleTotal - tradeInTotal;

  const balanceState = useMemo(() => {
    if (Math.abs(difference) < 0.01) {
      return { kind: "EVEN" as const, amount: 0, label: "Fully settled — No balance", color: "emerald" };
    }
    if (difference > 0) {
      return { kind: "CUSTOMER_OWES" as const, amount: difference, label: "Customer owes", color: "rose" };
    }
    return { kind: "WE_OWE" as const, amount: Math.abs(difference), label: "We owe customer", color: "blue" };
  }, [difference]);

  const resetDraft = () => {
    setDraft({
      itemName: "",
      description: "",
      category: "",
      condition: "GOOD",
      quantity: 1,
      unitValue: 0,
      totalValue: 0,
    });
    setEditingIndex(null);
    setError(null);
  };

  const handleAddOrUpdate = () => {
    if (!draft.itemName.trim()) {
      setError("Please enter an item name");
      return;
    }
    if (!draft.quantity || draft.quantity <= 0) {
      setError("Quantity must be at least 1");
      return;
    }
    if (!draft.unitValue || draft.unitValue <= 0) {
      setError("Unit value must be greater than 0");
      return;
    }

    const computed: TradeInItem = {
      ...draft,
      itemName: draft.itemName.trim(),
      totalValue: Number((draft.quantity * draft.unitValue).toFixed(2)),
    };

    if (editingIndex !== null) {
      const next = [...items];
      next[editingIndex] = computed;
      setItems(next);
    } else {
      setItems([...items, computed]);
    }
    resetDraft();
  };

  const handleEdit = (index: number) => {
    setDraft({ ...items[index] });
    setEditingIndex(index);
    setError(null);
  };

  const handleRemove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) resetDraft();
  };

  const handleSave = () => {
    if (items.length === 0) {
      setError("Add at least one trade-in item before saving");
      return;
    }
    onSave(items);
    onClose();
  };

  if (!isOpen) return null;

  const conditionOptions: TradeInItem["condition"][] = ["EXCELLENT", "GOOD", "FAIR", "POOR"];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[80]">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-t-2xl z-10">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Gift size={16} className="text-purple-500" />
              Trade-In Items
            </h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-[11px] flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
            <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {editingIndex !== null ? "Edit Item" : "Add Item"}
            </p>

            <div>
              <label className="text-[9px] text-gray-500 dark:text-gray-400">Item name *</label>
              <input
                type="text"
                value={draft.itemName}
                onChange={(e) => setDraft({ ...draft, itemName: e.target.value })}
                placeholder="e.g., Copper Wire, Old Motor"
                className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400">Category</label>
                <input
                  type="text"
                  value={draft.category || ""}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Optional"
                  className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400">Condition</label>
                <select
                  value={draft.condition}
                  onChange={(e) => setDraft({ ...draft, condition: e.target.value as TradeInItem["condition"] })}
                  className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white"
                >
                  {conditionOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={draft.quantity}
                  onChange={(e) => setDraft({ ...draft, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400">Unit value *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.unitValue || ""}
                  onChange={(e) => setDraft({ ...draft, unitValue: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white"
                />
              </div>
              <div>
                <label className="text-[9px] text-gray-500 dark:text-gray-400">Line total</label>
                <div className="mt-0.5 p-2 rounded-lg text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold">
                  Ksh {formatCurrency((draft.quantity || 0) * (draft.unitValue || 0))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-[9px] text-gray-500 dark:text-gray-400">Description</label>
              <textarea
                value={draft.description || ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                placeholder="Optional notes about the item"
                className="w-full mt-0.5 p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingIndex !== null && (
                <button
                  onClick={resetDraft}
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-medium"
                >
                  Cancel edit
                </button>
              )}
              <button
                onClick={handleAddOrUpdate}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                {editingIndex !== null ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Trade-In Items ({items.length})
              </p>
              {items.length > 0 && (
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                  Total: Ksh {formatCurrency(tradeInTotal)}
                </p>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-[11px] border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                No trade-in items yet
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {items.map((it, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs text-gray-900 dark:text-white truncate">{it.itemName}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {it.category ? `${it.category} · ` : ""}
                          {it.condition}
                        </p>
                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
                          {it.quantity} × Ksh {formatCurrency(it.unitValue)} = Ksh {formatCurrency(it.totalValue)}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleEdit(index)} className="text-blue-600 hover:text-blue-800 p-1">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => handleRemove(index)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-3 rounded-lg border ${
            balanceState.kind === "EVEN"
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
              : balanceState.kind === "CUSTOMER_OWES"
                ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
          }`}>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Sale total</span>
                <span className="font-semibold text-gray-900 dark:text-white">Ksh {formatCurrency(saleTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Trade-in total</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">Ksh {formatCurrency(tradeInTotal)}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              {balanceState.kind === "EVEN" ? (
                <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                  <CheckCircle size={12} /> {balanceState.label}
                </div>
              ) : (
                <div className={`flex justify-between font-bold ${
                  balanceState.kind === "CUSTOMER_OWES"
                    ? "text-rose-700 dark:text-rose-400"
                    : "text-blue-700 dark:text-blue-400"
                }`}>
                  <span>{balanceState.label}:</span>
                  <span>Ksh {formatCurrency(balanceState.amount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2.5 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={items.length === 0}
              className="flex-1 bg-purple-600 text-white px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={12} /> Save Trade-In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function EnhancedSalesPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockValidationTimeout, setStockValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [editSaleItems, setEditSaleItems] = useState<NewSaleItem[]>([]);
  const [currentEditItem, setCurrentEditItem] = useState<NewSaleItem>({ productId: 0, quantity: 0, price: 0, productName: "" });
  
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [editPayments, setEditPayments] = useState<NewPayment[]>([]);
  const [currentPayment, setCurrentPayment] = useState<NewPayment>({ amount: "", method: "CASH", referenceId: "", checkDepositDate: "", dueDate: "", bankName: "" });
  
  // ---- TRADE-IN STATE ----
  const [showTradeInModal, setShowTradeInModal] = useState(false);

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "paid" | "partial" | "unpaid" | "recentlyUpdated" | "accounting">("overview");
  
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [productNameFilter, setProductNameFilter] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [updatedByFilter, setUpdatedByFilter] = useState("");
  const [availableUsers, setAvailableUsers] = useState<Set<string>>(new Set());
  
  const [deletedSales, setDeletedSales] = useState<DeletedSale[]>([]);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedSalesLoading, setDeletedSalesLoading] = useState(false);
  const [deletedSalesPage, setDeletedSalesPage] = useState(1);
  const [deletedSalesTotal, setDeletedSalesTotal] = useState(0);
  const [deletedSearchTerm, setDeletedSearchTerm] = useState("");
  const [deletedDateFilter, setDeletedDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("week");
  const [deletedCustomStartDate, setDeletedCustomStartDate] = useState("");
  const [deletedCustomEndDate, setDeletedCustomEndDate] = useState("");
  const [restoringSaleId, setRestoringSaleId] = useState<number | null>(null);
  const [showDeleteDetailsModal, setShowDeleteDetailsModal] = useState<DeletedSale | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [showDeletionReasonModal, setShowDeletionReasonModal] = useState<number | null>(null);
  
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [selectedSaleForAudit, setSelectedSaleForAudit] = useState<Sale | null>(null);
  
  const [showAccountingModal, setShowAccountingModal] = useState(false);
  
  const [showRestockConfirm, setShowRestockConfirm] = useState<number | null>(null);
  
  const [userDetails, setUserDetails] = useState<Map<string, UserDetail>>(new Map());

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  const [debugInfo, setDebugInfo] = useState<string>("");
  
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ==================== HELPER FUNCTIONS ====================

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ""; }
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ""; }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const isRecentlyUpdated = useCallback((sale: Sale): boolean => {
    if (!sale.updatedAt) return false;
    try {
      const updatedDate = new Date(sale.updatedAt);
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      return updatedDate >= sevenDaysAgo;
    } catch { return false; }
  }, []);

  const isSaleModified = useCallback((sale: Sale): boolean => {
    if (!sale.updatedAt || !sale.createdAt) return false;
    try {
      const updatedDate = new Date(sale.updatedAt);
      const createdDate = new Date(sale.createdAt);
      const oneMinute = 60 * 1000;
      return (updatedDate.getTime() - createdDate.getTime()) > oneMinute;
    } catch { return false; }
  }, []);

  const calculateSaleStatus = useCallback((sale: any): Sale => {
    const totalPayments = sale.payments?.reduce((sum: number, p: Payment) => sum + Number(p.amount || 0), 0) || 0;
    const remainingAmount = Math.max(0, Number(sale.amount) - totalPayments);
    const hasPendingChecks = sale.payments?.some((p: Payment) => {
      if (p.method !== "CHECK") return false;
      const today = new Date().toISOString().split('T')[0];
      return !p.checkDepositDate || p.checkDepositDate > today || p.status === "PENDING";
    }) || false;
    let status: "PAID" | "PARTIAL" | "UNPAID";
    if (hasPendingChecks && remainingAmount <= 0.01) {
      status = "PARTIAL";
    } else if (remainingAmount <= 0.01) {
      status = "PAID";
    } else if (totalPayments > 0) {
      status = "PARTIAL";
    } else {
      status = "UNPAID";
    }
    return { ...sale, remainingAmount, status, payments: sale.payments || [] };
  }, []);

  const getUserDisplayName = (email: string | null | undefined): { name: string, email: string } => {
    if (!email) return { name: "Unknown", email: "Unknown" };
    const user = userDetails.get(email);
    if (user) return { name: user.displayName || user.name || email.split('@')[0], email: user.email };
    const nameFromEmail = email.split('@')[0].split(/[._-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    return { name: nameFromEmail, email: email };
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch { return 'unknown'; }
  };

  // ==================== AUDIT LOG FUNCTIONS ====================

  const fetchAuditLogs = async (saleId: number) => {
    setAuditLogsLoading(true);
    try {
      const response = await fetch(`/api/sales/${saleId}/audit`);
      const data = await response.json();
      if (response.ok) {
        const enhancedLogs = (data.logs || []).map((log: AuditLog) => ({ ...log, changeSummary: generateChangeSummary(log), changeCategory: categorizeChange(log) }));
        setAuditLogs(enhancedLogs);
      } else { setAuditLogs([]); }
    } catch (error) { setAuditLogs([]); }
    finally { setAuditLogsLoading(false); }
  };

  const generateChangeSummary = (log: AuditLog): string => {
    if (log.action === "CREATE") return `Sale was created`;
    if (log.action === "DELETE") return `Sale was deleted`;
    if (log.action === "RESTORE") return `Sale was restored from archive`;
    if (log.fieldName && log.oldValue && log.newValue) {
      const fieldDisplay = log.fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
      return `Changed ${fieldDisplay} from "${log.oldValue}" to "${log.newValue}"`;
    }
    if (log.difference) return log.difference;
    return `Updated sale details`;
  };

  const categorizeChange = (log: AuditLog): string => {
    if (log.action === "CREATE") return "Creation";
    if (log.action === "DELETE") return "Deletion";
    if (log.action === "RESTORE") return "Restoration";
    if (log.fieldName?.toLowerCase().includes("payment")) return "Payment";
    if (log.fieldName?.toLowerCase().includes("item") || log.fieldName?.toLowerCase().includes("product")) return "Product";
    if (log.fieldName?.toLowerCase().includes("status")) return "Status";
    if (log.fieldName?.toLowerCase().includes("amount")) return "Amount";
    return "General";
  };

  const handleViewAuditLog = async (sale: Sale) => {
    setSelectedSaleForAudit(sale);
    setShowAuditModal(true);
    await fetchAuditLogs(sale.id);
  };

  // ==================== DELETED SALES FUNCTIONS ====================

  const fetchDeletedSales = async () => {
    setDeletedSalesLoading(true);
    try {
      let url = `/api/deleted-sales?page=${deletedSalesPage}&limit=50`;
      if (deletedSearchTerm) url += `&search=${encodeURIComponent(deletedSearchTerm)}`;
      if (deletedDateFilter !== "all") {
        if (deletedDateFilter === "custom" && deletedCustomStartDate && deletedCustomEndDate) url += `&startDate=${deletedCustomStartDate}&endDate=${deletedCustomEndDate}`;
        else if (deletedDateFilter !== "custom") url += `&filter=${deletedDateFilter}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) { setDeletedSales(data.deletedSales || []); setDeletedSalesTotal(data.total || 0); }
    } catch (error) { console.error("Error fetching deleted sales:", error); }
    finally { setDeletedSalesLoading(false); }
  };

  const handleRestoreSale = async (deletedSaleId: number) => {
    if (!confirm("Restore this sale?")) return;
    setRestoringSaleId(deletedSaleId);
    setError(null);
    try {
      const ipAddress = await getClientIP();
      const response = await fetch(`/api/deleted-sales/${deletedSaleId}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restoredBy: currentUser, restoredByEmail: currentUserEmail, ipAddress }) });
      const data = await response.json();
      if (response.ok) {
        setSuccess("Sale restored!");
        setTimeout(() => setSuccess(null), 3000);
        fetchDeletedSales();
        const salesRes = await fetch("/api/sales");
        if (salesRes.ok) {
          const refreshedSales = await salesRes.json();
          const processedSales = refreshedSales.map(calculateSaleStatus);
          setSales(processedSales);
          extractAvailableUsers(processedSales);
        }
      } else throw new Error(data.error || "Failed to restore");
    } catch (err: any) { setError(err.message || "Failed to restore"); }
    finally { setRestoringSaleId(null); }
  };

  // ==================== SALE CRUD OPERATIONS ====================

  const handleDeleteSaleWithReason = async (saleId: number, restockItems: boolean = false) => {
    if (!deletionReason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess("Deleting sale, please wait...");
    
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          restockItems,
          deletedBy: currentUser,
          deletedByEmail: currentUserEmail,
          deletionReason: deletionReason,
          ipAddress,
          userAgent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sale");
      }

      setSales(prevSales => prevSales.filter(s => s.id !== saleId));
      setShowRestockConfirm(null);
      setShowDeletionReasonModal(null);
      setDeletionReason("");
      
      setSuccess(`Sale deleted successfully${restockItems ? ' with items restocked' : ''}!`);
      setTimeout(() => setSuccess(null), 3000);
      
      if (showDeletedModal) {
        fetchDeletedSales();
      }
      extractAvailableUsers(sales.filter(s => s.id !== saleId));
    } catch (error: any) {
      console.error("Error deleting sale:", error);
      setError(error.message || "Failed to delete sale");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    if (!currentUser) {
      setError("Please log in to update a sale");
      return;
    }
    if (editSaleItems.length === 0) {
      setError("Please add at least one item to the sale");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess("Updating sale, please wait...");
    
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      
      const newTotalAmount = editSaleItems.reduce((total, item) => 
        total + (item.quantity * item.price), 0);

      const updateData = {
        id: editingSale.id,
        saleItems: editSaleItems.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        payments: editPayments.filter(p => p.id).map(p => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          referenceId: p.referenceId?.trim() || null,
          checkDepositDate: p.checkDepositDate || null,
          bankName: p.bankName || null,
        })),
        newPayments: editPayments
          .filter(p => {
            if (p.method === "TRADE_IN") return Array.isArray(p.tradeInItems) && p.tradeInItems.length > 0;
            return !p.id && p.amount && Number(p.amount) > 0;
          })
          .map(p => {
            if (p.method === "TRADE_IN") {
              return {
                method: "TRADE_IN",
                amount: Number(p.amount) || 0,
                tradeInItems: (p.tradeInItems || []).map(it => ({
                  itemName: it.itemName,
                  description: it.description || null,
                  category: it.category || null,
                  condition: it.condition,
                  quantity: Number(it.quantity),
                  unitValue: Number(it.unitValue),
                  totalValue: Number(it.totalValue),
                })),
                date: new Date().toISOString(),
                status: "COMPLETED",
              };
            }
            return {
              amount: Number(p.amount),
              method: p.method,
              referenceId: p.referenceId?.trim() || null,
              checkDepositDate: p.checkDepositDate || null,
              dueDate: p.dueDate || null,
              bankName: p.bankName || null,
              date: new Date().toISOString(),
              status: p.method === "CHECK" ? "PENDING" : "COMPLETED",
            };
          }),
        amount: newTotalAmount,
        dueDate: editingSale.dueDate || null,
        updatedBy: currentUser,
        updatedByEmail: currentUserEmail,
        ipAddress,
        userAgent,
      };

      const response = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update sale");
      }

      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);

      setSales(prevSales => 
        prevSales.map(s => s.id === processedSale.id ? processedSale : s)
      );

      setEditingSale(null);
      setEditSaleItems([]);
      setEditPayments([]);
      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: "",
        bankName: ""
      });
      setProductSearch("");
      setCurrentEditItem({ productId: 0, quantity: 0, price: 0, productName: "" });
      
      setSuccess("Sale updated successfully!");
      setTimeout(() => setSuccess(null), 3000);

      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) {
        const refreshedSales = await salesRes.json();
        const processedSales = refreshedSales.map(calculateSaleStatus);
        setSales(processedSales);
        extractAvailableUsers(processedSales);
      }
    } catch (err: any) {
      console.error("Error updating sale:", err);
      setError(err.message || "Failed to update sale");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setCurrentEditItem({ 
      ...currentEditItem, 
      productId: product.id, 
      price: product.price || 0, 
      productName: product.name 
    });
    setProductSearch(product.name);
    setShowProductDropdown(false);
  };

  const handleAddItemToEditSale = () => {
    if (stockValidationTimeout) clearTimeout(stockValidationTimeout);
    
    if (!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0) {
      setError("Please fill in all item details");
      return;
    }
    
    const product = products.find(p => p.id === currentEditItem.productId);
    if (!product) {
      setError("Product not found");
      return;
    }
    
    let productStock = 0;
    if (Array.isArray(product.stock)) {
      productStock = product.stock.reduce((total: number, s: any) => total + (s.quantity || 0), 0);
    } else if (product.stock && typeof product.stock === 'object' && 'quantity' in product.stock) {
      productStock = (product.stock as any).quantity || 0;
    } else if (typeof product.stock === 'number') {
      productStock = product.stock;
    } else if (product.totalStock) {
      productStock = product.totalStock;
    }
    
    const existingItem = editSaleItems.find(item => item.productId === currentEditItem.productId);
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = existingQuantity + currentEditItem.quantity;
    
    if (productStock > 0 && totalQuantity > productStock) {
      const errorMsg = `Insufficient stock for ${product.name}. Available: ${productStock}, Requested: ${totalQuantity}`;
      setStockError(errorMsg);
      setError(errorMsg);
      
      const timeout = setTimeout(() => {
        setStockError(null);
        setError(null);
      }, 5000);
      setStockValidationTimeout(timeout);
      return;
    }
    
    const existingItemIndex = editSaleItems.findIndex(item => item.productId === currentEditItem.productId);

    if (existingItemIndex >= 0) {
      const updatedItems = [...editSaleItems];
      updatedItems[existingItemIndex].quantity += currentEditItem.quantity;
      updatedItems[existingItemIndex].price = currentEditItem.price;
      setEditSaleItems(updatedItems);
      setSuccess(`Updated ${product.name} quantity to ${updatedItems[existingItemIndex].quantity}`);
    } else {
      setEditSaleItems([...editSaleItems, { 
        ...currentEditItem, 
        productName: product.name,
        originalPrice: product.price,
        id: undefined
      }]);
      setSuccess(`Added ${product.name} to sale`);
    }
    
    setCurrentEditItem({
      productId: 0,
      quantity: 0,
      price: 0,
      productName: ""
    });
    setProductSearch("");
    setError(null);
    setStockError(null);
    setTimeout(() => setSuccess(null), 2000);
  };

  // FIXED: no duplicate declarations, only one clean version
  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);

    // Build trade-in items from sale.tradeins (server-provided relation)
    const tradeInItemsFromServer: TradeInItem[] = (sale.tradeins || []).map((t: TradeInRow) => ({
      id: t.id,
      itemName: t.itemName,
      description: t.description || "",
      category: t.category || "",
      condition: (t.condition as TradeInItem["condition"]) || "GOOD",
      quantity: Number(t.quantity) || 1,
      unitValue: Number(t.agreedValue) || 0,
      totalValue: (Number(t.quantity) || 1) * (Number(t.agreedValue) || 0),
    }));

    const tradeInTotal = tradeInItemsFromServer.reduce((s, it) => s + it.totalValue, 0);
    const hasTradeInPayment = sale.payments.some(p => p.method === "TRADE_IN");

    // Build the payments array:
    //  - all NON-TRADE_IN payments go in as-is
    //  - if there's a TRADE_IN payment OR trade-in rows exist,
    //    add ONE TRADE_IN entry with all the items attached
    const builtPayments: NewPayment[] = sale.payments
      .filter(p => p.method !== "TRADE_IN")
      .map(p => ({
        id: p.id,
        amount: p.amount.toString(),
        method: p.method,
        referenceId: p.referenceId || "",
        checkDepositDate: p.checkDepositDate || "",
        bankName: p.bankName || "",
        dueDate: p.dueDate || "",
      }));

    if (hasTradeInPayment || tradeInItemsFromServer.length > 0) {
      const existingTradeInPayment = sale.payments.find(p => p.method === "TRADE_IN");
      builtPayments.push({
        id: existingTradeInPayment?.id,
        amount: existingTradeInPayment
          ? Number(existingTradeInPayment.amount).toString()
          : tradeInTotal.toFixed(2),
        method: "TRADE_IN" as const,
        referenceId: existingTradeInPayment?.referenceId || "",
        checkDepositDate: existingTradeInPayment?.checkDepositDate || "",
        bankName: existingTradeInPayment?.bankName || "",
        dueDate: existingTradeInPayment?.dueDate || "",
        tradeInItems: tradeInItemsFromServer,
      });
    }

    setEditPayments(builtPayments);

    setEditSaleItems(sale.saleitems.map(item => ({ 
      id: item.id,
      productId: item.product.id, 
      quantity: item.quantity, 
      price: item.price, 
      productName: item.product.name, 
      originalPrice: item.product.price 
    })));
    setProductSearch("");
    setCurrentEditItem({ productId: 0, quantity: 0, price: 0, productName: "" });
    setCurrentPayment({ 
      amount: "", 
      method: "CASH", 
      referenceId: "", 
      checkDepositDate: "", 
      dueDate: "", 
      bankName: "" 
    });
  };

  const handleDeletePayment = async (paymentId: number, saleId: number) => {
    try {
      const currentEditingSale = editingSale;
      const currentSales = sales;
      
      setDeletingPaymentId(paymentId);

      const response = await fetch(`/api/payment/${paymentId}?saleId=${saleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete payment");
      }

      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);

      setSales(currentSales.map(s => s.id === processedSale.id ? processedSale : s));
      
      if (currentEditingSale?.id === saleId) {
        setEditingSale(processedSale);
        setEditPayments(
          processedSale.payments.map((p: Payment) => ({
            id: p.id,
            amount: p.amount.toString(),
            method: p.method,
            referenceId: p.referenceId || "",
            checkDepositDate: p.checkDepositDate || "",
            bankName: p.bankName || ""
          }))
        );
      }

      setSuccess("Payment deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error("Error deleting payment:", error);
      setError(error.message || "Failed to delete payment");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // ---- TRADE-IN HANDLERS ----
  const currentTradeInItems: TradeInItem[] = useMemo(() => {
    const tradeInPayment = editPayments.find(p => p.method === "TRADE_IN");
    return tradeInPayment?.tradeInItems || [];
  }, [editPayments]);

  const handleSaveTradeInItems = (items: TradeInItem[]) => {
    const otherPayments = editPayments.filter(p => p.method !== "TRADE_IN");
    const totalValue = items.reduce((sum, it) => sum + (it.totalValue || 0), 0);
    const tradeInPayment: NewPayment = {
      amount: totalValue.toFixed(2),
      method: "TRADE_IN",
      referenceId: "",
      checkDepositDate: "",
      dueDate: "",
      bankName: "",
      status: "COMPLETED",
      tradeInItems: items,
    };
    setEditPayments([...otherPayments, tradeInPayment]);
    setSuccess(`Trade-In updated: ${items.length} item${items.length === 1 ? "" : "s"}, Ksh ${formatCurrency(totalValue)}`);
    setTimeout(() => setSuccess(null), 2500);
  };

  const removeTradeInPayment = () => {
    setEditPayments(editPayments.filter(p => p.method !== "TRADE_IN"));
    setSuccess("Trade-In removed");
    setTimeout(() => setSuccess(null), 2000);
  };

  const addEditPayment = () => {
    if (currentPayment.method === "TRADE_IN") {
      setShowTradeInModal(true);
      return;
    }

    if (currentPayment.method === "CREDIT") {
      if (!currentPayment.dueDate) {
        setError("Due date is required for credit/pay later");
        return;
      }
      
      const newPayment = {
        amount: "0",
        method: currentPayment.method,
        referenceId: "",
        checkDepositDate: "",
        dueDate: currentPayment.dueDate,
        bankName: ""
      };
      
      setEditPayments([...editPayments, newPayment]);
      setSuccess("Credit payment added");
      setTimeout(() => setSuccess(null), 2000);
      
      setCurrentPayment({
        amount: "",
        method: "CASH",
        referenceId: "",
        checkDepositDate: "",
        dueDate: "",
        bankName: ""
      });
      setError(null);
      return;
    }
    
    const amount = parseFloat(currentPayment.amount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }

    const currentTotal = editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const currentPayments = editPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingAmount = currentTotal - currentPayments;

    if (amount > remainingAmount) {
      setError(`Payment cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`);
      return;
    }
    
    if (currentPayment.method === "MPESA" && !currentPayment.referenceId?.trim()) {
      setError("Please enter M-Pesa transaction ID");
      return;
    }
    
    if (currentPayment.method === "BANK") {
      if (!currentPayment.referenceId?.trim()) {
        setError("Please enter bank transaction reference");
        return;
      }
      if (!currentPayment.bankName?.trim()) {
        setError("Please enter bank name");
        return;
      }
    }
    
    if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) {
      setError("Please specify check deposit date");
      return;
    }
    
    const newPayment = {
      amount: currentPayment.amount,
      method: currentPayment.method,
      referenceId: currentPayment.referenceId || "",
      checkDepositDate: currentPayment.checkDepositDate || "",
      dueDate: "",
      bankName: currentPayment.bankName || "",
      status: currentPayment.method === "CHECK" ? "PENDING" : "COMPLETED"
    };
    
    setEditPayments([...editPayments, newPayment]);
    setSuccess("Payment added successfully");
    setTimeout(() => setSuccess(null), 2000);
    
    setCurrentPayment({
      amount: "",
      method: "CASH",
      referenceId: "",
      checkDepositDate: "",
      dueDate: "",
      bankName: ""
    });
    setError(null);
  };
    
  const clearMessages = () => { setError(null); setSuccess(null); setStockError(null); };

  const clearFilters = () => {
    setCustomerFilter("");
    setDateFilter("today");
    setCustomStartDate("");
    setCustomEndDate("");
    setProductNameFilter("");
    setCreatedByFilter("");
    setUpdatedByFilter("");
    setExpandedSaleId(null);
    setShowMobileFilters(false);
  };

  const showDeleteConfirmationWithReason = (saleId: number) => { 
    setShowDeletionReasonModal(saleId); 
  };

  const extractAvailableUsers = (salesData: Sale[]) => {
    const users = new Set<string>();
    salesData.forEach(sale => { 
      if (sale.createdBy) users.add(sale.createdBy); 
      if (sale.updatedBy) users.add(sale.updatedBy); 
    });
    setAvailableUsers(users);
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch("/api/staff");
        if (response.ok) {
          const data = await response.json();
          setStaffList(Array.isArray(data) ? data : (data.staff || []));
        }
      } catch (error) { console.error("Error fetching staff:", error); }
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = auth.currentUser;
        let idToken = "";
        if (user) {
          idToken = await user.getIdToken();
          setCurrentUser(user.displayName || user.email?.split('@')[0] || "");
          setCurrentUserEmail(user.email || "");
          const sessionRes = await fetch("/api/auth/session", { headers: { "Authorization": `Bearer ${idToken}` } });
          if (sessionRes.ok) { const sessionData = await sessionRes.json(); setCurrentUser(sessionData?.user?.email || sessionData?.email || ""); }
        }
        
        const [salesRes, customersRes, productsRes] = await Promise.all([
          fetch("/api/sales").catch(err => { console.error("Sales fetch failed:", err); return null; }),
          fetch("/api/customers").catch(err => { console.error("Customers fetch failed:", err); return null; }),
          fetch("/api/products").catch(err => { console.error("Products fetch failed:", err); return null; })
        ]);
        
        let customersData = [];
        if (!customersRes || !customersRes.ok) { 
          try { 
            const altRes = await fetch("/api/customer"); 
            if (altRes.ok) customersData = await altRes.json(); 
          } catch (err) { console.error("Fallback also failed:", err); } 
        } else { 
          customersData = await customersRes.json(); 
        }
        
        if (!salesRes || !salesRes.ok) throw new Error("Failed to fetch sales data");
        if (!productsRes || !productsRes.ok) throw new Error("Failed to fetch products data");
        
        const [salesData, productsData] = await Promise.all([salesRes.json(), productsRes.json()]);
        
        const productsWithStock = productsData.map((product: any) => {
          let totalStock = 0;
          if (Array.isArray(product.stock)) {
            totalStock = product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
          } else if (product.stock && typeof product.stock === 'object') {
            totalStock = product.stock.quantity || 0;
          } else if (typeof product.stock === 'number') {
            totalStock = product.stock;
          }
          return { ...product, totalStock };
        });
        
        const validCustomers = Array.isArray(customersData) ? customersData : (customersData?.customers || customersData?.data || []);
        const processedSales = Array.isArray(salesData) ? salesData.filter((s: any) => !s.isDeleted).map(calculateSaleStatus) : [];
        
        setSales(processedSales);
        setCustomers(validCustomers);
        setProducts(productsWithStock);
        extractAvailableUsers(processedSales);
        if (validCustomers.length === 0) { console.warn("No customers found"); setError("No customers found. Please add customers first."); }
      } catch (err: any) { 
        const errorMsg = err.message || "Failed to load data"; 
        setError(errorMsg); 
        console.error("Error fetching data:", err); 
        setSales([]); 
        setCustomers([]); 
        setProducts([]); 
      } finally { 
        setLoading(false); 
      }
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => { if (user) fetchData(); else { setCurrentUser(""); setCurrentUserEmail(""); setError("Please log in to access sales data"); setLoading(false); } });
    return () => unsubscribe();
  }, [calculateSaleStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-dropdown-container')) setShowCustomerDropdown(false);
      if (!target.closest('.product-dropdown-container')) setShowProductDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: Banknote },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Smartphone },
    { value: "BANK", label: "Bank", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Landmark },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: DollarSign },
    { value: "CARD", label: "Card", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300", icon: CardIcon },
    { value: "CREDIT", label: "Credit", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: CreditCard },
    { value: "TRADE_IN", label: "Trade-In", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Gift },
  ];

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const searchLower = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(searchLower));
  }, [products, productSearch]);

  const stats = useMemo(() => {
    const recentlyUpdatedSales = sales.filter(sale => isRecentlyUpdated(sale) && isSaleModified(sale));
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); 
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySales = sales.filter(sale => { 
      const saleDate = new Date(sale.date); 
      return saleDate >= today && saleDate < tomorrow; 
    });
    
    let cashAmount = 0, mpesaAmount = 0, bankAmount = 0, checkAmount = 0, cardAmount = 0, creditAmount = 0, tradeInAmount = 0;
    sales.forEach(sale => { 
      sale.payments?.forEach(payment => { 
        const amount = Number(payment.amount) || 0; 
        switch(payment.method) { 
          case "CASH": cashAmount += amount; break; 
          case "MPESA": mpesaAmount += amount; break; 
          case "BANK": bankAmount += amount; break; 
          case "CHECK": checkAmount += amount; break; 
          case "CARD": cardAmount += amount; break; 
          case "CREDIT": creditAmount += amount; break; 
          case "TRADE_IN": tradeInAmount += amount; break; 
        } 
      }); 
    });
    
    let todayCash = 0, todayMpesa = 0, todayBank = 0, todayCheck = 0, todayCard = 0, todayCredit = 0, todayTradeIn = 0;
    todaySales.forEach(sale => { 
      sale.payments?.forEach(payment => { 
        const amount = Number(payment.amount) || 0; 
        switch(payment.method) { 
          case "CASH": todayCash += amount; break; 
          case "MPESA": todayMpesa += amount; break; 
          case "BANK": todayBank += amount; break; 
          case "CHECK": todayCheck += amount; break; 
          case "CARD": todayCard += amount; break; 
          case "CREDIT": todayCredit += amount; break; 
          case "TRADE_IN": todayTradeIn += amount; break; 
        } 
      }); 
    });
    
    return { 
      totalSales: sales.reduce((acc, s) => acc + Number(s.amount), 0), 
      paidSales: sales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0), 
      partialSales: sales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0), 
      unpaidSales: sales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0), 
      totalOutstanding: sales.reduce((acc, s) => acc + Number(s.remainingAmount), 0), 
      paidCount: sales.filter(s => s.status === "PAID").length, 
      partialCount: sales.filter(s => s.status === "PARTIAL").length, 
      unpaidCount: sales.filter(s => s.status === "UNPAID").length, 
      recentlyUpdatedCount: recentlyUpdatedSales.length, 
      recentlyUpdatedAmount: recentlyUpdatedSales.reduce((acc, s) => acc + Number(s.amount), 0), 
      cashAmount, mpesaAmount, bankAmount, checkAmount, cardAmount, creditAmount, tradeInAmount,
      todaySales: todaySales.reduce((acc, s) => acc + Number(s.amount), 0), 
      todayPaid: todaySales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0),
      todayPartial: todaySales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0),
      todayUnpaid: todaySales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0),
      todayOutstanding: todaySales.reduce((acc, s) => acc + Number(s.remainingAmount), 0), 
      todayCount: todaySales.length,
      todayPaidCount: todaySales.filter(s => s.status === "PAID").length,
      todayPartialCount: todaySales.filter(s => s.status === "PARTIAL").length,
      todayUnpaidCount: todaySales.filter(s => s.status === "UNPAID").length,
      todayCash, todayMpesa, todayBank, todayCheck, todayCard, todayCredit, todayTradeIn
    }; 
  }, [sales, isRecentlyUpdated, isSaleModified]);

  const filteredSales = useMemo(() => {
    switch (activeTab) {
      case "paid": return sales.filter(s => s.status === "PAID");
      case "partial": return sales.filter(s => s.status === "PARTIAL");
      case "unpaid": return sales.filter(s => s.status === "UNPAID");
      case "recentlyUpdated": return sales.filter(sale => isRecentlyUpdated(sale) && isSaleModified(sale));
      default: return sales;
    }
  }, [sales, activeTab, isRecentlyUpdated, isSaleModified]);

  const fullyFilteredSales = useMemo(() => {
    let filtered = filteredSales;
    
    if (customerFilter.trim()) { 
      const searchTerm = customerFilter.toLowerCase().trim(); 
      filtered = filtered.filter(sale => { 
        const customerName = sale.customer?.name?.toLowerCase() || ""; 
        const customerPhone = sale.customer?.phone?.toLowerCase() || ""; 
        return customerName.includes(searchTerm) || customerPhone.includes(searchTerm); 
      }); 
    }
    
    if (productNameFilter.trim()) { 
      const searchProduct = productNameFilter.toLowerCase().trim(); 
      filtered = filtered.filter(sale => 
        sale.saleitems?.some(item => 
          item.product.name.toLowerCase().includes(searchProduct)
        )
      ); 
    }
    
    if (createdByFilter.trim()) { 
      filtered = filtered.filter(sale => 
        sale.createdBy?.toLowerCase().includes(createdByFilter.toLowerCase())
      ); 
    }
    
    if (updatedByFilter.trim()) { 
      filtered = filtered.filter(sale => 
        sale.updatedBy?.toLowerCase().includes(updatedByFilter.toLowerCase())
      ); 
    }
    
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        switch (dateFilter) {
          case "today": 
            return saleDate >= today && saleDate < tomorrow;
          case "week": { 
            const weekAgo = new Date(today); 
            weekAgo.setDate(weekAgo.getDate() - 7); 
            return saleDate >= weekAgo; 
          }
          case "month": { 
            const monthAgo = new Date(today); 
            monthAgo.setMonth(monthAgo.getMonth() - 1); 
            return saleDate >= monthAgo; 
          }
          case "custom": 
            if (customStartDate && customEndDate) { 
              const start = new Date(customStartDate);
              start.setHours(0, 0, 0, 0);
              const end = new Date(customEndDate); 
              end.setHours(23, 59, 59, 999);
              return saleDate >= start && saleDate <= end; 
            }
            return true;
          default: 
            return true;
        }
      });
    }
    
    return filtered;
  }, [filteredSales, customerFilter, dateFilter, customStartDate, customEndDate, productNameFilter, createdByFilter, updatedByFilter]);

  const isFilterActive = useMemo(() => {
    return (
      customerFilter.trim() !== "" ||
      productNameFilter.trim() !== "" ||
      createdByFilter.trim() !== "" ||
      updatedByFilter.trim() !== "" ||
      dateFilter !== "today" ||
      (dateFilter === "custom" && (customStartDate || customEndDate))
    );
  }, [customerFilter, productNameFilter, createdByFilter, updatedByFilter, dateFilter, customStartDate, customEndDate]);

  const getSortedSales = (salesList: Sale[]) => {
    if (activeTab === "recentlyUpdated") return [...salesList].sort((a, b) => { const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0; const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0; return dateB - dateA; });
    return salesList;
  };

  const sortedFilteredSales = useMemo(() => getSortedSales(fullyFilteredSales), [fullyFilteredSales, activeTab]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const searchLower = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(searchLower) || (c.phone && c.phone.includes(searchLower)));
  }, [customers, customerSearch]);

  const currentSaleTotal = useMemo(
    () => editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0),
    [editSaleItems]
  );

  if (loading && sales.length === 0) return <div className="p-3 min-h-screen bg-gray-50 dark:bg-gray-900"><div className="text-center text-black dark:text-white text-xs">Loading...</div></div>;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`p-2 min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <button onClick={toggleTheme} className="fixed bottom-3 right-3 z-50 p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all" aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={16} className="text-gray-700" /> : <Sun size={16} className="text-yellow-500" />}
        </button>

        {showRestockConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><AlertTriangle className="text-yellow-600" size={16} /></div><h3 className="text-sm font-bold text-black dark:text-white">Confirm Deletion</h3></div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Restock items to inventory?</p>
              <div className="space-y-1.5">
                <button onClick={() => handleDeleteSaleWithReason(showRestockConfirm, true)} disabled={loading} className="w-full bg-green-600 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"><CheckCircle size={12} />Yes, restock</button>
                <button onClick={() => handleDeleteSaleWithReason(showRestockConfirm, false)} disabled={loading} className="w-full bg-red-600 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"><Trash2 size={12} />No, delete</button>
                <button onClick={() => setShowRestockConfirm(null)} disabled={loading} className="w-full bg-gray-500 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showDeletionReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><AlertTriangle className="text-red-600" size={16} /></div><h3 className="text-sm font-bold text-black dark:text-white">Reason for Deletion</h3></div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Provide a reason (for audit):</p>
              <textarea value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} placeholder="e.g., Wrong customer, Duplicate entry..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs text-black dark:text-white bg-white dark:bg-gray-700 mb-3 focus:ring-2 focus:ring-red-500 focus:border-transparent" rows={2} />
              <div className="flex gap-2">
                <button onClick={() => { setShowDeletionReasonModal(null); setDeletionReason(""); }} className="flex-1 bg-gray-500 text-white px-3 py-2 rounded-lg text-xs transition-colors">Cancel</button>
                <button onClick={() => { if (deletionReason.trim()) { setShowRestockConfirm(showDeletionReasonModal); setShowDeletionReasonModal(null); } else setError("Please provide a reason"); }} className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-xs transition-colors">Continue</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div><h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Sales Management</h1><p className="text-[10px] text-gray-500 mt-0.5">Track and manage all sales</p></div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowAccountingModal(true)} className="flex-1 sm:flex-none bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1.5 text-xs shadow-md transition-all"><FileSpreadsheet size={12} />Reports</button>
              <button onClick={() => { const csvData = sales.map(sale => ({ 'Sale ID': sale.id, 'Date': new Date(sale.date).toLocaleDateString(), 'Customer': sale.customer?.name || '-', 'Phone': sale.customer?.phone || '-', 'Amount': sale.amount.toFixed(2), 'Status': sale.status, 'Remaining': sale.remainingAmount.toFixed(2), 'Trade-In Items': Array.isArray(sale.tradeins) ? sale.tradeins.length : 0, 'Trade-In Total': tradeInSaleTotal(sale.tradeins).toFixed(2), 'Created By': sale.createdBy || '-', 'Updated By': sale.updatedBy || '-', 'Assigned Staff': sale.assignedStaff?.name || '-' })); const headers = Object.keys(csvData[0] || {}); const csvContent = [headers.join(','), ...csvData.map(row => headers.map(header => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`).join(','))].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', `sales_${new Date().toISOString().split('T')[0]}.csv`); link.click(); URL.revokeObjectURL(url); }} className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center justify-center gap-1.5 text-xs shadow-md transition-all"><Download size={12} />Export</button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-gray-500" />
              <span className="font-medium text-xs text-gray-700 dark:text-gray-300">Filters</span>
              {isFilterActive && (
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[9px] px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setShowMobileFilters(!showMobileFilters)} 
                className="sm:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <Menu size={14} />
              </button>
              {isFilterActive && (
                <button 
                  onClick={clearFilters} 
                  className="text-red-600 hover:text-red-700 text-[10px] flex items-center gap-0.5"
                >
                  <XCircle size={11} />
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className={`${showMobileFilters ? 'block' : 'hidden sm:block'}`}>
            <div className="space-y-2">
              <div>
                <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Customer</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={11} />
                  <input 
                    type="text" 
                    placeholder="Search by name or phone..." 
                    value={customerFilter} 
                    onChange={(e) => setCustomerFilter(e.target.value)} 
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Product</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={11} />
                  <input 
                    type="text" 
                    placeholder="Search by product..." 
                    value={productNameFilter} 
                    onChange={(e) => setProductNameFilter(e.target.value)} 
                    className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Created By</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={11} />
                    <select 
                      value={createdByFilter} 
                      onChange={(e) => setCreatedByFilter(e.target.value)} 
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
                    >
                      <option value="">All</option>
                      {Array.from(availableUsers).map(user => (
                        <option key={user} value={user}>{getUserDisplayName(user).name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-0.5">Updated By</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={11} />
                    <select 
                      value={updatedByFilter} 
                      onChange={(e) => setUpdatedByFilter(e.target.value)} 
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
                    >
                      <option value="">All</option>
                      {Array.from(availableUsers).map(user => (
                        <option key={user} value={user}>{getUserDisplayName(user).name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-medium text-gray-700 dark:text-gray-300">Date:</span>
                {["today","week","month","all","custom"].map((filter) => (
                  <button 
                    key={filter} 
                    onClick={() => setDateFilter(filter as any)} 
                    className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
                      dateFilter === filter 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "today" ? "Today" : filter === "week" ? "Week" : filter === "month" ? "Month" : "Custom"}
                  </button>
                ))}
              </div>
              
              {dateFilter === "custom" && (
                <div className="flex gap-1.5 mt-1.5">
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)} 
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white" 
                  />
                  <span className="text-gray-400 text-[10px] self-center">to</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)} 
                    className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white" 
                  />
                </div>
              )}
            </div>
            
            {isFilterActive && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-1">
                  {customerFilter && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[9px]">
                      Customer: {customerFilter.length > 15 ? customerFilter.slice(0,15)+'...' : customerFilter}
                      <button onClick={() => setCustomerFilter("")} className="ml-0.5 hover:text-blue-900">×</button>
                    </span>
                  )}
                  {productNameFilter && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[9px]">
                      Product: {productNameFilter.length > 15 ? productNameFilter.slice(0,15)+'...' : productNameFilter}
                      <button onClick={() => setProductNameFilter("")} className="ml-0.5 hover:text-green-900">×</button>
                    </span>
                  )}
                  {createdByFilter && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[9px]">
                      Created by: {getUserDisplayName(createdByFilter).name}
                      <button onClick={() => setCreatedByFilter("")} className="ml-0.5 hover:text-purple-900">×</button>
                    </span>
                  )}
                  {updatedByFilter && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-[9px]">
                      Updated by: {getUserDisplayName(updatedByFilter).name}
                      <button onClick={() => setUpdatedByFilter("")} className="ml-0.5 hover:text-teal-900">×</button>
                    </span>
                  )}
                  {(dateFilter === "week" || dateFilter === "month" || dateFilter === "custom") && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-[9px]">
                      Date: {dateFilter === "custom" ? `${customStartDate || '?'} to ${customEndDate || '?'}` : dateFilter}
                      <button onClick={() => setDateFilter("today")} className="ml-0.5 hover:text-orange-900">×</button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg mb-3 flex justify-between items-start"><div className="flex items-start gap-1.5"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /><span className="text-[11px]">{error}</span></div><button onClick={clearMessages} className="text-red-700 hover:text-red-900 dark:text-red-300 text-xs">×</button></div>}
        {success && <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg mb-3 flex justify-between items-start"><div className="flex items-start gap-1.5"><CheckCircle size={12} className="flex-shrink-0 mt-0.5" /><span className="text-[11px]">{success}</span></div><button onClick={clearMessages} className="text-green-700 hover:text-green-900 dark:text-green-300 text-xs">×</button></div>}

        <PaymentBreakdown stats={stats} dateFilter={dateFilter} />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-emerald-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Total Sales</div><div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Ksh {formatCurrency(stats.totalSales)}</div><div className="text-[8px] text-gray-400">{sales.length} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-blue-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Fully Paid</div><div className="text-sm font-bold text-blue-600 dark:text-blue-400">Ksh {formatCurrency(stats.paidSales)}</div><div className="text-[8px] text-gray-400">{stats.paidCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-orange-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Partial</div><div className="text-sm font-bold text-orange-600 dark:text-orange-400">Ksh {formatCurrency(stats.partialSales)}</div><div className="text-[8px] text-gray-400">{stats.partialCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-red-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Unpaid</div><div className="text-sm font-bold text-red-600 dark:text-red-400">Ksh {formatCurrency(stats.unpaidSales)}</div><div className="text-[8px] text-gray-400">{stats.unpaidCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-yellow-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Recent Updates</div><div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Ksh {formatCurrency(stats.recentlyUpdatedAmount)}</div><div className="text-[8px] text-gray-400">{stats.recentlyUpdatedCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-purple-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Outstanding</div><div className="text-sm font-bold text-purple-600 dark:text-purple-400">Ksh {formatCurrency(stats.totalOutstanding)}</div><div className="text-[8px] text-gray-400">total remaining</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-green-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Today's Sales</div><div className="text-sm font-bold text-green-600 dark:text-green-400">Ksh {formatCurrency(stats.todaySales)}</div><div className="text-[8px] text-gray-400">{stats.todayCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border-l-4 border-teal-500"><div className="text-[9px] text-gray-500 dark:text-gray-400">Today's Outstanding</div><div className="text-sm font-bold text-teal-600 dark:text-teal-400">Ksh {formatCurrency(stats.todayOutstanding)}</div><div className="text-[8px] text-gray-400">remaining today</div></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-3">
          <div className="flex overflow-x-auto scrollbar-thin border-b dark:border-gray-700">
            {[{ key: "overview", label: "All", count: sales.length }, { key: "paid", label: "Paid", count: stats.paidCount }, { key: "partial", label: "Partial", count: stats.partialCount }, { key: "unpaid", label: "Unpaid", count: stats.unpaidCount }, { key: "recentlyUpdated", label: "Updates", count: stats.recentlyUpdatedCount }, { key: "accounting", label: "Accounting", count: null, icon: TrendingUp }].map((tab) => (<button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-shrink-0 px-2.5 py-2 text-center transition-all whitespace-nowrap ${activeTab === tab.key ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/30 dark:bg-blue-900/10" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}><div className="flex items-center gap-1"><span className="text-[11px]">{tab.label}</span>{tab.count !== null && <span className="text-[9px] text-gray-400">({tab.count})</span>}</div></button>))}
            <button onClick={() => { setShowDeletedModal(true); fetchDeletedSales(); }} className="flex-shrink-0 px-2.5 py-2 text-center transition-all whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"><div className="flex items-center gap-1"><Archive size={12} /><span className="text-[11px]">Deleted</span><span className="text-[9px] text-gray-400">({deletedSalesTotal})</span></div></button>
          </div>

          <div className="p-3">
            {activeTab === "accounting" ? (<AccountingPage sales={sales} getUserDisplayName={getUserDisplayName} />) : (
              <>
                <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[9px]">
                    <div className="flex items-center gap-1">
                      <Calendar size={9} className="text-gray-500" />
                      <span className="text-gray-600 dark:text-gray-400">
                        {dateFilter === "today" ? "Today" : 
                         dateFilter === "week" ? "Last 7 days" : 
                         dateFilter === "month" ? "Last 30 days" : 
                         dateFilter === "custom" ? `Custom` : "All"}
                      </span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-[9px]">
                      {sortedFilteredSales.length} sales • Ksh {formatCurrency(sortedFilteredSales.reduce((acc, s) => acc + Number(s.amount), 0))}
                    </div>
                  </div>
                  {isFilterActive && (
                    <div className="text-[8px] text-blue-600 dark:text-blue-400 mt-1">
                      Filters applied
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {sortedFilteredSales.map((sale) => (
                    isMobile ? (
                      <MobileSaleCard 
                        key={sale.id}
                        sale={sale}
                        expandedSaleId={expandedSaleId}
                        setExpandedSaleId={setExpandedSaleId}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                        formatDateTime={formatDateTime}
                        getUserDisplayName={getUserDisplayName}
                        paymentMethods={paymentMethods}
                        isRecentlyUpdated={isRecentlyUpdated}
                        isSaleModified={isSaleModified}
                        handleViewAuditLog={handleViewAuditLog}
                        handleEditSale={handleEditSale}
                        showDeleteConfirmationWithReason={showDeleteConfirmationWithReason}
                        loading={loading}
                      />
                    ) : (
                      <div key={sale.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                {sale.customer?.name || "-"}
                              </h3>
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                #{sale.id}
                              </span>
                              {sale.customer?.phone && (
                                <span className="text-[11px] text-gray-500 dark:text-gray-400">{sale.customer.phone}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              sale.status === "PAID" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : 
                              sale.status === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" : 
                              "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            }`}>{sale.status}</span>
                            {sale.assignedStaff && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                <UserCheck size={10} />
                                {sale.assignedStaff.name}
                              </span>
                            )}
                            {Array.isArray(sale.tradeins) && sale.tradeins.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                <Gift size={10} />
                                Trade-In · {sale.tradeins.length}
                              </span>
                            )}
                            <button onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)} 
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                              {expandedSaleId === sale.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-2">
                          <div><span className="text-gray-500">Amount:</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">Ksh {formatCurrency(sale.amount)}</span></div>
                          <div><span className="text-gray-500">Remaining:</span><span className="font-semibold text-red-600 dark:text-red-400 ml-1">Ksh {formatCurrency(sale.remainingAmount)}</span></div>
                          <div><span className="text-gray-500">Date:</span><span className="ml-1 text-gray-700 dark:text-gray-300">{formatDate(sale.date)}</span></div>
                          {sale.dueDate && (
                            <div><span className="text-gray-500">Due:</span><span className="ml-1 text-gray-700 dark:text-gray-300">{formatDate(sale.dueDate)}</span></div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 mb-2">
                          {sale.createdBy && (
                            <div className="flex items-center gap-1">
                              <User size={10} className="text-blue-400" />
                              <span>Created: {getUserDisplayName(sale.createdBy).name}</span>
                              {sale.createdAt && <span className="text-gray-400">{formatDateTime(sale.createdAt)}</span>}
                            </div>
                          )}
                          {sale.updatedBy && sale.updatedAt && sale.updatedAt !== sale.createdAt && (
                            <div className="flex items-center gap-1">
                              <ClockIcon size={10} className="text-teal-400" />
                              <span>Updated: {getUserDisplayName(sale.updatedBy).name}</span>
                              <span className="text-gray-400">{formatDateTime(sale.updatedAt)}</span>
                            </div>
                          )}
                        </div>
                        
                        {expandedSaleId === sale.id && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
                            {Array.isArray(sale.tradeins) && sale.tradeins.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <Gift size={10} /> Trade-In Items ({sale.tradeins.length})
                                </p>
                                <div className="space-y-1">
                                  {sale.tradeins.map((t: any, i: number) => {
                                    const qty = Number(t.quantity) || 1;
                                    const unit = tradeInUnitValue(t);
                                    const lineTotal = tradeInLineTotal(t);
                                    return (
                                      <div key={t.id ?? i} className="flex justify-between items-start bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg px-2 py-1.5 text-[11px]">
                                        <div className="flex-1 min-w-0 pr-2">
                                          <span className="font-medium text-purple-800 dark:text-purple-200 truncate block">
                                            {t.itemName || "Trade-In Item"}
                                          </span>
                                          <span className="text-[9px] text-purple-600 dark:text-purple-400">
                                            {t.condition ? `${t.condition} · ` : ""}
                                            {qty} × Ksh {formatCurrency(unit)}
                                            {t.category ? ` · ${t.category}` : ""}
                                          </span>
                                          {t.description && (
                                            <span className="text-[9px] text-purple-500 dark:text-purple-400 italic block truncate">
                                              {t.description}
                                            </span>
                                          )}
                                        </div>
                                        <span className="font-bold text-purple-800 dark:text-purple-200 flex-shrink-0">
                                          Ksh {formatCurrency(lineTotal)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <div className="flex justify-between text-[10px] font-bold text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/40 rounded-lg px-2 py-1">
                                    <span>Trade-In Total</span>
                                    <span>Ksh {formatCurrency(tradeInSaleTotal(sale.tradeins))}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button onClick={() => handleViewAuditLog(sale)} 
                                    className="w-full bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1.5 transition-colors">
                              <History size={11} />View Audit History
                            </button>
                          </div>
                        )}
                        
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                          <button onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")} 
                                  className="flex-1 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 text-purple-700 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1">
                            <Download size={10} />Receipt
                          </button>
                          <button onClick={() => handleEditSale(sale)} 
                                  className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-700 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1">
                            <Edit size={10} />Edit
                          </button>
                          <button onClick={() => handleViewAuditLog(sale)} 
                                  className="flex-1 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1">
                            <History size={10} />History
                          </button>
                          <button onClick={() => showDeleteConfirmationWithReason(sale.id)} disabled={loading} 
                                  className="flex-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1 disabled:opacity-50">
                            <Trash2 size={10} />Delete
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                  {sortedFilteredSales.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-sm mb-1">No sales found</div>
                      <div className="text-[11px]">Try adjusting filters</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {editingSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto mt-4 shadow-2xl">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold text-black dark:text-white">Edit Sale #{editingSale.id}</h2>
                  <button onClick={() => setEditingSale(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              <div className="p-3 space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                  <h3 className="font-semibold mb-1.5 text-xs text-black dark:text-white">Sale Information</h3>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div>
                      <span className="text-gray-500">Customer:</span>
                      <div className="font-medium text-gray-900 dark:text-white text-xs">{editingSale.customer.name}</div>
                      {editingSale.customer.phone && (
                        <div className="text-[10px] text-gray-400">{editingSale.customer.phone}</div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>
                      <div className="text-gray-900 dark:text-white text-xs">{formatDate(editingSale.date)}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xs font-semibold mb-1.5 text-black dark:text-white flex items-center justify-between">
                    <span>Products</span>
                    <span className="text-[10px] text-gray-500">{editSaleItems.length} items</span>
                  </h3>
                  
                  <div className="space-y-1.5 mb-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-medium text-[10px] text-gray-700 dark:text-gray-300">Add New Product</h4>
                    
                    <div className="relative product-dropdown-container">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
                        <input 
                          type="text" 
                          placeholder="Search product by name..." 
                          value={productSearch} 
                          onChange={(e) => { 
                            setProductSearch(e.target.value); 
                            setShowProductDropdown(true);
                            if (currentEditItem.productId) {
                              setCurrentEditItem({ ...currentEditItem, productId: 0, productName: "" });
                            }
                          }} 
                          onFocus={() => setShowProductDropdown(true)}
                          className="w-full pl-7 pr-2 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white" 
                        />
                      </div>
                      
                      {showProductDropdown && filteredProducts.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredProducts.map(product => {
                            let stockQty = 0;
                            if (Array.isArray(product.stock)) {
                              stockQty = product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
                            } else if (product.stock && typeof product.stock === 'object' && 'quantity' in product.stock) {
                              stockQty = (product.stock as any).quantity || 0;
                            } else if (typeof product.stock === 'number') {
                              stockQty = product.stock;
                            }
                            
                            const existingItem = editSaleItems.find(item => item.productId === product.id);
                            const existingQty = existingItem ? existingItem.quantity : 0;
                            const availableStock = stockQty - existingQty;
                            
                            return (
                              <div 
                                key={product.id} 
                                onClick={() => handleSelectProduct(product)} 
                                className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-b-0 transition-colors"
                              >
                                <div className="font-medium text-xs text-gray-900 dark:text-white">{product.name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between mt-0.5">
                                  <span>Price: Ksh {formatCurrency(product.price || 0)}</span>
                                  <span className={stockQty <= 0 ? "text-red-500" : "text-green-500"}>
                                    Stock: {stockQty}
                                    {existingQty > 0 && ` (${availableStock} available)`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {showProductDropdown && productSearch.trim() !== "" && filteredProducts.length === 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-center">
                          <p className="text-xs text-gray-500">No products found matching "{productSearch}"</p>
                          <p className="text-[9px] text-gray-400 mt-1">Try a different search term</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] text-gray-500">Quantity</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={currentEditItem.quantity || ''} 
                          onChange={(e) => setCurrentEditItem({...currentEditItem, quantity: parseInt(e.target.value) || 1})} 
                          placeholder="Qty" 
                          className="w-full p-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white" 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500">Price (Ksh)</label>
                        <input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          value={currentEditItem.price || ''} 
                          onChange={(e) => setCurrentEditItem({...currentEditItem, price: parseFloat(e.target.value) || 0})} 
                          placeholder="Price" 
                          className="w-full p-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white" 
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleAddItemToEditSale} 
                      disabled={!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0} 
                      className="w-full bg-blue-600 text-white px-2 py-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {editSaleItems.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-xs border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                        No items added yet
                      </div>
                    ) : (
                      editSaleItems.map((item, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg text-[11px] border border-gray-100 dark:border-gray-600">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1">
                              <span className="font-medium text-gray-900 dark:text-white">{item.productName}</span>
                              <div className="text-[9px] text-gray-400">ID: {item.productId}</div>
                            </div>
                            <button 
                              onClick={() => setEditSaleItems(editSaleItems.filter((_, i) => i !== index))} 
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-500">Qty</label>
                              <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => { 
                                  const newItems = [...editSaleItems]; 
                                  newItems[index].quantity = parseInt(e.target.value) || 1; 
                                  setEditSaleItems(newItems); 
                                }} 
                                className="w-full p-1 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700" 
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] text-gray-500">Price</label>
                              <input 
                                type="number" 
                                value={item.price} 
                                onChange={(e) => { 
                                  const newItems = [...editSaleItems]; 
                                  newItems[index].price = parseFloat(e.target.value) || 0; 
                                  setEditSaleItems(newItems); 
                                }} 
                                className="w-full p-1 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700" 
                              />
                            </div>
                          </div>
                          <div className="text-[9px] text-green-600 dark:text-green-400 mt-1 text-right">
                            Subtotal: Ksh {formatCurrency(item.quantity * item.price)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg mt-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-black dark:text-white">Total Amount:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        Ksh {formatCurrency(currentSaleTotal)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xs font-semibold mb-1.5 text-black dark:text-white">Payments</h3>
                  
                  {editPayments.length > 0 && (
                    <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                      {editPayments.map((payment, index) => {
                        const paymentMethod = paymentMethods.find(m => m.value === payment.method);
                        const Icon = paymentMethod?.icon || Banknote;
                        const isTradeIn = payment.method === "TRADE_IN";
                        const tradeInCount = payment.tradeInItems?.length || 0;
                        const tradeInTotal = (payment.tradeInItems || []).reduce((s, it) => s + (it.totalValue || 0), 0);
                        return (
                          <div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border dark:border-gray-600 text-[11px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon size={14} className={paymentMethod?.color?.split(' ')[0]?.replace('bg-', 'text-') || 'text-gray-500'} />
                              <div>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${paymentMethod?.color || "bg-gray-100 text-gray-700"}`}>
                                  {isTradeIn ? "Trade-In" : payment.method}
                                </span>
                                {payment.id !== undefined && (
                                  <span className="text-[9px] text-gray-400 ml-1">ID: {payment.id}</span>
                                )}
                              </div>
                              {isTradeIn ? (
                                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                                  {tradeInCount} item{tradeInCount === 1 ? "" : "s"} · Ksh {formatCurrency(tradeInTotal)}
                                </span>
                              ) : (
                                <span className="font-medium text-black dark:text-white">Ksh {formatCurrency(parseFloat(payment.amount))}</span>
                              )}
                              {payment.referenceId && (
                                <span className="text-[9px] text-gray-400">Ref: {payment.referenceId}</span>
                              )}
                              {payment.bankName && (
                                <span className="text-[9px] text-gray-400">Bank: {payment.bankName}</span>
                              )}
                              {payment.method === "CREDIT" && payment.dueDate && (
                                <span className="text-[9px] text-yellow-600">Due: {formatDate(payment.dueDate)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isTradeIn && !payment.id && (
                                <button
                                  onClick={() => setShowTradeInModal(true)}
                                  className="text-purple-600 hover:text-purple-800 p-1"
                                  title="Edit Trade-In items"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                              {(payment.id !== undefined || isTradeIn) && (
                                <button
                                  onClick={() => {
                                    if (isTradeIn && !payment.id) {
                                      removeTradeInPayment();
                                    } else if (payment.id !== undefined) {
                                      handleDeletePayment(payment.id as number, editingSale.id);
                                    }
                                  }}
                                  disabled={deletingPaymentId === payment.id}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title={isTradeIn ? "Remove Trade-In" : "Delete payment"}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <h4 className="font-medium text-[10px] text-gray-700 dark:text-gray-300">Add Payment</h4>
                    
                    {/* Payment Method Selection — INCLUDES TRADE-IN */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {["CASH", "MPESA", "BANK", "TRADE_IN"].map((method) => {
                        const methodInfo = paymentMethods.find(m => m.value === method);
                        const Icon = methodInfo?.icon;
                        const isSelected = currentPayment.method === method;
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              setCurrentPayment({ ...currentPayment, method: method as any, referenceId: "", checkDepositDate: "", dueDate: "", bankName: "" });
                              if (method === "TRADE_IN") setShowTradeInModal(true);
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                              isSelected
                                ? method === "TRADE_IN"
                                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600"
                                  : "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                : "border-gray-200 dark:border-gray-600 hover:border-blue-300"
                            }`}
                          >
                            {Icon && <Icon size={16} />}
                            <span className="text-[10px] font-medium">{method === "TRADE_IN" ? "Trade-In" : methodInfo?.label || method}</span>
                          </button>
                        );
                      })}
                    </div>

                    {currentPayment.method === "TRADE_IN" && (
                      <div className="space-y-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5">
                        {(() => {
                          const tradeInTotal = currentTradeInItems.reduce((s, it) => s + (it.totalValue || 0), 0);
                          const diff = currentSaleTotal - tradeInTotal;
                          const hasItems = currentTradeInItems.length > 0;
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                                  <Gift size={12} />
                                  <span className="text-[11px] font-semibold">
                                    {hasItems ? `${currentTradeInItems.length} item${currentTradeInItems.length === 1 ? "" : "s"}` : "No items yet"}
                                  </span>
                                </div>
                                <button
                                  onClick={() => setShowTradeInModal(true)}
                                  className="text-[10px] bg-purple-600 text-white px-2 py-1 rounded-md font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
                                >
                                  <Plus size={10} /> {hasItems ? "Edit" : "Add"} Items
                                </button>
                              </div>

                              {hasItems && (
                                <>
                                  <div className="text-[10px] text-gray-600 dark:text-gray-400 space-y-0.5">
                                    <div className="flex justify-between">
                                      <span>Sale total</span>
                                      <span className="font-semibold text-gray-800 dark:text-gray-200">Ksh {formatCurrency(currentSaleTotal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Trade-in total</span>
                                      <span className="font-semibold text-purple-700 dark:text-purple-300">Ksh {formatCurrency(tradeInTotal)}</span>
                                    </div>
                                  </div>
                                  {Math.abs(diff) < 0.01 ? (
                                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 text-center py-1 flex items-center justify-center gap-1">
                                      <CheckCircle size={11} /> Fully settled — No balance
                                    </div>
                                  ) : diff > 0 ? (
                                    <div className="flex justify-between text-[10px] font-bold text-rose-700 dark:text-rose-400 border-t border-purple-200 dark:border-purple-800 pt-1">
                                      <span>Customer owes:</span>
                                      <span>Ksh {formatCurrency(diff)}</span>
                                    </div>
                                  ) : (
                                    <div className="flex justify-between text-[10px] font-bold text-blue-700 dark:text-blue-400 border-t border-purple-200 dark:border-purple-800 pt-1">
                                      <span>We owe customer:</span>
                                      <span>Ksh {formatCurrency(Math.abs(diff))}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    
                    {currentPayment.method !== "TRADE_IN" && (
                      <div>
                        <label className="text-[9px] text-gray-500">Amount (Ksh)</label>
                        <div className="relative mt-0.5">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">Ksh</span>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={currentPayment.amount} 
                            onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})} 
                            placeholder="0.00" 
                            className="w-full pl-10 pr-2 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white" 
                          />
                        </div>
                      </div>
                    )}
                    
                    {currentPayment.method === "MPESA" && (
                      <div>
                        <label className="text-[9px] text-gray-500">M-Pesa Transaction ID</label>
                        <input 
                          type="text" 
                          value={currentPayment.referenceId} 
                          onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})} 
                          placeholder="e.g., QWERTY123456" 
                          className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white mt-0.5" 
                        />
                        <p className="text-[8px] text-gray-400 mt-0.5">Enter the Till/ Paybill transaction reference</p>
                      </div>
                    )}
                    
                    {currentPayment.method === "BANK" && (
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[9px] text-gray-500">Bank Name</label>
                          <input 
                            type="text" 
                            value={currentPayment.bankName || ''} 
                            onChange={(e) => setCurrentPayment({...currentPayment, bankName: e.target.value})} 
                            placeholder="e.g., KCB, Equity, Co-op" 
                            className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white" 
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">Reference Number</label>
                          <input 
                            type="text" 
                            value={currentPayment.referenceId} 
                            onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})} 
                            placeholder="Transaction reference" 
                            className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-black dark:text-white" 
                          />
                        </div>
                      </div>
                    )}
                    
                    {currentPayment.method !== "TRADE_IN" && (
                      <button 
                        onClick={addEditPayment} 
                        disabled={currentPayment.method !== "CREDIT" && (!currentPayment.amount || parseFloat(currentPayment.amount) <= 0)} 
                        className="w-full bg-green-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Add Payment
                      </button>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-black dark:text-white">Total Sale:</span>
                      <span className="font-bold text-black dark:text-white">Ksh {formatCurrency(currentSaleTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-black dark:text-white">Total Payments:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">Ksh {formatCurrency(editPayments.reduce((sum, p) => sum + Number(p.amount), 0))}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-blue-200 dark:border-blue-800">
                      <span className="text-black dark:text-white">Remaining:</span>
                      <span className={`font-bold ${
                        Math.max(0, currentSaleTotal - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        Ksh {formatCurrency(Math.max(0, currentSaleTotal - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)))}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                  <button 
                    onClick={() => setEditingSale(null)} 
                    disabled={loading} 
                    className="flex-1 bg-gray-500 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateSale} 
                    disabled={loading || editSaleItems.length === 0} 
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  >
                    {loading ? (
                      <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving...</>
                    ) : (
                      <><Save size={12} /> Update Sale</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <TradeInModal
          isOpen={showTradeInModal}
          onClose={() => setShowTradeInModal(false)}
          initialItems={currentTradeInItems}
          onSave={handleSaveTradeInItems}
          saleTotal={currentSaleTotal}
          formatCurrency={formatCurrency}
        />

        {showDeletedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-2 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto mt-4 shadow-2xl">
              <div className="p-3 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-lg"><div className="flex justify-between items-center"><h2 className="text-sm font-bold text-black dark:text-white">Deleted Sales</h2><button onClick={() => { setShowDeletedModal(false); setDeletedSales([]); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button></div></div>
              <div className="p-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg space-y-1.5 mb-3"><div className="grid grid-cols-1 gap-1.5"><div className="relative"><Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={11} /><input type="text" placeholder="Search..." value={deletedSearchTerm} onChange={(e) => { setDeletedSearchTerm(e.target.value); fetchDeletedSales(); }} className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white" /></div></div></div>
                {deletedSalesLoading ? (<div className="text-center py-8 text-gray-500 text-xs">Loading...</div>) : deletedSales.length === 0 ? (<div className="text-center py-8 text-gray-500 text-xs">No deleted sales</div>) : (<div className="space-y-2">{deletedSales.map((deletedSale) => (<div key={deletedSale.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5"><div className="flex justify-between items-start"><div><div className="flex items-center gap-1.5 flex-wrap"><h3 className="font-semibold text-xs text-black dark:text-white">#{deletedSale.originalSaleId} - {deletedSale.customerName}</h3><span className={`px-1 py-0.5 rounded-full text-[9px] font-semibold bg-red-100 text-red-700`}>{deletedSale.statusAtDeletion}</span></div><div className="text-[9px] text-gray-500 mt-0.5">Deleted {formatDate(deletedSale.deletedAt)}</div></div><div className="flex gap-1"><button onClick={() => setShowDeleteDetailsModal(deletedSale)} className="p-1 text-blue-600"><Info size={12} /></button>{!deletedSale.restoredAt && <button onClick={() => handleRestoreSale(deletedSale.id)} className="p-1 text-green-600"><RotateCcw size={12} /></button>}</div></div><div className="text-[10px] text-gray-500 mt-1">Amount: Ksh {formatCurrency(deletedSale.totalAmount)}</div></div>))}</div>)}
              </div>
            </div>
          </div>
        )}

        {showDeleteDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-[70]">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="p-3 border-b dark:border-gray-700"><div className="flex justify-between"><h3 className="text-sm font-bold text-black dark:text-white">Deleted Sale</h3><button onClick={() => setShowDeleteDetailsModal(null)}><X size={14} /></button></div></div>
              <div className="p-3 space-y-2 text-xs">
                <div><span className="text-gray-500">Customer:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.customerName}</span></div>
                <div><span className="text-gray-500">Total:</span> <span className="text-emerald-600">Ksh {formatCurrency(showDeleteDetailsModal.totalAmount)}</span></div>
                <div><span className="text-gray-500">Deleted by:</span> <span className="text-red-600">{getUserDisplayName(showDeleteDetailsModal.deletedBy).name}</span></div>
                {showDeleteDetailsModal.deletionReason && <div><span className="text-gray-500">Reason:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.deletionReason}</span></div>}
              </div>
            </div>
          </div>
        )}

        <AccountingReportsModal isOpen={showAccountingModal} onClose={() => setShowAccountingModal(false)} customers={customers} getUserDisplayName={getUserDisplayName} />

        <EnhancedAuditLogModal isOpen={showAuditModal} onClose={() => { setShowAuditModal(false); setSelectedSaleForAudit(null); setAuditLogs([]); }} auditLogs={auditLogs} loading={auditLogsLoading} sale={selectedSaleForAudit} getUserDisplayName={getUserDisplayName} formatDateTime={formatDateTime} />
      </div>
    </ThemeContext.Provider>
  );
}