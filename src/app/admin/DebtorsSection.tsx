import { Users, Mail, Phone, Send, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, MessageCircle, Download, Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

type Sale = {
  id: number;
  date: string;
  items: string;
  amount: number;
};

type Payment = {
  date: string;
  amount: number;
  method: string;
};

type Debtor = {
  id: number;
  name: string;
  email: string;
  phone: string;
  totalSales: number;
  paid: number;
  balance: number;
  sales: Sale[];
  payments: Payment[];
};

type FormData = {
  name: string;
  email: string;
  phone: string;
  totalSales: number;
};

export default function DebtorsSection() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Debtor;
    direction: 'asc' | 'desc';
  } | null>({ key: 'balance', direction: 'desc' });
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    totalSales: 0,
  });

  useEffect(() => {
    fetchDebtors();
  }, []);

  // Filter and sort debtors when search query or sort config changes
  useEffect(() => {
    let result = [...debtors];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(debtor => 
        debtor.name.toLowerCase().includes(query) ||
        debtor.email.toLowerCase().includes(query) ||
        debtor.phone.includes(query) ||
        debtor.sales.some(sale => 
          sale.items.toLowerCase().includes(query)
        ) ||
        debtor.balance.toString().includes(query) ||
        debtor.totalSales.toString().includes(query)
      );
    }
    
    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredDebtors(result);
  }, [debtors, searchQuery, sortConfig]);

  const fetchDebtors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all sales with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch("/api/sales", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error("Failed to fetch sales");
      const sales = await response.json();

      // Filter and group sales by customer where payment is not PAID
      const debtorMap = new Map<number, Debtor>();

      sales.forEach((sale: any) => {
        // Only include unpaid or partially paid sales
        if ((sale.status === "UNPAID" || sale.status === "PARTIAL") && sale.customer) {
          const customerId = sale.customer.id;

          if (!debtorMap.has(customerId)) {
            debtorMap.set(customerId, {
              id: customerId,
              name: sale.customer.name || "Unknown",
              email: sale.customer.email || "",
              phone: sale.customer.phone || "",
              totalSales: 0,
              paid: 0,
              balance: 0,
              sales: [],
              payments: [],
            });
          }

          const debtor = debtorMap.get(customerId)!;
          debtor.totalSales += sale.amount;
          debtor.paid += sale.totalPaid;
          debtor.balance = debtor.totalSales - debtor.paid;

          // Build items string from saleitems
          const itemsStr = sale.saleitems
            ?.map((item: any) => `${item.product?.name || "Item"} x${item.quantity}`)
            .join(", ") || "Items";

          debtor.sales.push({
            id: sale.id,
            date: sale.date,
            items: itemsStr,
            amount: sale.amount,
          });

          // Add payment history - filter only cleared payments
          if (sale.payments && Array.isArray(sale.payments)) {
            sale.payments.forEach((payment: any) => {
              if (payment.status === "CLEARED") {
                debtor.payments.push({
                  date: payment.paidAt || payment.createdAt,
                  amount: payment.amount,
                  method: payment.method || "Payment",
                });
              }
            });
          }
        }
      });

      const debtorArray = Array.from(debtorMap.values());
      setDebtors(debtorArray);
      setFilteredDebtors(debtorArray);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Request timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
      console.error("Error fetching debtors:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleSort = (key: keyof Debtor) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'desc' };
    });
  };

  const SortIcon = ({ sortKey }: { sortKey: keyof Debtor }) => {
    if (!sortConfig || sortConfig.key !== sortKey) {
      return <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="w-3 h-3 text-amber-600" /> : 
      <ChevronDown className="w-3 h-3 text-amber-600" />;
  };

  const openModal = (debtor?: Debtor) => {
    if (debtor) {
      setEditingId(debtor.id);
      setFormData({
        name: debtor.name,
        email: debtor.email,
        phone: debtor.phone,
        totalSales: debtor.totalSales,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", totalSales: 0 });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    alert("Debtors are managed through sales. Please create or edit a sale for this customer instead.");
    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    alert("To remove a debtor, delete all their associated sales from the Sales section.");
  };

  // Single Receipt Download
  const handleDownloadReceipt = (saleId: number) => {
    // Open single receipt in new tab
    const receiptUrl = `/api/receipt/${saleId}`;
    window.open(receiptUrl, '_blank');
  };

  // Full Statement Download
  const handleDownloadStatement = (debtor: Debtor) => {
    // Open customer statement in new tab
    const statementUrl = `/api/customer-receipt/${debtor.id}`;
    window.open(statementUrl, '_blank');
  };

  // Generate receipt download link for PDF (for single receipt)
  const generateReceiptDownloadLink = (saleId: number): string => {
    return `${window.location.origin}/api/receipt/${saleId}`;
  };

  // Generate statement download link (for full statement)
  const generateStatementLink = (customerId: number): string => {
    return `${window.location.origin}/api/customer-receipt/${customerId}`;
  };

  // Generate individual sale reminder message with receipt link
  const generateSaleReminderMessage = (debtor: Debtor, sale: Sale): string => {
    const receiptLink = generateReceiptDownloadLink(sale.id);
    
    return `Hello ${debtor.name},

This is a friendly reminder regarding your pending payment for sale #${sale.id} dated ${formatDate(sale.date)}.

Sale Details:
- Invoice #: ${sale.id}
- Date: ${formatDate(sale.date)}
- Amount Due: KES ${formatCurrency(sale.amount)}
- Items: ${sale.items}

Outstanding Balance: KES ${formatCurrency(debtor.balance)}

We kindly request that you settle this outstanding balance at your earliest convenience.

Attached is the receipt.  ${receiptLink}

Best regards,
Swiftmetals`;
  };

  // Generate overall account reminder message (for all outstanding sales)
  const generateAccountReminderMessage = (debtor: Debtor): string => {
    // Generate links for all outstanding sales (single receipts)
    const receiptLinks = debtor.sales.map(sale => 
      `Sale #${sale.id} (${formatDate(sale.date)}): ${generateReceiptDownloadLink(sale.id)}`
    ).join('\n');

    return `Hello ${debtor.name},

Account Statement Summary:
Total Purchases: KES ${formatCurrency(debtor.totalSales)}
Total Paid: KES ${formatCurrency(debtor.paid)}
Outstanding Balance: KES ${formatCurrency(debtor.balance)}

We kindly request that you settle your outstanding balance at your earliest convenience.

Individual Receipts:
${receiptLinks}

Full Account Statement:
${generateStatementLink(debtor.id)}

Best regards,
Swiftmetals`;
  };

  const formatPhoneToKenyaCode = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0 and length is 10 (local format), convert to 254
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '254' + cleaned.slice(1);
    }
    
    // If already starts with 254, return as is
    if (cleaned.startsWith('254')) {
      return cleaned;
    }
    
    // If starts with +254, remove the +
    if (phone.startsWith('+254')) {
      return cleaned;
    }
    
    // Otherwise assume it needs 254 prefix
    return '254' + cleaned;
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

  // Send email with receipt links
  const sendEmailMessage = (debtor: Debtor) => {
    const subject = encodeURIComponent(`Payment Reminder - ${debtor.name} - Swiftmetals`);
    const body = encodeURIComponent(generateAccountReminderMessage(debtor));
    const emailUrl = `mailto:${debtor.email}?subject=${subject}&body=${body}`;
    window.location.href = emailUrl;
  };

  const formatCurrency = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 gap-4 md:flex-row md:items-center md:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 flex items-center gap-2 md:gap-3">
              <div className="bg-amber-600 p-2 md:p-3 rounded-lg">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              Accounts Receivable
            </h1>
            <p className="text-gray-600 text-xs md:text-sm lg:text-base mt-1 md:mt-2">Manage customers and debtors</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative flex-1 md:flex-none md:w-64 lg:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search by name, phone, email, items..."
                className="pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            <button
              onClick={() => openModal()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 md:px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Debtor
            </button>
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                Showing {filteredDebtors.length} of {debtors.length} debtors
                {searchQuery && (
                  <span className="ml-2">
                    for "<span className="font-semibold">{searchQuery}</span>"
                  </span>
                )}
              </p>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear search
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {debtors.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-amber-600">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Customers</p>
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">{filteredDebtors.length}</p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-orange-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Total Sales</p>
                  <p className="text-sm md:text-base font-bold text-orange-600 break-all">
                    KES {formatCurrency(filteredDebtors.reduce((sum, d) => sum + d.totalSales, 0))}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-6 shadow-md border-l-4 border-red-500">
                  <p className="text-gray-600 text-xs md:text-sm font-medium mb-1 md:mb-2">Outstanding</p>
                  <p className="text-sm md:text-base font-bold text-red-600 break-all">
                    KES {formatCurrency(filteredDebtors.reduce((sum, d) => sum + d.balance, 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Sortable Header - Desktop */}
            {debtors.length > 0 && (
              <div className="hidden lg:grid grid-cols-12 gap-4 mb-3 px-4">
                <div className="col-span-4">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 group"
                  >
                    Customer Details
                    <SortIcon sortKey="name" />
                  </button>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => handleSort('totalSales')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 group"
                  >
                    Total Sales
                    <SortIcon sortKey="totalSales" />
                  </button>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => handleSort('paid')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 group"
                  >
                    Amount Paid
                    <SortIcon sortKey="paid" />
                  </button>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => handleSort('balance')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 group"
                  >
                    Balance
                    <SortIcon sortKey="balance" />
                  </button>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-xs font-semibold text-gray-700">Actions</span>
                </div>
              </div>
            )}

            {/* Debtors List */}
            <div className="space-y-2">
              {filteredDebtors.length === 0 ? (
                <div className="bg-white rounded-lg p-8 md:p-12 text-center shadow-sm">
                  <Users className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-gray-300" />
                  <p className="text-gray-500 text-sm md:text-lg">
                    {searchQuery ? 
                      `No debtors found for "${searchQuery}". Try a different search term.` : 
                      "No debtors yet. Add one to get started."
                    }
                  </p>
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                filteredDebtors.map((debtor) => (
                  <div key={debtor.id} className="bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden transition-all border border-gray-100">
                    <div
                      onClick={() => setExpandedId(expandedId === debtor.id ? null : debtor.id)}
                      className="p-3 md:p-4 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Name & Contact */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm md:text-base font-bold text-gray-900 truncate">{debtor.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                            {debtor.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {debtor.phone}
                              </span>
                            )}
                            {debtor.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{debtor.email}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Center: Stats Grid */}
                        <div className="hidden lg:grid grid-cols-3 gap-4 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Sales</p>
                            <p className="text-sm font-bold text-blue-600">KES {formatCurrency(debtor.totalSales)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Paid</p>
                            <p className="text-sm font-bold text-green-600">KES {formatCurrency(debtor.paid)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Rate</p>
                            <p className="text-sm font-bold text-purple-600">
                              {debtor.totalSales > 0 ? Math.round((debtor.paid / debtor.totalSales) * 100) : 0}%
                            </p>
                          </div>
                        </div>

                        {/* Right: Balance & Actions */}
                        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Balance</p>
                            <p className="text-sm md:text-base font-bold text-red-600 whitespace-nowrap">
                              KES {formatCurrency(debtor.balance)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadStatement(debtor);
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                              title="Download Full Statement"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal(debtor);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(debtor.id);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition">
                              {expandedId === debtor.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Stats - Show only on small screens */}
                      <div className="grid grid-cols-3 gap-2 mt-3 lg:hidden">
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-xs text-gray-600 mb-1">Sales</p>
                          <p className="text-xs font-bold text-blue-600">KES {formatCurrency(debtor.totalSales)}</p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                          <p className="text-xs text-gray-600 mb-1">Paid</p>
                          <p className="text-xs font-bold text-green-600">KES {formatCurrency(debtor.paid)}</p>
                        </div>
                        <div className="bg-purple-50 rounded p-2">
                          <p className="text-xs text-gray-600 mb-1">Rate</p>
                          <p className="text-xs font-bold text-purple-600">
                            {debtor.totalSales > 0 ? Math.round((debtor.paid / debtor.totalSales) * 100) : 0}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === debtor.id && (
                      <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3 border-t border-gray-200 bg-gray-50">
                        {/* Download Full Statement Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDownloadStatement(debtor)}
                            className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-lg transition-all flex items-center gap-1.5 text-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Full Statement (PDF)
                          </button>
                        </div>

                        {/* Sales History */}
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-600" />
                            Sales History
                          </h4>
                          {debtor.sales.length > 0 ? (
                            <div className="space-y-1.5">
                              {debtor.sales.map((sale) => (
                                <div key={sale.id} className="bg-white rounded p-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-gray-900 text-xs">#{sale.id}</p>
                                      <span className="text-xs text-gray-400">•</span>
                                      <p className="text-xs text-gray-500">{formatDate(sale.date)}</p>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-0.5 truncate">{sale.items}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <p className="font-bold text-gray-900 text-xs whitespace-nowrap">KES {formatCurrency(sale.amount)}</p>
                                    <button
                                      onClick={() => handleDownloadReceipt(sale.id)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                      title="Download Single Receipt"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-xs py-2">No sales recorded</p>
                          )}
                        </div>

                        {/* Payment History */}
                        {debtor.payments.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <Send className="w-4 h-4 text-green-600" />
                              Payment History
                            </h4>
                            <div className="space-y-1.5">
                              {debtor.payments.map((payment, idx) => (
                                <div key={idx} className="bg-white rounded p-2.5 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-xs">{payment.method}</p>
                                    <span className="text-xs text-gray-400">•</span>
                                    <p className="text-xs text-gray-500">{formatDate(payment.date)}</p>
                                  </div>
                                  <p className="font-bold text-green-600 text-xs whitespace-nowrap">KES {formatCurrency(payment.amount)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {debtor.balance > 0 && (
                          <div className="pt-2 border-t border-gray-200 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                onClick={() => sendWhatsAppMessage(debtor.phone, generateAccountReminderMessage(debtor))}
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp (Summary)
                              </button>
                              <button
                                onClick={() => sendSMSMessage(debtor.phone, generateAccountReminderMessage(debtor))}
                                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                SMS (Summary)
                              </button>
                            </div>
                            
                            {debtor.email && (
                              <button
                                onClick={() => sendEmailMessage(debtor)}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Email with Receipt Links
                              </button>
                            )}
                            
                            <div className="text-xs text-gray-500 mt-2">
                              <p className="font-medium mb-1">Document Options:</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                <li><strong>Single Receipt</strong>: Download individual receipt for each sale (opens receipt API)</li>
                                <li><strong>Full Statement</strong>: Download complete account statement with all purchases (opens customer statement API)</li>
                                <li><strong>Messages</strong>: Include both individual receipt links and full statement link</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Info Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Manage Debtors
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-600 text-sm">
                Debtors are automatically managed through the <strong>Sales section</strong>. 
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>To add a debtor:</strong> Create a new sale for a customer with any payment status other than fully paid.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>To remove a debtor:</strong> Delete all their associated sales or mark them as fully paid.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Document Download:</strong>
                  <ul className="mt-1 ml-2">
                    <li>• Single Receipt: Opens receipt API</li>
                    <li>• Full Statement: Opens customer statement API</li>
                  </ul>
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium"
              >
                Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}