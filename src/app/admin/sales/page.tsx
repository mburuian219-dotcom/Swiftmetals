"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Download, CreditCard, AlertTriangle, CheckCircle, Plus, X, Edit, Trash2, Calculator, Save, ChevronDown, ChevronUp, Filter, Calendar, Search, XCircle, User, DollarSign, Banknote, Smartphone, Landmark, CreditCard as CardIcon, Archive, RotateCcw, Info, History, TrendingUp, TrendingDown, Clock as ClockIcon, Users, Receipt, FileSpreadsheet, Moon, Sun, Menu, UserCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// ==================== INTERFACES ====================

/** Customer interface - represents a customer in the system */
interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

/** Product interface - represents a product that can be sold */
interface Product {
  id: number;
  name: string;
  price?: number;
  stock?: number;
}

/** SaleItem interface - represents a product within a sale with quantity and price */
interface SaleItem {
  id: number;
  product: Product;
  quantity: number;
  price: number;
}

/** Payment interface - represents a payment made on a sale */
interface Payment {
  id?: number;
  amount: number;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT";
  date: string;
  referenceId?: string | null;
  checkDepositDate?: string | null;
  dueDate?: string | null;
  status?: "PENDING" | "COMPLETED" | "BOUNCED" | "CLEARED";
}

/** NewPayment interface - used when creating/adding new payments */
interface NewPayment {
  id?: number;
  amount: string;
  method: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT";
  referenceId?: string;
  checkDepositDate?: string;
  checkNumber?: string;
  dueDate?: string;
  bankName?: string;
  checkDate?: string;
  isVerified?: boolean;
  status?: "PENDING" | "CLEARED" | "BOUNCED";
}

/** Staff interface - represents staff member assigned to sale */
interface Staff {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

/** Sale interface - complete sale record including all related data */
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
  paymentMethod?: "CASH" | "MPESA" | "BANK" | "CHECK" | "CARD" | "CREDIT" | "MULTIPLE";
  checkDepositDate?: string | null;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  assignedStaff?: Staff | null;
  assignedStaffId?: number | null;
}

/** NewSaleItem interface - used in edit forms for adding items */
interface NewSaleItem {
  productId: number;
  quantity: number;
  price: number;
  productName: string;
  originalPrice?: number;
}

/** UserDetail interface - stores user information fetched from the system */
interface UserDetail {
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
}

/** Enhanced AuditLog interface - tracks detailed changes made to a sale */
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

/** DeletedSale interface - represents a sale that has been soft-deleted and archived */
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

/** RecentlyClearedDebt interface - tracks debts that were recently paid off */
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

// ==================== THEME CONTEXT ====================
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

function useTheme() {
  return React.useContext(ThemeContext);
}

// Mobile card component for better mobile viewing
const MobileSaleCard = ({ sale, expandedSaleId, setExpandedSaleId, formatCurrency, formatDate, formatDateTime, getUserDisplayName, paymentMethods, isRecentlyUpdated, isSaleModified, handleViewAuditLog, handleEditSale, showDeleteConfirmationWithReason, loading }: any) => {
  const isExpanded = expandedSaleId === sale.id;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Compact header for mobile */}
      <div 
        className="p-3 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors"
        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {sale.customer?.name || "-"}
              </h3>
              {sale.customer?.phone && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{sale.customer.phone}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                sale.status === "PAID" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                sale.status === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" :
                "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              }`}>
                {sale.status}
              </span>
              {sale.assignedStaff && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <UserCheck size={10} />
                  {sale.assignedStaff.name.split(' ')[0]}
                </span>
              )}
              {isRecentlyUpdated(sale) && isSaleModified(sale) && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  Updated
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              Ksh {formatCurrency(sale.amount)}
            </div>
            <div className="text-xs text-gray-500">
              Due: Ksh {formatCurrency(sale.remainingAmount)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Calendar size={10} />
            <span>{formatDate(sale.date)}</span>
          </div>
          <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-3">
          {/* Assigned Staff Info - Prominent display */}
          {sale.assignedStaff && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Assigned Staff:</span>
                <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">{sale.assignedStaff.name}</span>
                {sale.assignedStaff.phone && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">({sale.assignedStaff.phone})</span>
                )}
              </div>
            </div>
          )}
          
          {/* Payment methods */}
          {sale.payments && sale.payments.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Payments:</div>
              <div className="flex flex-wrap gap-1">
                {sale.payments.slice(0, 3).map((payment: any, idx: number) => {
                  const IconComponent = paymentMethods.find((m: any) => m.value === payment.method)?.icon || Banknote;
                  return (
                    <span key={idx} className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                      paymentMethods.find((m: any) => m.value === payment.method)?.color || "bg-gray-100 text-gray-700"
                    }`}>
                      <IconComponent size={10} />
                      <span>{payment.method}</span>
                      <span className="font-semibold">Ksh {formatCurrency(payment.amount)}</span>
                    </span>
                  );
                })}
                {sale.payments.length > 3 && (
                  <span className="text-gray-400 text-xs px-2 py-0.5">+{sale.payments.length - 3}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Products */}
          {sale.saleitems && sale.saleitems.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Items:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {sale.saleitems.map((item: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                    <span className="truncate flex-1">{item.product.name}</span>
                    <span className="ml-2 flex-shrink-0">×{item.quantity} @ Ksh {formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Last updated info */}
          {sale.updatedAt && sale.updatedBy && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <ClockIcon size={10} />
              <span>Updated {formatDateTime(sale.updatedAt)} by {getUserDisplayName(sale.updatedBy).name}</span>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")}
              className="flex-1 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 text-purple-700 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
            >
              <Download size={12} />
              Receipt
            </button>
            <button
              onClick={() => handleEditSale(sale)}
              className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-700 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
            >
              <Edit size={12} />
              Edit
            </button>
            <button
              onClick={() => handleViewAuditLog(sale)}
              className="flex-1 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 text-gray-700 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1"
            >
              <History size={12} />
              History
            </button>
            <button
              onClick={() => showDeleteConfirmationWithReason(sale.id)}
              disabled={loading}
              className="flex-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={12} />
              Delete
            </button>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
              <FileSpreadsheet size={20} />
              Accounting Reports
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Report Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setReportType("daily")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "daily" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Daily Report</button>
              <button onClick={() => setReportType("weekly")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "weekly" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Weekly Report</button>
              <button onClick={() => setReportType("monthly")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "monthly" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Monthly Report</button>
              <button onClick={() => setReportType("outstanding")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "outstanding" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Outstanding Debts</button>
              <button onClick={() => setReportType("customer")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "customer" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Customer History</button>
              <button onClick={() => setReportType("payment-activity")} className={`px-3 py-2 text-sm rounded-xl transition ${reportType === "payment-activity" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Payment Activity</button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">What each report shows:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Daily/Weekly/Monthly:</strong> All payments received during period</li>
                  <li><strong>Outstanding Debts:</strong> All UNPAID and PARTIAL sales</li>
                  <li><strong>Customer History:</strong> Complete transaction history</li>
                  <li><strong>Payment Activity:</strong> Sales with payments in selected period</li>
                </ul>
              </div>
            </div>
          </div>

          {(reportType === "daily" || reportType === "weekly" || reportType === "monthly") && (
            <>
              {reportType === "daily" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
                  <input type="date" value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                </div>
              )}
              {(reportType === "weekly" || reportType === "monthly") && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                    <input type="date" value={accountingStartDate} onChange={(e) => setAccountingStartDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                    <input type="date" value={accountingEndDate} onChange={(e) => setAccountingEndDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                  </div>
                </div>
              )}
            </>
          )}

          {reportType === "outstanding" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">As of Date</label>
              <input type="date" value={accountingDate} onChange={(e) => setAccountingDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
            </div>
          )}

          {reportType === "payment-activity" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setAccountingPeriod("daily")} className={`px-3 py-2 text-sm rounded-xl transition ${accountingPeriod === "daily" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Daily</button>
                  <button onClick={() => setAccountingPeriod("weekly")} className={`px-3 py-2 text-sm rounded-xl transition ${accountingPeriod === "weekly" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Weekly</button>
                  <button onClick={() => setAccountingPeriod("monthly")} className={`px-3 py-2 text-sm rounded-xl transition ${accountingPeriod === "monthly" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"}`}>Monthly</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input type="date" value={accountingStartDate} onChange={(e) => setAccountingStartDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input type="date" value={accountingEndDate} onChange={(e) => setAccountingEndDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                </div>
              </div>
            </>
          )}

          {reportType === "customer" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Customer</label>
                <div className="relative">
                  <input type="text" placeholder="Search customer..." value={accountingCustomerSearch} onChange={(e) => { setAccountingCustomerSearch(e.target.value); setAccountingShowCustomerDropdown(true); }} onFocus={() => setAccountingShowCustomerDropdown(true)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                  {accountingShowCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {filteredCustomers.map(customer => (
                        <div key={customer.id} onClick={() => { setAccountingCustomerId(customer.id.toString()); setAccountingCustomerSearch(customer.name); setAccountingShowCustomerDropdown(false); }} className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 text-sm">
                          <div className="font-medium text-black dark:text-white truncate">{customer.name}</div>
                          {customer.phone && <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input type="date" value={accountingStartDate} onChange={(e) => setAccountingStartDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input type="date" value={accountingEndDate} onChange={(e) => setAccountingEndDate(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-black dark:text-white bg-white dark:bg-gray-700 text-sm" />
                </div>
              </div>
            </>
          )}
          
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 text-sm transition-colors">Cancel</button>
            <button onClick={downloadAccountingReport} disabled={downloadingReport || (reportType === "customer" && !accountingCustomerId)} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2 transition-colors">
              {downloadingReport ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Downloading...</>) : (<><Download size={16} />Download CSV</>)}
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

  const analyzeRecentlyClearedDebts = useCallback(() => {
    const cleared: RecentlyClearedDebt[] = [];
    const now = new Date();
    let thresholdDate = new Date();
    switch (timeRange) {
      case "today": thresholdDate.setHours(0, 0, 0, 0); break;
      case "week": thresholdDate.setDate(now.getDate() - 7); break;
      case "month": thresholdDate.setMonth(now.getMonth() - 1); break;
    }
    sales.forEach(sale => {
      if (sale.status === "PAID" && sale.updatedAt) {
        const updatedDate = new Date(sale.updatedAt);
        if (updatedDate >= thresholdDate) {
          const totalPayments = sale.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
          const recentPayments = sale.payments?.filter(p => new Date(p.date) >= thresholdDate);
          const lastPayment = recentPayments?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          if (totalPayments >= sale.amount - 0.01) {
            cleared.push({
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
    cleared.sort((a, b) => new Date(b.clearedAt).getTime() - new Date(a.clearedAt).getTime());
    setRecentlyCleared(cleared);
    setLoading(false);
  }, [sales, timeRange]);

  useEffect(() => {
    analyzeRecentlyClearedDebts();
  }, [analyzeRecentlyClearedDebts]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ""; }
  };

  const totalCleared = recentlyCleared.reduce((sum, debt) => sum + debt.clearedAmount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-4 text-white">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold">Accounting Dashboard</h2>
            <p className="text-xs opacity-90">Track cleared debts and financial activity</p>
          </div>
          <div className="flex gap-2">
            {["today", "week", "month"].map((range) => (
              <button key={range} onClick={() => setTimeRange(range as any)} className={`px-3 py-1 rounded-lg text-xs transition-colors ${timeRange === range ? "bg-white text-green-700 font-semibold" : "bg-green-700 text-white hover:bg-green-800"}`}>
                {range === "today" ? "Today" : range === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-green-600" /><span className="text-xs text-gray-600 dark:text-gray-400">Debts Cleared</span></div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400">{recentlyCleared.length}</div>
          <div className="text-xs text-gray-500">in selected period</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-1"><Receipt size={16} className="text-blue-600" /><span className="text-xs text-gray-600 dark:text-gray-400">Total Amount</span></div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400">Ksh {formatCurrency(totalCleared)}</div>
          <div className="text-xs text-gray-500">recovered</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-3 border-b dark:border-gray-700">
          <h3 className="font-semibold text-black dark:text-white flex items-center gap-2"><ClockIcon size={16} className="text-green-600" />Recently Cleared Debts</h3>
          <p className="text-xs text-gray-500 mt-1">Sales that were recently paid off</p>
        </div>
        <div className="divide-y dark:divide-gray-700">
          {loading ? (<div className="p-8 text-center text-gray-500">Loading...</div>) : recentlyCleared.length === 0 ? (
            <div className="p-8 text-center text-gray-500"><CheckCircle size={32} className="mx-auto text-green-300 mb-2" />No debts cleared in this period</div>
          ) : (
            recentlyCleared.map((debt, idx) => (
              <div key={idx} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div><div className="font-medium text-black dark:text-white">{debt.customerName}</div>{debt.customerPhone && <div className="text-xs text-gray-500">{debt.customerPhone}</div>}</div>
                  <div className="text-right"><div className="text-sm font-bold text-green-700 dark:text-green-400">Ksh {formatCurrency(debt.clearedAmount)}</div><div className="text-xs text-gray-500">Sale #{debt.saleId}</div></div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1"><Calendar size={10} /><span>Cleared: {formatDateTime(debt.clearedAt)}</span></div>
                  <div className="flex items-center gap-1"><User size={10} /><span>By: {getUserDisplayName(debt.clearedBy).name}</span></div>
                  <div className="flex items-center gap-1"><CreditCard size={10} /><span>Method: {debt.paymentMethod}</span></div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"><div className="bg-green-600 rounded-full h-1.5 transition-all" style={{ width: `${(debt.clearedAmount / debt.originalAmount) * 100}%` }} /></div>
                  <span className="text-xs text-gray-500">{Math.round((debt.clearedAmount / debt.originalAmount) * 100)}%</span>
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

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
      case "UPDATE": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300";
      case "DELETE": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300";
      case "RESTORE": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE": return <CheckCircle size={14} />;
      case "UPDATE": return <Edit size={14} />;
      case "DELETE": return <Trash2 size={14} />;
      case "RESTORE": return <RotateCcw size={14} />;
      default: return <History size={14} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl z-10">
          <div className="flex justify-between items-center">
            <div><h3 className="text-xl font-bold text-black dark:text-white flex items-center gap-2"><History size={22} className="text-blue-600" />Audit History</h3><p className="text-sm text-gray-500 mt-1">Sale #{sale.id} - {sale.customer?.name}</p></div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={22} /></button>
          </div>
        </div>
        <div className="p-4">
          {loading ? (<div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div><p className="text-gray-500 mt-3">Loading audit logs...</p></div>) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><History size={48} className="mx-auto text-gray-300 mb-3" /><p>No audit records found for this sale</p><p className="text-xs mt-1">Changes will appear here when the sale is modified</p></div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log, index) => (
                <div key={log.id} className={`border dark:border-gray-700 rounded-xl p-3 transition-all hover:shadow-md ${index === 0 ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-900/10' : 'dark:bg-gray-800/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActionColor(log.action)}`}>{getActionIcon(log.action)}</div></div>
                    <div className="flex-1">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getActionColor(log.action)} border`}>{log.action}</span>{log.changeCategory && <span className="ml-2 text-xs text-gray-500">{log.changeCategory}</span>}</div>
                        <div className="text-xs text-right"><div className="font-medium text-gray-700 dark:text-gray-300">{getUserDisplayName(log.changedBy).name}</div><div className="text-gray-400">{formatDateTime(log.changedAt)}</div></div>
                      </div>
                      {log.changeSummary && <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-900/50 p-2 rounded-lg">{log.changeSummary}</div>}
                      {log.fieldName && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-600 mb-1">Field: <span className="font-mono">{log.fieldName}</span></div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-800"><div className="text-red-600 font-medium mb-1">Previous Value</div><div className="text-gray-700 dark:text-gray-300 break-words">{log.oldValue || "—"}</div></div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800"><div className="text-green-600 font-medium mb-1">New Value</div><div className="text-gray-700 dark:text-gray-300 break-words">{log.newValue || "—"}</div></div>
                          </div>
                          {log.difference && <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg border border-yellow-200 dark:border-yellow-800"><span className="font-medium text-yellow-700">Change:</span> {log.difference}</div>}
                        </div>
                      )}
                      {log.ipAddress && <div className="mt-2 text-xs text-gray-400">IP: {log.ipAddress}</div>}
                      {log.notes && <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-200 dark:border-gray-600"><span className="font-medium text-gray-600">Note:</span> {log.notes}</div>}
                      {log.snapshot && (<details className="mt-2"><summary className="text-xs text-blue-500 cursor-pointer hover:text-blue-700">View complete snapshot</summary><pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">{JSON.stringify(log.snapshot, null, 2)}</pre></details>)}
                    </div>
                  </div>
                </div>
              ))}
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
    cashAmount: number; mpesaAmount: number; bankAmount: number; checkAmount: number; cardAmount: number; creditAmount: number;
    todayCash: number; todayMpesa: number; todayBank: number; todayCheck: number; todayCard: number; todayCredit: number;
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
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h2 className="text-base font-bold text-black dark:text-white mb-3">{dateFilter === "today" ? "Today's Payments" : "Overall Payment Breakdown"}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {paymentCategories.map((category) => (
          <div key={category.method} className={`bg-${category.color}-50 dark:bg-${category.color}-900/20 p-2 rounded-lg border border-${category.color}-200 dark:border-${category.color}-800`}>
            <div className="flex items-center gap-1 mb-1"><category.icon className={`text-${category.color}-600 dark:text-${category.color}-400`} size={12} /><span className={`text-xs font-medium text-${category.color}-800 dark:text-${category.color}-300`}>{category.method}</span></div>
            <div className={`text-sm font-bold text-${category.color}-700 dark:text-${category.color}-400`}>Ksh {formatCurrency(category.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function EnhancedSalesPage() {
  // ==================== THEME STATE ====================
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

  // ==================== STATE VARIABLES ====================
  
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
  const [currentPayment, setCurrentPayment] = useState<NewPayment>({ amount: "", method: "CASH", referenceId: "", checkDepositDate: "", dueDate: "" });
  
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
  
  // Detect mobile view
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
    if (!confirm("Are you sure you want to restore this sale? This will recreate the sale with all its original items and payments.")) return;
    setRestoringSaleId(deletedSaleId);
    setError(null);
    try {
      const ipAddress = await getClientIP();
      const response = await fetch(`/api/deleted-sales/${deletedSaleId}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restoredBy: currentUser, restoredByEmail: currentUserEmail, ipAddress }) });
      const data = await response.json();
      if (response.ok) {
        setSuccess("Sale restored successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchDeletedSales();
        const salesRes = await fetch("/api/sales");
        if (salesRes.ok) {
          const refreshedSales = await salesRes.json();
          const processedSales = refreshedSales.map(calculateSaleStatus);
          setSales(processedSales);
          extractAvailableUsers(processedSales);
        }
      } else throw new Error(data.error || "Failed to restore sale");
    } catch (err: any) { setError(err.message || "Failed to restore sale"); }
    finally { setRestoringSaleId(null); }
  };

  // ==================== SALE CRUD OPERATIONS ====================

  const handleDeleteSaleWithReason = async (saleId: number, restockItems: boolean = false) => {
    if (!deletionReason.trim()) { setError("Please provide a reason for deletion"); return; }
    setLoading(true);
    setError(null);
    setSuccess("Deleting sale, please wait...");
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      const response = await fetch(`/api/sales/${saleId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restockItems, deletedBy: currentUser, deletedByEmail: currentUserEmail, deletionReason: deletionReason, ipAddress, userAgent }) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Failed to delete sale"); }
      setSales(prevSales => prevSales.filter(s => s.id !== saleId));
      setShowRestockConfirm(null);
      setShowDeletionReasonModal(null);
      setDeletionReason("");
      setSuccess(`Sale deleted successfully${restockItems ? ' with items restocked' : ''}!`);
      setTimeout(() => setSuccess(null), 3000);
      if (showDeletedModal) fetchDeletedSales();
      extractAvailableUsers(sales.filter(s => s.id !== saleId));
    } catch (error: any) { setError(error.message || "Failed to delete sale"); }
    finally { setLoading(false); }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    if (!currentUser) { setError("Please log in to update a sale"); return; }
    setLoading(true);
    setError(null);
    setSuccess("Updating sale, please wait...");
    try {
      const ipAddress = await getClientIP();
      const userAgent = navigator.userAgent;
      const newTotalAmount = editSaleItems.reduce((total, item) => total + (item.quantity * item.price), 0);
      const updateData = {
        saleItems: editSaleItems.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price })),
        payments: editPayments.filter(p => p.id).map(p => ({ id: p.id, amount: Number(p.amount), method: p.method, referenceId: p.referenceId?.trim() || null, checkDepositDate: p.checkDepositDate || null })),
        newPayments: editPayments.filter(p => !p.id).map(p => ({ amount: Number(p.amount), method: p.method, referenceId: p.referenceId?.trim() || null, checkDepositDate: p.checkDepositDate || null, dueDate: p.dueDate || null, date: new Date().toISOString(), status: p.method === "CHECK" ? "PENDING" : "COMPLETED" })),
        amount: newTotalAmount,
        dueDate: editingSale.dueDate || null,
        updatedBy: currentUser,
        updatedByEmail: currentUserEmail,
        ipAddress,
        userAgent,
      };
      const response = await fetch(`/api/sales/${editingSale.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateData) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Failed to update sale"); }
      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);
      setSales(prevSales => prevSales.map(s => s.id === processedSale.id ? processedSale : s));
      setEditingSale(null);
      setEditSaleItems([]);
      setEditPayments([]);
      setCurrentPayment({ amount: "", method: "CASH", referenceId: "", checkDepositDate: "", dueDate: "" });
      setSuccess("Sale updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) {
        const refreshedSales = await salesRes.json();
        const processedSales = refreshedSales.map(calculateSaleStatus);
        setSales(processedSales);
        extractAvailableUsers(processedSales);
      }
    } catch (err: any) { setError(err.message || "Failed to update sale"); }
    finally { setLoading(false); }
  };

  const handleAddItemToEditSale = () => {
    if (stockValidationTimeout) clearTimeout(stockValidationTimeout);
    if (!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0) { setError("Please fill in all item details"); return; }
    const product = products.find(p => p.id === currentEditItem.productId);
    if (!product) { setError("Product not found"); return; }
    let productStock = 0;
    if (Array.isArray(product.stock)) productStock = product.stock.reduce((total: number, s: any) => total + (s.quantity || 0), 0);
    else if (typeof product.stock === 'object' && product.stock !== null) productStock = (product.stock as any).quantity || 0;
    else productStock = Number(product.stock) || 0;
    const existingItem = editSaleItems.find(item => item.productId === currentEditItem.productId);
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = existingQuantity + currentEditItem.quantity;
    if (totalQuantity > productStock) {
      const errorMsg = `Insufficient stock for ${product.name}. Available: ${productStock}, Requested: ${totalQuantity}`;
      setStockError(errorMsg);
      setError(errorMsg);
      const timeout = setTimeout(() => { setStockError(null); setError(null); }, 5000);
      setStockValidationTimeout(timeout);
      return;
    }
    const existingItemIndex = editSaleItems.findIndex(item => item.productId === currentEditItem.productId);
    if (existingItemIndex >= 0) {
      const updatedItems = [...editSaleItems];
      updatedItems[existingItemIndex].quantity += currentEditItem.quantity;
      updatedItems[existingItemIndex].price = currentEditItem.price;
      setEditSaleItems(updatedItems);
    } else {
      setEditSaleItems([...editSaleItems, { ...currentEditItem, productName: product.name, originalPrice: product.price }]);
    }
    setCurrentEditItem({ productId: 0, quantity: 0, price: 0, productName: "" });
    setProductSearch("");
    setError(null);
    setStockError(null);
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditPayments(sale.payments.map(p => ({ id: p.id, amount: p.amount.toString(), method: p.method, referenceId: p.referenceId || "", checkDepositDate: p.checkDepositDate || "" })));
    setEditSaleItems(sale.saleitems.map(item => ({ productId: item.product.id, quantity: item.quantity, price: item.price, productName: item.product.name, originalPrice: item.product.price })));
  };

  const handleDeletePayment = async (paymentId: number, saleId: number) => {
    try {
      setDeletingPaymentId(paymentId);
      const response = await fetch(`/api/payment/${paymentId}?saleId=${saleId}`, { method: "DELETE" });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to delete payment"); }
      const updatedSale = await response.json();
      const processedSale = calculateSaleStatus(updatedSale);
      setSales(prevSales => prevSales.map(s => s.id === processedSale.id ? processedSale : s));
      if (editingSale?.id === saleId) {
        setEditingSale(processedSale);
        setEditPayments(processedSale.payments.map((p: Payment) => ({ id: p.id, amount: p.amount.toString(), method: p.method, referenceId: p.referenceId || "", checkDepositDate: p.checkDepositDate || "" })));
      }
      setSuccess("Payment deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) { setError(error.message || "Failed to delete payment"); }
    finally { setDeletingPaymentId(null); }
  };

  const addEditPayment = () => {
    if (currentPayment.method === "CREDIT") {
      if (!currentPayment.dueDate) { setError("Due date is required for credit/pay later"); return; }
      setEditPayments([...editPayments, { amount: "0", method: currentPayment.method, referenceId: "", checkDepositDate: "", dueDate: currentPayment.dueDate }]);
    } else {
      const amount = parseFloat(currentPayment.amount);
      if (!amount || amount <= 0) { setError("Please enter a valid payment amount"); return; }
      const currentTotal = editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const currentPayments = editPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remainingAmount = currentTotal - currentPayments;
      if (amount > remainingAmount) { setError(`Payment amount cannot exceed remaining balance of Ksh ${remainingAmount.toFixed(2)}`); return; }
      if (currentPayment.method === "CHECK" && !currentPayment.checkDepositDate) { setError("Please specify check deposit date"); return; }
      if (["MPESA", "BANK", "CARD"].includes(currentPayment.method) && !currentPayment.referenceId?.trim()) { setError("Please enter transaction reference"); return; }
      setEditPayments([...editPayments, { amount: currentPayment.amount, method: currentPayment.method, referenceId: currentPayment.referenceId || "", checkDepositDate: currentPayment.checkDepositDate || "", dueDate: "" }]);
    }
    setCurrentPayment({ amount: "", method: "CASH", referenceId: "", checkDepositDate: "", dueDate: "" });
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
  };

  const showDeleteConfirmationWithReason = (saleId: number) => { setShowDeletionReasonModal(saleId); };

  const extractAvailableUsers = (salesData: Sale[]) => {
    const users = new Set<string>();
    salesData.forEach(sale => { if (sale.createdBy) users.add(sale.createdBy); if (sale.updatedBy) users.add(sale.updatedBy); });
    setAvailableUsers(users);
  };

  // Fetch staff list
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

  // ==================== DATA FETCHING ====================

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
        const endpoints = [{ url: "/api/sales", name: "Sales" }, { url: "/api/customers", name: "Customers", fallback: "/api/customer" }, { url: "/api/products", name: "Products" }];
        const [salesRes, customersRes, productsRes] = await Promise.all([fetch(endpoints[0].url).catch(err => { console.error(`❌ ${endpoints[0].name} fetch failed:`, err); return null; }), fetch(endpoints[1].url).catch(err => { console.error(`❌ ${endpoints[1].name} fetch failed:`, err); return null; }), fetch(endpoints[2].url).catch(err => { console.error(`❌ ${endpoints[2].name} fetch failed:`, err); return null; })]);
        let customersData = [];
        if (!customersRes || !customersRes.ok) { try { const altRes = await fetch("/api/customer"); if (altRes.ok) customersData = await altRes.json(); } catch (err) { console.error("❌ Fallback also failed:", err); } } 
        else { customersData = await customersRes.json(); }
        if (!salesRes || !salesRes.ok) throw new Error("Failed to fetch sales data");
        if (!productsRes || !productsRes.ok) throw new Error("Failed to fetch products data");
        const [salesData, productsData] = await Promise.all([salesRes.json(), productsRes.json()]);
        const validCustomers = Array.isArray(customersData) ? customersData : (customersData?.customers || customersData?.data || []);
        const processedSales = Array.isArray(salesData) ? salesData.filter((s: any) => !s.isDeleted).map(calculateSaleStatus) : [];
        const validProducts = Array.isArray(productsData) ? productsData : [];
        setSales(processedSales);
        setCustomers(validCustomers);
        setProducts(validProducts);
        extractAvailableUsers(processedSales);
        console.log("Total sales loaded:", processedSales.length);
        const salesWithUpdatedAt = processedSales.filter(s => s.updatedAt);
        console.log("Sales with updatedAt:", salesWithUpdatedAt.length);
        setDebugInfo(`Total sales: ${processedSales.length}, With updatedAt: ${salesWithUpdatedAt.length}`);
        if (validCustomers.length === 0) { console.warn("⚠️ No customers found"); setError("No customers found. Please add customers first."); }
      } catch (err: any) { const errorMsg = err.message || "Failed to load data"; setError(errorMsg); console.error("❌ Error fetching data:", err); setSales([]); setCustomers([]); setProducts([]); }
      finally { setLoading(false); }
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => { if (user) fetchData(); else { setCurrentUser(""); setCurrentUserEmail(""); setError("Please log in to access sales data"); setLoading(false); } });
    return () => unsubscribe();
  }, [calculateSaleStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-dropdown-container')) setShowCustomerDropdown(false);
      if (!target.closest('.product-dropdown-container')) setShowProductDropdown(false);
      if (!target.closest('.mobile-filter-container')) setShowMobileFilters(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==================== MEMOIZED VALUES ====================

  const paymentMethods = [
    { value: "CASH", label: "Cash", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: Banknote },
    { value: "MPESA", label: "M-Pesa", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Smartphone },
    { value: "BANK", label: "Bank", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Landmark },
    { value: "CHECK", label: "Check", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: DollarSign },
    { value: "CARD", label: "Card", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300", icon: CardIcon },
    { value: "CREDIT", label: "Credit", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: CreditCard }
  ];

  const stats = useMemo(() => {
    const recentlyUpdatedSales = sales.filter(sale => isRecentlyUpdated(sale) && isSaleModified(sale));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const todaySales = sales.filter(sale => { const saleDate = new Date(sale.date); return saleDate >= today && saleDate < tomorrow; });
    let cashAmount = 0, mpesaAmount = 0, bankAmount = 0, checkAmount = 0, cardAmount = 0, creditAmount = 0;
    sales.forEach(sale => { sale.payments?.forEach(payment => { const amount = Number(payment.amount) || 0; switch(payment.method) { case "CASH": cashAmount += amount; break; case "MPESA": mpesaAmount += amount; break; case "BANK": bankAmount += amount; break; case "CHECK": checkAmount += amount; break; case "CARD": cardAmount += amount; break; case "CREDIT": creditAmount += amount; break; } }); });
    const todayPaid = todaySales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayPartial = todaySales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayUnpaid = todaySales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0);
    const todayOutstanding = todaySales.reduce((acc, s) => acc + Number(s.remainingAmount), 0);
    let todayCash = 0, todayMpesa = 0, todayBank = 0, todayCheck = 0, todayCard = 0, todayCredit = 0;
    todaySales.forEach(sale => { sale.payments?.forEach(payment => { const amount = Number(payment.amount) || 0; switch(payment.method) { case "CASH": todayCash += amount; break; case "MPESA": todayMpesa += amount; break; case "BANK": todayBank += amount; break; case "CHECK": todayCheck += amount; break; case "CARD": todayCard += amount; break; case "CREDIT": todayCredit += amount; break; } }); });
    return { totalSales: sales.reduce((acc, s) => acc + Number(s.amount), 0), paidSales: sales.filter(s => s.status === "PAID").reduce((acc, s) => acc + Number(s.amount), 0), partialSales: sales.filter(s => s.status === "PARTIAL").reduce((acc, s) => acc + Number(s.amount), 0), unpaidSales: sales.filter(s => s.status === "UNPAID").reduce((acc, s) => acc + Number(s.amount), 0), totalOutstanding: sales.reduce((acc, s) => acc + Number(s.remainingAmount), 0), paidCount: sales.filter(s => s.status === "PAID").length, partialCount: sales.filter(s => s.status === "PARTIAL").length, unpaidCount: sales.filter(s => s.status === "UNPAID").length, recentlyUpdatedCount: recentlyUpdatedSales.length, recentlyUpdatedAmount: recentlyUpdatedSales.reduce((acc, s) => acc + Number(s.amount), 0), cashAmount, mpesaAmount, bankAmount, checkAmount, cardAmount, creditAmount, todaySales: todaySales.reduce((acc, s) => acc + Number(s.amount), 0), todayPaid, todayPartial, todayUnpaid, todayOutstanding, todayCount: todaySales.length, todayPaidCount: todaySales.filter(s => s.status === "PAID").length, todayPartialCount: todaySales.filter(s => s.status === "PARTIAL").length, todayUnpaidCount: todaySales.filter(s => s.status === "UNPAID").length, todayCash, todayMpesa, todayBank, todayCheck, todayCard, todayCredit };
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
    if (customerFilter.trim()) { const searchTerm = customerFilter.toLowerCase().trim(); filtered = filtered.filter(sale => { const customerName = sale.customer?.name?.toLowerCase() || ""; const customerPhone = sale.customer?.phone?.toLowerCase() || ""; return customerName.includes(searchTerm) || customerPhone.includes(searchTerm); }); }
    if (productNameFilter.trim()) { const searchProduct = productNameFilter.toLowerCase().trim(); filtered = filtered.filter(sale => sale.saleitems?.some(item => item.product.name.toLowerCase().includes(searchProduct))); }
    if (createdByFilter.trim()) filtered = filtered.filter(sale => sale.createdBy?.toLowerCase().includes(createdByFilter.toLowerCase()));
    if (updatedByFilter.trim()) filtered = filtered.filter(sale => sale.updatedBy?.toLowerCase().includes(updatedByFilter.toLowerCase()));
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        switch (dateFilter) {
          case "today": return saleDate >= today && saleDate < tomorrow;
          case "week": { const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7); return saleDate >= weekAgo; }
          case "month": { const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1); return saleDate >= monthAgo; }
          case "custom": if (customStartDate && customEndDate) { const start = new Date(customStartDate); const end = new Date(customEndDate); end.setHours(23, 59, 59, 999); return saleDate >= start && saleDate <= end; } return true;
          default: return true;
        }
      });
    }
    return filtered;
  }, [filteredSales, customerFilter, dateFilter, customStartDate, customEndDate, productNameFilter, createdByFilter, updatedByFilter]);

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

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const searchLower = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(searchLower));
  }, [products, productSearch]);

  const isFilterActive = useMemo(() => customerFilter.trim() !== "" || dateFilter !== "today" || productNameFilter.trim() !== "" || createdByFilter.trim() !== "" || updatedByFilter.trim() !== "", [customerFilter, dateFilter, productNameFilter, createdByFilter, updatedByFilter]);

  // ==================== RENDER ====================

  if (loading && sales.length === 0) return <div className="p-3 min-h-screen bg-gray-50 dark:bg-gray-900"><div className="text-center text-black dark:text-white">Loading...</div></div>;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`p-2 sm:p-4 min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <button onClick={toggleTheme} className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all" aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={20} className="text-gray-700" /> : <Sun size={20} className="text-yellow-500" />}
        </button>

        {/* Restock Confirmation Modal */}
        {showRestockConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-sm w-full p-5 shadow-2xl">
              <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><AlertTriangle className="text-yellow-600" size={20} /></div><h3 className="text-lg font-bold text-black dark:text-white">Confirm Sale Deletion</h3></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Would you like to restock the items from this sale back to inventory?</p>
              <div className="space-y-2">
                <button onClick={() => handleDeleteSaleWithReason(showRestockConfirm, true)} disabled={loading} className="w-full bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"><CheckCircle size={16} />Yes, delete and restock</button>
                <button onClick={() => handleDeleteSaleWithReason(showRestockConfirm, false)} disabled={loading} className="w-full bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"><Trash2 size={16} />No, just delete</button>
                <button onClick={() => setShowRestockConfirm(null)} disabled={loading} className="w-full bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 disabled:opacity-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Deletion Reason Modal */}
        {showDeletionReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-5 shadow-2xl">
              <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><AlertTriangle className="text-red-600" size={20} /></div><h3 className="text-lg font-bold text-black dark:text-white">Reason for Deletion</h3></div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Please provide a reason for deleting this sale (for audit purposes):</p>
              <textarea value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} placeholder="e.g., Wrong customer, Duplicate entry, Incorrect items, etc." className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-black dark:text-white bg-white dark:bg-gray-700 mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent" rows={3} />
              <div className="flex gap-3">
                <button onClick={() => { setShowDeletionReasonModal(null); setDeletionReason(""); }} className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 transition-colors">Cancel</button>
                <button onClick={() => { if (deletionReason.trim()) { setShowRestockConfirm(showDeletionReasonModal); setShowDeletionReasonModal(null); } else setError("Please provide a reason for deletion"); }} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-colors">Continue to Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div><h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Sales Management</h1><p className="text-xs text-gray-500 mt-1">Track and manage all sales transactions</p>{debugInfo && <div className="text-xs text-gray-400 mt-1">{debugInfo} | Recently Updated: {stats.recentlyUpdatedCount}</div>}</div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowAccountingModal(true)} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 flex items-center justify-center gap-2 text-sm shadow-md transition-all"><FileSpreadsheet size={16} />Reports</button>
              <button onClick={() => { const csvData = sales.map(sale => ({ 'Sale ID': sale.id, 'Date': new Date(sale.date).toLocaleDateString(), 'Customer': sale.customer?.name || '-', 'Customer Phone': sale.customer?.phone || '-', 'Products': sale.saleitems?.map(item => `${item.product.name} (x${item.quantity})`).join('; ') || '-', 'Total Amount': sale.amount.toFixed(2), 'Status': sale.status, 'Amount Paid': (sale.amount - sale.remainingAmount).toFixed(2), 'Remaining Amount': sale.remainingAmount.toFixed(2), 'Due Date': sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-', 'Payment Methods': sale.payments?.map(p => p.method).join('; ') || '-', 'Created By': sale.createdBy || '-', 'Updated By': sale.updatedBy || '-', 'Last Updated': sale.updatedAt ? new Date(sale.updatedAt).toLocaleDateString() : '-', 'Assigned Staff': sale.assignedStaff?.name || '-' })); const headers = Object.keys(csvData[0] || {}); const csvContent = [headers.join(','), ...csvData.map(row => headers.map(header => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`).join(','))].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`); link.click(); URL.revokeObjectURL(url); }} className="flex-1 sm:flex-none bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-700 hover:to-emerald-700 flex items-center justify-center gap-2 text-sm shadow-md transition-all"><Download size={16} />Export</button>
            </div>
          </div>
        </div>

        {/* Enhanced Filter Section - Mobile Responsive */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Filter size={18} className="text-gray-500" /><span className="font-medium text-gray-700 dark:text-gray-300">Filters</span>{isFilterActive && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">Active</span>}</div>
            <div className="flex gap-2">
              <button onClick={() => setShowMobileFilters(!showMobileFilters)} className="sm:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><Menu size={18} /></button>
              {isFilterActive && <button onClick={clearFilters} className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"><XCircle size={14} />Clear</button>}
            </div>
          </div>
          
          <div className={`${showMobileFilters ? 'block' : 'hidden sm:block'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Search by name or phone..." value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white" /></div></div>
              <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Search by product name..." value={productNameFilter} onChange={(e) => setProductNameFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white" /></div></div>
              <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Created By</label><div className="relative"><User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><select value={createdByFilter} onChange={(e) => setCreatedByFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"><option value="">All users</option>{Array.from(availableUsers).map(user => <option key={user} value={user}>{getUserDisplayName(user).name}</option>)}</select></div></div>
              <div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Updated By</label><div className="relative"><User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><select value={updatedByFilter} onChange={(e) => setUpdatedByFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white"><option value="">All users</option>{Array.from(availableUsers).map(user => <option key={user} value={user}>{getUserDisplayName(user).name}</option>)}</select></div></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Range:</span>{["today","week","month","all","custom"].map((filter) => (<button key={filter} onClick={() => setDateFilter(filter as any)} className={`px-3 py-1 text-xs rounded-full transition-colors ${dateFilter === filter ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>{filter === "all" ? "All Time" : filter === "today" ? "Today" : filter === "week" ? "This Week" : filter === "month" ? "This Month" : "Custom"}</button>))}</div>
              {dateFilter === "custom" && (<div className="flex gap-2 mt-2"><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white" /><span className="text-gray-400">to</span><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white" /></div>)}
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-start"><div className="flex items-start gap-2"><AlertTriangle size={18} className="flex-shrink-0 mt-0.5" /><span className="text-sm">{error}</span></div><button onClick={clearMessages} className="text-red-700 hover:text-red-900 dark:text-red-300">×</button></div>}
        {success && <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-start"><div className="flex items-start gap-2"><CheckCircle size={18} className="flex-shrink-0 mt-0.5" /><span className="text-sm">{success}</span></div><button onClick={clearMessages} className="text-green-700 hover:text-green-900 dark:text-green-300">×</button></div>}

        {/* Payment Method Breakdown */}
        <PaymentBreakdown stats={stats} dateFilter={dateFilter} />

        {/* Stats Cards - Responsive Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-emerald-500"><div className="text-xs text-gray-500 dark:text-gray-400">Total Sales</div><div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Ksh {formatCurrency(stats.totalSales)}</div><div className="text-xs text-gray-400">{sales.length} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-blue-500"><div className="text-xs text-gray-500 dark:text-gray-400">Fully Paid</div><div className="text-lg font-bold text-blue-600 dark:text-blue-400">Ksh {formatCurrency(stats.paidSales)}</div><div className="text-xs text-gray-400">{stats.paidCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-orange-500"><div className="text-xs text-gray-500 dark:text-gray-400">Partial</div><div className="text-lg font-bold text-orange-600 dark:text-orange-400">Ksh {formatCurrency(stats.partialSales)}</div><div className="text-xs text-gray-400">{stats.partialCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-red-500"><div className="text-xs text-gray-500 dark:text-gray-400">Unpaid</div><div className="text-lg font-bold text-red-600 dark:text-red-400">Ksh {formatCurrency(stats.unpaidSales)}</div><div className="text-xs text-gray-400">{stats.unpaidCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-yellow-500"><div className="text-xs text-gray-500 dark:text-gray-400">Recently Updated</div><div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">Ksh {formatCurrency(stats.recentlyUpdatedAmount)}</div><div className="text-xs text-gray-400">{stats.recentlyUpdatedCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-purple-500"><div className="text-xs text-gray-500 dark:text-gray-400">Outstanding</div><div className="text-lg font-bold text-purple-600 dark:text-purple-400">Ksh {formatCurrency(stats.totalOutstanding)}</div><div className="text-xs text-gray-400">Total remaining</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-green-500"><div className="text-xs text-gray-500 dark:text-gray-400">Today's Sales</div><div className="text-lg font-bold text-green-600 dark:text-green-400">Ksh {formatCurrency(stats.todaySales)}</div><div className="text-xs text-gray-400">{stats.todayCount} orders</div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-teal-500"><div className="text-xs text-gray-500 dark:text-gray-400">Today's Outstanding</div><div className="text-lg font-bold text-teal-600 dark:text-teal-400">Ksh {formatCurrency(stats.todayOutstanding)}</div><div className="text-xs text-gray-400">Remaining today</div></div>
        </div>

        {/* Tabs Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex overflow-x-auto scrollbar-thin border-b dark:border-gray-700">
            {[{ key: "overview", label: "All Sales", count: sales.length }, { key: "paid", label: "Paid", count: stats.paidCount }, { key: "partial", label: "Partial", count: stats.partialCount }, { key: "unpaid", label: "Unpaid", count: stats.unpaidCount }, { key: "recentlyUpdated", label: "Recent Updates", count: stats.recentlyUpdatedCount }, { key: "accounting", label: "Accounting", count: null, icon: TrendingUp }].map((tab) => (<button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-shrink-0 px-3 sm:px-4 py-3 text-center transition-all whitespace-nowrap ${activeTab === tab.key ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/30 dark:bg-blue-900/10" : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}><div className="flex items-center gap-2">{tab.icon && <tab.icon size={14} />}<span className="text-sm">{tab.label}</span>{tab.count !== null && <span className="text-xs text-gray-400">({tab.count})</span>}</div></button>))}
            <button onClick={() => { setShowDeletedModal(true); fetchDeletedSales(); }} className="flex-shrink-0 px-3 sm:px-4 py-3 text-center transition-all whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"><div className="flex items-center gap-2"><Archive size={14} /><span className="text-sm">Deleted</span><span className="text-xs text-gray-400">({deletedSalesTotal})</span></div></button>
          </div>

          <div className="p-3 sm:p-4">
            {activeTab === "accounting" ? (<AccountingPage sales={sales} getUserDisplayName={getUserDisplayName} />) : (
              <>
                {activeTab === "recentlyUpdated" && (<div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"><div className="text-sm text-blue-800 dark:text-blue-300"><div className="font-semibold">📊 Recently Updated Sales</div><div className="text-xs mt-1">Showing sales that were updated in the last 7 days (excluding newly created sales)</div></div></div>)}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><div className="flex items-center gap-2"><Calendar size={12} className="text-gray-500" /><span className="text-gray-600 dark:text-gray-400">{dateFilter === "today" ? "Today's transactions" : dateFilter === "week" ? "Last 7 days" : dateFilter === "month" ? "Last 30 days" : dateFilter === "custom" ? `Custom: ${formatDate(customStartDate)} - ${formatDate(customEndDate)}` : "All transactions"}</span></div><div className="text-gray-500 dark:text-gray-400">{sortedFilteredSales.length} sales • Ksh {formatCurrency(sortedFilteredSales.reduce((acc, s) => acc + Number(s.amount), 0))}</div></div>{(createdByFilter || updatedByFilter) && (<div className="flex flex-wrap gap-2 mt-2">{createdByFilter && <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs">Created by: {getUserDisplayName(createdByFilter).name}</span>}{updatedByFilter && <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-xs">Updated by: {getUserDisplayName(updatedByFilter).name}</span>}</div>)}</div>

                {/* Sales List - Mobile Responsive */}
                <div className="space-y-3">
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
                      // Desktop view - original card design
                      <div key={sale.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-gray-900 dark:text-white">{sale.customer?.name || "-"}</h3>{sale.customer?.phone && <span className="text-xs text-gray-500 dark:text-gray-400">{sale.customer.phone}</span>}</div></div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sale.status === "PAID" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : sale.status === "PARTIAL" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"}`}>{sale.status}</span>
                            {sale.assignedStaff && (<span className="px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center gap-1"><UserCheck size={12} />{sale.assignedStaff.name}</span>)}
                            {isRecentlyUpdated(sale) && isSaleModified(sale) && (<span className="px-2 py-1 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">Recently Updated</span>)}
                            <button onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{expandedSaleId === sale.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3"><div><span className="text-gray-500">Amount:</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">Ksh {formatCurrency(sale.amount)}</span></div><div><span className="text-gray-500">Remaining:</span><span className="font-semibold text-red-600 dark:text-red-400 ml-1">Ksh {formatCurrency(sale.remainingAmount)}</span></div><div><span className="text-gray-500">Date:</span><span className="ml-1 text-gray-700 dark:text-gray-300">{formatDate(sale.date)}</span></div>{sale.dueDate && (<div><span className="text-gray-500">Due:</span><span className="ml-1 text-gray-700 dark:text-gray-300">{formatDate(sale.dueDate)}</span></div>)}</div>
                        {sale.payments && sale.payments.length > 0 && (<div className="mb-3"><div className="flex flex-wrap gap-1">{sale.payments.slice(0, 3).map((payment, idx) => { const IconComponent = paymentMethods.find(m => m.value === payment.method)?.icon || Banknote; return (<span key={idx} className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${paymentMethods.find(m => m.value === payment.method)?.color || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}><IconComponent size={10} /><span>{payment.method}</span>{payment.amount > 0 && <span className="font-semibold">Ksh {formatCurrency(payment.amount)}</span>}</span>); })}</div></div>)}
                        {sale.updatedAt && sale.updatedBy && (<div className="mb-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2"><ClockIcon size={10} /><span>Updated {formatDateTime(sale.updatedAt)} by {getUserDisplayName(sale.updatedBy).name}</span></div>)}
                        {expandedSaleId === sale.id && (<div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3"><div><div className="font-medium text-gray-700 dark:text-gray-300 text-xs mb-2">Products:</div><div className="space-y-1">{sale.saleitems && sale.saleitems.map((item, idx) => (<div key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between"><span>{item.product.name}</span><span>×{item.quantity} @ Ksh {formatCurrency(item.price)}</span></div>))}</div></div>{(sale.createdBy || sale.updatedBy) && (<div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">{sale.createdBy && (<div className="flex items-center gap-1"><User size={10} className="text-blue-500" /><span>Created by: {getUserDisplayName(sale.createdBy).name}</span>{sale.createdAt && <span>on {formatDateTime(sale.createdAt)}</span>}</div>)}</div>)}<button onClick={() => handleViewAuditLog(sale)} className="w-full bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"><History size={14} />View Detailed Audit History</button></div>)}
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2"><button onClick={() => window.open(`/api/receipt/${sale.id}`, "_blank")} className="flex-1 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 text-purple-700 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2"><Download size={14} />Receipt</button><button onClick={() => handleEditSale(sale)} className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2"><Edit size={14} />Edit</button><button onClick={() => showDeleteConfirmationWithReason(sale.id)} disabled={loading} className="flex-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Trash2 size={14} />Delete</button></div>
                      </div>
                    )
                  ))}
                  {sortedFilteredSales.length === 0 && (<div className="text-center py-12 text-gray-500"><div className="text-lg mb-2">No sales found</div><div className="text-sm">Try adjusting your filters</div></div>)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit Sale Modal - Keep existing modal code */}
        {editingSale && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-3 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto mt-4 shadow-2xl">
              <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl"><div className="flex justify-between items-center"><h2 className="text-lg font-bold text-black dark:text-white">Edit Sale #{editingSale.id}</h2><button onClick={() => setEditingSale(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button></div></div>
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><h3 className="font-semibold mb-2 text-sm text-black dark:text-white">Sale Information</h3><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-gray-500">Customer:</span><div className="font-medium text-gray-900 dark:text-white">{editingSale.customer.name}</div></div><div><span className="text-gray-500">Date:</span><div className="text-gray-900 dark:text-white">{formatDate(editingSale.date)}</div></div><div className="col-span-2"><span className="text-gray-500">Status:</span><span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${editingSale.status === "PAID" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : editingSale.status === "PARTIAL" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{editingSale.status}</span></div></div></div>
                <div><h3 className="text-sm font-semibold mb-2 text-black dark:text-white flex items-center gap-1"><Calculator size={14} />Edit Items</h3><div className="space-y-2 mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"><h4 className="font-medium text-xs text-gray-700 dark:text-gray-300">Add New Item</h4><div className="space-y-2"><div className="relative"><input type="text" placeholder="Search product..." value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" />{showProductDropdown && filteredProducts.length > 0 && (<div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">{filteredProducts.map(product => (<div key={product.id} onClick={() => { setCurrentEditItem({ ...currentEditItem, productId: product.id, price: product.price || 0, productName: product.name }); setProductSearch(product.name); setShowProductDropdown(false); }} className="p-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm"><div className="font-medium text-gray-900 dark:text-white">{product.name}</div><div className="text-xs text-gray-500 dark:text-gray-400">Ksh {formatCurrency(product.price || 0)}</div></div>))}</div>)}</div><div className="grid grid-cols-2 gap-2"><input type="number" min="1" value={currentEditItem.quantity || ''} onChange={(e) => setCurrentEditItem({...currentEditItem, quantity: parseInt(e.target.value) || 1})} placeholder="Quantity" className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" /><input type="number" min="0" step="0.01" value={currentEditItem.price || ''} onChange={(e) => setCurrentEditItem({...currentEditItem, price: parseFloat(e.target.value) || 0})} placeholder="Price" className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" /></div><button onClick={handleAddItemToEditSale} disabled={!currentEditItem.productId || currentEditItem.quantity <= 0 || currentEditItem.price <= 0} className="w-full bg-blue-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"><Plus size={14} className="inline mr-1" />Add Item</button></div></div><div className="space-y-2 max-h-40 overflow-y-auto">{editSaleItems.map((item, index) => (<div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border dark:border-gray-600 text-sm"><div className="flex justify-between items-center mb-1"><div className="font-medium text-gray-900 dark:text-white">{item.productName}</div><button onClick={() => setEditSaleItems(editSaleItems.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700"><X size={14} /></button></div><div className="grid grid-cols-2 gap-2"><input type="number" min="1" value={item.quantity} onChange={(e) => { const newItems = [...editSaleItems]; newItems[index].quantity = parseInt(e.target.value) || 1; setEditSaleItems(newItems); }} className="p-1 border rounded text-xs bg-white dark:bg-gray-700 text-black dark:text-white" /><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => { const newItems = [...editSaleItems]; newItems[index].price = parseFloat(e.target.value) || 0; setEditSaleItems(newItems); }} className="p-1 border rounded text-xs bg-white dark:bg-gray-700 text-black dark:text-white" /></div><div className="text-xs text-green-600 dark:text-green-400 mt-1">Subtotal: Ksh {formatCurrency(item.quantity * item.price)}</div></div>))}</div><div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mt-2"><div className="flex justify-between items-center"><span className="font-semibold text-sm text-black dark:text-white">New Total:</span><span className="font-bold text-blue-600 dark:text-blue-400">Ksh {formatCurrency(editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}</span></div></div></div>
                <div><h3 className="text-sm font-semibold mb-2 text-black dark:text-white">Payments</h3>{editPayments.length > 0 && (<div className="space-y-1 mb-3">{editPayments.map((payment, index) => (<div key={index} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border dark:border-gray-600 text-sm"><div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded-full text-xs ${paymentMethods.find(m => m.value === payment.method)?.color}`}>{payment.method}</span><span className="font-medium text-black dark:text-white">Ksh {formatCurrency(parseFloat(payment.amount))}</span></div>{payment.id !== undefined && (<button onClick={() => handleDeletePayment(payment.id as number, editingSale.id)} disabled={deletingPaymentId === payment.id} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>)}</div>))}</div>)}<div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"><div className="grid grid-cols-2 gap-2"><select value={currentPayment.method} onChange={(e) => setCurrentPayment({...currentPayment, method: e.target.value as any})} className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white">{paymentMethods.map(method => (<option key={method.value} value={method.value}>{method.label}</option>))}</select><input type="number" min="0" step="0.01" value={currentPayment.amount} onChange={(e) => setCurrentPayment({...currentPayment, amount: e.target.value})} placeholder="Amount" className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" disabled={currentPayment.method === "CREDIT"} /></div>{["MPESA","BANK","CARD"].includes(currentPayment.method) && (<input type="text" value={currentPayment.referenceId} onChange={(e) => setCurrentPayment({...currentPayment, referenceId: e.target.value})} placeholder="Reference ID" className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" />)}{currentPayment.method === "CHECK" && (<input type="date" value={currentPayment.checkDepositDate} onChange={(e) => setCurrentPayment({...currentPayment, checkDepositDate: e.target.value})} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" />)}{currentPayment.method === "CREDIT" && (<input type="date" value={currentPayment.dueDate} onChange={(e) => setCurrentPayment({...currentPayment, dueDate: e.target.value})} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-black dark:text-white" />)}<button onClick={addEditPayment} className="w-full bg-green-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-green-700 transition-colors"><Plus size={14} className="inline mr-1" />Add Payment</button></div><div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-sm mt-2"><div className="flex justify-between mb-1"><span className="text-black dark:text-white">Total Sale:</span><span className="font-bold text-black dark:text-white">Ksh {formatCurrency(editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0))}</span></div><div className="flex justify-between mb-1"><span className="text-black dark:text-white">Total Payments:</span><span className="font-bold text-green-600 dark:text-green-400">Ksh {formatCurrency(editPayments.reduce((sum, p) => sum + Number(p.amount), 0))}</span></div><div className="flex justify-between pt-1 border-t border-blue-200 dark:border-blue-800"><span className="text-black dark:text-white">Remaining:</span><span className={`font-bold ${Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>Ksh {formatCurrency(Math.max(0, editSaleItems.reduce((sum, item) => sum + (item.quantity * item.price), 0) - editPayments.reduce((sum, p) => sum + Number(p.amount), 0)))}</span></div></div></div>
                <div className="flex gap-2 pt-3"><button onClick={() => setEditingSale(null)} disabled={loading} className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 disabled:opacity-50 transition-colors">Cancel</button><button onClick={handleUpdateSale} disabled={loading} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">{loading ? "Saving..." : "Update Sale"}</button></div>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Sales Modal */}
        {showDeletedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-3 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mt-4 shadow-2xl">
              <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl"><div className="flex justify-between items-center"><h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2"><Archive size={20} />Deleted Sales Archive</h2><button onClick={() => { setShowDeletedModal(false); setDeletedSales([]); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button></div></div>
              <div className="p-4 space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl space-y-2"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Search by customer, deleter..." value={deletedSearchTerm} onChange={(e) => { setDeletedSearchTerm(e.target.value); setDeletedSalesPage(1); fetchDeletedSales(); }} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white" /></div></div><div><label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Deleted Date</label><select value={deletedDateFilter} onChange={(e) => { setDeletedDateFilter(e.target.value as any); setDeletedSalesPage(1); fetchDeletedSales(); }} className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white"><option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option><option value="custom">Custom Range</option></select></div></div>{deletedDateFilter === "custom" && (<div className="grid grid-cols-2 gap-2"><input type="date" value={deletedCustomStartDate} onChange={(e) => { setDeletedCustomStartDate(e.target.value); fetchDeletedSales(); }} className="p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white" /><input type="date" value={deletedCustomEndDate} onChange={(e) => { setDeletedCustomEndDate(e.target.value); fetchDeletedSales(); }} className="p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-black dark:text-white" /></div>)}</div>
                {deletedSalesLoading ? (<div className="text-center py-12 text-gray-500">Loading...</div>) : deletedSales.length === 0 ? (<div className="text-center py-12 text-gray-500">No deleted sales found</div>) : (<div className="space-y-3">{deletedSales.map((deletedSale) => (<div key={deletedSale.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"><div className="flex justify-between items-start mb-2"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-semibold text-black dark:text-white">#{deletedSale.originalSaleId} - {deletedSale.customerName}</h3><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${deletedSale.statusAtDeletion === "PAID" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : deletedSale.statusAtDeletion === "PARTIAL" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>{deletedSale.statusAtDeletion}</span></div><div className="text-xs text-gray-500 mt-1">Original: {formatDate(deletedSale.saleDate)} | Deleted: {formatDateTime(deletedSale.deletedAt)}</div></div><div className="flex gap-2"><button onClick={() => setShowDeleteDetailsModal(deletedSale)} className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400" title="View Details"><Info size={16} /></button>{!deletedSale.restoredAt && new Date(deletedSale.expiresAt) > new Date() && (<button onClick={() => handleRestoreSale(deletedSale.id)} disabled={restoringSaleId === deletedSale.id} className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 disabled:opacity-50">{restoringSaleId === deletedSale.id ? (<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>) : (<RotateCcw size={16} />)}</button>)}</div></div><div className="grid grid-cols-2 gap-2 text-xs mb-2"><div><span className="text-gray-500">Total:</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 ml-1">Ksh {formatCurrency(deletedSale.totalAmount)}</span></div><div><span className="text-gray-500">Deleted By:</span><span className="font-medium text-red-600 dark:text-red-400 ml-1">{getUserDisplayName(deletedSale.deletedBy).name}</span></div></div><div className="text-xs text-gray-600 dark:text-gray-400 mb-2"><div className="font-medium">Items:</div><div className="truncate">{deletedSale.saleItemsSummary}</div></div>{deletedSale.deletionReason && (<div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-xl border border-yellow-200 dark:border-yellow-800"><span className="font-medium">Reason:</span> {deletedSale.deletionReason}</div>)}</div>))}{deletedSalesTotal > 50 && (<div className="flex justify-center gap-2 mt-4"><button onClick={() => { setDeletedSalesPage(Math.max(1, deletedSalesPage - 1)); fetchDeletedSales(); }} disabled={deletedSalesPage === 1} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-xl disabled:opacity-50">Previous</button><span className="text-sm text-gray-600 dark:text-gray-400">Page {deletedSalesPage} of {Math.ceil(deletedSalesTotal / 50)}</span><button onClick={() => { setDeletedSalesPage(deletedSalesPage + 1); fetchDeletedSales(); }} disabled={deletedSalesPage >= Math.ceil(deletedSalesTotal / 50)} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-xl disabled:opacity-50">Next</button></div>)}</div>)}
              </div>
            </div>
          </div>
        )}

        {/* Deleted Sale Details Modal */}
        {showDeleteDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-[70]">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-black dark:text-white">Deleted Sale Details</h3><button onClick={() => setShowDeleteDetailsModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button></div></div>
              <div className="p-4 space-y-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><h4 className="font-semibold text-sm mb-2 text-black dark:text-white">Sale Information</h4><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-gray-500">ID:</span> <span className="text-black dark:text-white">#{showDeleteDetailsModal.originalSaleId}</span></div><div><span className="text-gray-500">Customer:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.customerName}</span></div><div><span className="text-gray-500">Phone:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.customerPhone || "-"}</span></div><div><span className="text-gray-500">Total:</span> <span className="text-emerald-600 dark:text-emerald-400">Ksh {formatCurrency(showDeleteDetailsModal.totalAmount)}</span></div><div><span className="text-gray-500">Date:</span> <span className="text-black dark:text-white">{formatDate(showDeleteDetailsModal.saleDate)}</span></div><div><span className="text-gray-500">Status:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.statusAtDeletion}</span></div></div></div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl"><h4 className="font-semibold text-sm mb-2 text-red-800 dark:text-red-300">Deletion Information</h4><div className="space-y-1 text-sm"><div><span className="text-gray-600">By:</span> <span className="text-red-700 dark:text-red-400">{getUserDisplayName(showDeleteDetailsModal.deletedBy).name}</span></div><div><span className="text-gray-600">At:</span> <span className="text-black dark:text-white">{formatDateTime(showDeleteDetailsModal.deletedAt)}</span></div><div><span className="text-gray-600">Restocked:</span> <span className={showDeleteDetailsModal.restockedItems ? "text-green-600" : "text-red-600"}>{showDeleteDetailsModal.restockedItems ? "Yes" : "No"}</span></div>{showDeleteDetailsModal.deletionReason && (<div><span className="text-gray-600">Reason:</span> <span className="text-black dark:text-white">{showDeleteDetailsModal.deletionReason}</span></div>)}</div></div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl"><h4 className="font-semibold text-sm mb-2 text-black dark:text-white">Items</h4><div className="text-sm space-y-1">{showDeleteDetailsModal.saleItemsSummary.split(', ').map((item, idx) => (<div key={idx} className="text-gray-700 dark:text-gray-300">• {item}</div>))}</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Accounting Reports Modal */}
        <AccountingReportsModal isOpen={showAccountingModal} onClose={() => setShowAccountingModal(false)} customers={customers} getUserDisplayName={getUserDisplayName} />

        {/* Enhanced Audit Log Modal */}
        <EnhancedAuditLogModal isOpen={showAuditModal} onClose={() => { setShowAuditModal(false); setSelectedSaleForAudit(null); setAuditLogs([]); }} auditLogs={auditLogs} loading={auditLogsLoading} sale={selectedSaleForAudit} getUserDisplayName={getUserDisplayName} formatDateTime={formatDateTime} />
      </div>
    </ThemeContext.Provider>
  );
}