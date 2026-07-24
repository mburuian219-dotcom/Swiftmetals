import { Users, Mail, Phone, Send, FileText, Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Loader, MessageCircle, Download, Search, Filter, UserCheck, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

type Sale = {
  id: number;
  date: string;
  items: string;
  amount: number;
  status?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
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
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  createdBy?: string;
  createdAt?: string;
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
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [showStaffFilterDropdown, setShowStaffFilterDropdown] = useState(false);
  const [uniqueStaffMembers, setUniqueStaffMembers] = useState<string[]>([]);
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

  // Extract unique staff members from debtors
  useEffect(() => {
    const staffSet = new Set<string>();
    debtors.forEach(debtor => {
      if (debtor.createdBy) staffSet.add(debtor.createdBy);
      if (debtor.lastUpdatedBy) staffSet.add(debtor.lastUpdatedBy);
      debtor.sales.forEach(sale => {
        if (sale.createdBy) staffSet.add(sale.createdBy);
        if (sale.updatedBy) staffSet.add(sale.updatedBy);
      });
    });
    setUniqueStaffMembers(Array.from(staffSet).filter(Boolean).sort());
  }, [debtors]);

  // Filter and sort debtors when search query, staff filter, or sort config changes
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
        debtor.totalSales.toString().includes(query) ||
        (debtor.lastUpdatedBy && debtor.lastUpdatedBy.toLowerCase().includes(query)) ||
        (debtor.createdBy && debtor.createdBy.toLowerCase().includes(query))
      );
    }
    
    // Apply staff filter
    if (staffFilter !== "all") {
      result = result.filter(debtor => 
        debtor.createdBy === staffFilter || 
        debtor.lastUpdatedBy === staffFilter ||
        debtor.sales.some(sale => 
          sale.createdBy === staffFilter || 
          sale.updatedBy === staffFilter
        )
      );
    }
    
    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle special cases for dates and undefined values
        if (sortConfig.key === 'lastUpdatedAt') {
          aValue = a.lastUpdatedAt || '';
          bValue = b.lastUpdatedAt || '';
        }
        
        // Handle undefined or null values
        const aVal = aValue !== undefined && aValue !== null ? aValue : '';
        const bVal = bValue !== undefined && bValue !== null ? bValue : '';
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredDebtors(result);
  }, [debtors, searchQuery, staffFilter, sortConfig]);

  const fetchDebtors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100000);
      
      const response = await fetch("/api/sales", { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error("Failed to fetch sales");
      const sales = await response.json();

      const debtorMap = new Map<number, Debtor>();

      sales.forEach((sale: any) => {
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
              lastUpdatedBy: sale.updatedBy || sale.createdBy || "System",
              lastUpdatedAt: sale.updatedAt || sale.createdAt,
              createdBy: sale.createdBy || sale.customer.createdBy || "System",
              createdAt: sale.createdAt || sale.customer.createdAt,
            });
          }

          const debtor = debtorMap.get(customerId)!;
          debtor.totalSales += sale.amount;
          debtor.paid += sale.totalPaid;
          debtor.balance = debtor.totalSales - debtor.paid;

          const saleUpdatedAt = sale.updatedAt || sale.createdAt;
          if (saleUpdatedAt && (!debtor.lastUpdatedAt || new Date(saleUpdatedAt) > new Date(debtor.lastUpdatedAt))) {
            debtor.lastUpdatedBy = sale.updatedBy || sale.createdBy || "System";
            debtor.lastUpdatedAt = saleUpdatedAt;
          }

          const itemsStr = sale.saleitems
            ?.map((item: any) => `${item.product?.name || "Item"} x${item.quantity}`)
            .join(", ") || "Items";

          debtor.sales.push({
            id: sale.id,
            date: sale.date,
            items: itemsStr,
            amount: sale.amount,
            status: sale.status,
            createdBy: sale.createdBy,
            updatedBy: sale.updatedBy,
            createdAt: sale.createdAt,
            updatedAt: sale.updatedAt,
          });

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

  // Function to download debtors as CSV with staff filter support
  const downloadDebtorsCSV = () => {
    if (filteredDebtors.length === 0) {
      alert("No debtors to download.");
      return;
    }

    try {
      const headers = [
        "Customer ID",
        "Customer Name",
        "Phone",
        "Email",
        "Total Sales (KES)",
        "Amount Paid (KES)",
        "Balance (KES)",
        "Payment Rate (%)",
        "Number of Sales",
        "Last Sale Date",
        "Sale Status",
        "Last Payment Date",
        "Created By (Staff)",
        "Created At",
        "Last Updated By (Staff)",
        "Last Updated At",
        "Staff Filter Applied"
      ];

      const rows = filteredDebtors.map(debtor => {
        const lastSale = debtor.sales.length > 0 
          ? new Date(debtor.sales[debtor.sales.length - 1].date).toLocaleDateString()
          : "-";
        
        const lastPayment = debtor.payments.length > 0
          ? new Date(debtor.payments[debtor.payments.length - 1].date).toLocaleDateString()
          : "-";
        
        const paymentRate = debtor.totalSales > 0 
          ? ((debtor.paid / debtor.totalSales) * 100).toFixed(0)
          : "0";
        
        const saleStatus = debtor.balance === debtor.totalSales ? "UNPAID" : "PARTIALLY PAID";
        
        const createdAt = debtor.createdAt ? new Date(debtor.createdAt).toLocaleString() : "-";
        const updatedAt = debtor.lastUpdatedAt ? new Date(debtor.lastUpdatedAt).toLocaleString() : "-";

        return [
          debtor.id,
          `"${debtor.name.replace(/"/g, '""')}"`,
          `"${debtor.phone}"`,
          `"${debtor.email}"`,
          formatCurrencyForCSV(debtor.totalSales),
          formatCurrencyForCSV(debtor.paid),
          formatCurrencyForCSV(debtor.balance),
          paymentRate,
          debtor.sales.length,
          lastSale,
          saleStatus,
          lastPayment,
          debtor.createdBy || "System",
          createdAt,
          debtor.lastUpdatedBy || "System",
          updatedAt,
          staffFilter !== "all" ? staffFilter : "All Staff"
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const date = new Date().toISOString().split('T')[0];
      const staffSuffix = staffFilter !== "all" ? `_${staffFilter.replace(/\s+/g, '_')}` : "";
      link.download = `debtors-report${staffSuffix}_${date}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const staffInfo = staffFilter !== "all" ? ` for staff "${staffFilter}"` : "";
      alert(`Debtors report${staffInfo} downloaded successfully!`);
    } catch (error) {
      console.error("Error generating CSV:", error);
      alert("Failed to generate CSV file. Please try again.");
    }
  };

  const formatCurrencyForCSV = (amount: number) => {
    return Number(amount || 0).toFixed(2);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleStaffFilterChange = (staffName: string) => {
    setStaffFilter(staffName);
    setShowStaffFilterDropdown(false);
  };

  const clearStaffFilter = () => {
    setStaffFilter("all");
    setShowStaffFilterDropdown(false);
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

  const handleDownloadReceipt = (saleId: number) => {
    const receiptUrl = `/api/receipt/${saleId}`;
    window.open(receiptUrl, '_blank');
  };

  const handleDownloadStatement = (debtor: Debtor) => {
    const statementUrl = `/api/customer-receipt/${debtor.id}`;
    window.open(statementUrl, '_blank');
  };

  const generateReceiptDownloadLink = (saleId: number): string => {
    return `${window.location.origin}/api/receipt/${saleId}`;
  };

  const generateStatementLink = (customerId: number): string => {
    return `${window.location.origin}/api/customer-receipt/${customerId}`;
  };

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

View your receipt here: ${receiptLink}

Best regards,
Swiftmetals`;
  };

  const generateAccountReminderMessage = (debtor: Debtor): string => {
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

  const sendEmailMessage = (debtor: Debtor) => {
    const subject = encodeURIComponent(`Payment Reminder - ${debtor.name} - Swiftmetals`);
    const body = encodeURIComponent(generateAccountReminderMessage(debtor));
    const emailUrl = `mailto:${debtor.email}?subject=${subject}&body=${body}`;
    window.location.href = emailUrl;
  };

  const formatCurrency = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
            <div className="relative flex-1 md:flex-none md:w-48 lg:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search debtors..."
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
            
            {/* Staff Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStaffFilterDropdown(!showStaffFilterDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition text-sm w-full sm:w-auto justify-center ${
                  staffFilter !== "all" 
                    ? "bg-amber-100 border-amber-300 text-amber-800" 
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="truncate max-w-[100px]">
                  {staffFilter !== "all" ? staffFilter : "Filter by Staff"}
                </span>
                {staffFilter !== "all" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearStaffFilter();
                    }}
                    className="ml-1 p-0.5 hover:bg-amber-200 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
              
              {showStaffFilterDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <button
                      onClick={clearStaffFilter}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      All Staff
                    </button>
                    {uniqueStaffMembers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No staff members found</div>
                    ) : (
                      uniqueStaffMembers.map(staff => (
                        <button
                          key={staff}
                          onClick={() => handleStaffFilterChange(staff)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition flex items-center gap-2 ${
                            staffFilter === staff ? "bg-amber-50 text-amber-800 font-medium" : ""
                          }`}
                        >
                          <UserCheck className="w-4 h-4" />
                          {staff}
                          {staffFilter === staff && <Check className="w-3 h-3 ml-auto text-amber-600" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* CSV Download Button */}
            <button
              onClick={downloadDebtorsCSV}
              disabled={filteredDebtors.length === 0}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-4 md:px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              title={filteredDebtors.length === 0 ? "No debtors to download" : `Download CSV report${staffFilter !== "all" ? ` for ${staffFilter}` : ""}`}
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" /> 
              Download CSV{staffFilter !== "all" ? " (Filtered)" : ""}
            </button>
            
            <button
              onClick={() => openModal()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 md:px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2 shadow-lg hover:shadow-xl text-sm md:text-base w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> Add Debtor
            </button>
          </div>
        </div>

        {/* Search Results Info */}
        {(searchQuery || staffFilter !== "all") && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-blue-800">
                Showing {filteredDebtors.length} of {debtors.length} debtors
                {searchQuery && (
                  <span className="ml-2">
                    for "<span className="font-semibold">{searchQuery}</span>"
                  </span>
                )}
                {staffFilter !== "all" && (
                  <span className="ml-2">
                    • Staff: <span className="font-semibold">{staffFilter}</span>
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {staffFilter !== "all" && (
                  <button
                    onClick={clearStaffFilter}
                    className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear staff filter
                  </button>
                )}
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
                <div className="col-span-3">
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
                <div className="col-span-2">
                  <button
                    onClick={() => handleSort('lastUpdatedBy')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 group"
                  >
                    Last Updated By
                    <SortIcon sortKey="lastUpdatedBy" />
                  </button>
                </div>
                <div className="col-span-1 text-right">
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
                    {searchQuery || staffFilter !== "all" ? 
                      `No debtors found matching your filters.` : 
                      "No debtors yet. Add one to get started."
                    }
                  </p>
                  {(searchQuery || staffFilter !== "all") && (
                    <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                      {staffFilter !== "all" && (
                        <button
                          onClick={clearStaffFilter}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
                        >
                          Clear Staff Filter
                        </button>
                      )}
                      {searchQuery && (
                        <button
                          onClick={clearSearch}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
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
                            {debtor.createdBy && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <UserCheck className="w-3 h-3" />
                                {debtor.createdBy}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Center: Stats Grid */}
                        <div className="hidden lg:grid grid-cols-4 gap-4 flex-shrink-0">
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
                          <div className="text-left">
                            <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                            <p className="text-xs font-medium text-gray-700 truncate" title={`${debtor.lastUpdatedBy} at ${formatDateTime(debtor.lastUpdatedAt)}`}>
                              {debtor.lastUpdatedBy}
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

                      {/* Mobile Stats */}
                      <div className="grid grid-cols-4 gap-2 mt-3 lg:hidden">
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
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600 mb-1">Updated</p>
                          <p className="text-xs font-bold text-gray-700 truncate">{debtor.lastUpdatedBy}</p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === debtor.id && (
                      <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3 border-t border-gray-200 bg-gray-50">
                        {/* Last Updated Info */}
                        <div className="bg-gray-100 rounded-lg p-2.5 flex flex-col sm:flex-row justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600">Created:</span>
                            <span className="text-gray-700">{debtor.createdBy || "System"}</span>
                            <span className="text-gray-400">{formatDateTime(debtor.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-600">Last Updated:</span>
                            <span className="text-gray-700">{debtor.lastUpdatedBy || "System"}</span>
                            <span className="text-gray-400">{formatDateTime(debtor.lastUpdatedAt)}</span>
                          </div>
                        </div>

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
                            Sales History ({debtor.sales.length} sales)
                          </h4>
                          {debtor.sales.length > 0 ? (
                            <div className="space-y-1.5 max-h-60 overflow-y-auto">
                              {debtor.sales.map((sale) => (
                                <div key={sale.id} className="bg-white rounded p-2.5 transition hover:bg-gray-50">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-gray-900 text-xs">#{sale.id}</p>
                                        <span className="text-xs text-gray-400">•</span>
                                        <p className="text-xs text-gray-500">{formatDate(sale.date)}</p>
                                        {sale.status && (
                                          <>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                              sale.status === "UNPAID" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                                            }`}>
                                              {sale.status}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-600 mt-0.5 truncate">{sale.items}</p>
                                      <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-gray-400">
                                        {sale.createdBy && <span>Created: {sale.createdBy}</span>}
                                        {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                                          <span>Updated: {sale.updatedBy}</span>
                                        )}
                                      </div>
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
                              Payment History ({debtor.payments.length} payments)
                            </h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
                                <li><strong>Single Receipt</strong>: Download individual receipt for each sale</li>
                                <li><strong>Full Statement</strong>: Download complete account statement with all purchases</li>
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
                    <li>• CSV Export: Download all debtors as spreadsheet with audit trail</li>
                  </ul>
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  <strong>Staff Filter:</strong>
                  <ul className="mt-1 ml-2">
                    <li>• Filter debtors by the staff member who created them</li>
                    <li>• Filter debtors by the staff member who last updated them</li>
                    <li>• CSV download includes staff filter information</li>
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