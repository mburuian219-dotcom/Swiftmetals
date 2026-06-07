"use client";
import { useState, useEffect } from "react";
import { Download, Calendar, TrendingUp, DollarSign, PieChart, BarChart, Filter, X, Eye, EyeOff, Smartphone, ChevronDown, ChevronUp, Printer, FileText, CreditCard } from "lucide-react";

type SaleItem = {
  id: number;
  quantity: number;
  price: number;
  total: number;
  productId: number;
  product?: {
    id: number;
    name: string;
    productionCost: number | null;
    price: number;
  };
};

type Payment = {
  id: number;
  amount: number;
  method: string;
  paidAt: string;
  status: string;
};

type Sale = {
  id: number;
  date: string;
  createdAt: string;
  amount: number;
  status: string;
  dueDate: string | null;
  totalPaid?: number;
  balance?: number;
  saleitem: SaleItem[];
  payment?: Payment[];
  customer?: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
  };
  isDeleted?: boolean;
  createdBy?: string;
  updatedBy?: string;
};

type GroupedSale = {
  saleId: number;
  date: string;
  createdAt: string;
  customerName: string;
  customerId: number;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  status: string;
  dueDate: string | null;
  items: SalesIncomeReport[];
  payments: Payment[];
  createdBy?: string;
  updatedBy?: string;
};

type SalesIncomeReport = {
  date: string;
  createdAt: string;
  saleId: number;
  customerName: string;
  customerId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  unitProductionCost: number;
  totalProductionCost: number;
  grossProfit: number;
  profitMargin: number;
  saleStatus: string;
};

type PeriodFilter = "all" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
type ViewMode = "table" | "cards" | "grouped";

export default function SalesIncomeReport() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<GroupedSale[]>([]);
  const [allSales, setAllSales] = useState<GroupedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [showAllData, setShowAllData] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [expandedSale, setExpandedSale] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProductionCost: 0,
    totalGrossProfit: 0,
    averageProfitMargin: 0,
    totalSales: 0,
    totalPaid: 0,
    totalBalance: 0,
  });

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setViewMode("cards");
      } else {
        setViewMode("grouped");
      }
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Initialize date range to show all data
  useEffect(() => {
    if (periodFilter === "all") {
      setDateRange({
        startDate: "",
        endDate: "",
      });
    }
  }, [periodFilter]);

  // Fetch sales data
  useEffect(() => {
    fetchSalesData();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    if (sales.length > 0) {
      applyFilters();
    }
  }, [sales, periodFilter, dateRange, showAllData]);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo("Fetching sales data...");
      
      // Fetch all sales - no filters to get everything
      const response = await fetch("/api/sales");
      if (!response.ok) throw new Error("Failed to fetch sales");
      const salesData = await response.json();
      
      // Ensure we're working with an array
      const salesArray = Array.isArray(salesData) ? salesData : [];
      
      setDebugInfo(prev => prev + `\nReceived ${salesArray.length} sales from API`);
      
      // Log sales by status
      const statusCount: Record<string, number> = {};
      const deletedCount = salesArray.filter((s: any) => s.isDeleted === true).length;
      const activeSales = salesArray.filter((s: any) => s.isDeleted !== true);
      
      salesArray.forEach((sale: any) => {
        statusCount[sale.status] = (statusCount[sale.status] || 0) + 1;
      });
      
      setDebugInfo(prev => prev + `\nActive sales: ${activeSales.length}, Deleted: ${deletedCount}`);
      setDebugInfo(prev => prev + `\nSales by status: ${JSON.stringify(statusCount)}`);
      
      // Fetch products for production costs
      const productsResponse = await fetch("/api/products");
      const productsData = await productsResponse.ok ? await productsResponse.json() : [];
      
      setDebugInfo(prev => prev + `\nProducts loaded: ${productsData.length}`);
      
      const productCostMap = new Map<number, number>();
      productsData.forEach((product: any) => {
        const prodCost = product.productionCost || product.costPrice || 0;
        productCostMap.set(product.id, prodCost);
      });
      
      // Process ALL sales (including PAID ones) - don't filter by status
      const enrichedSales = salesArray.map((sale: any) => {
        const totalPaid = sale.payment?.reduce((sum: number, p: any) => 
          (p.status === "CLEARED" || p.status === "COMPLETED") ? sum + p.amount : sum, 0) || 0;
        const balance = sale.amount - totalPaid;
        const enrichedItems = (sale.saleitem || []).map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            productionCost: productCostMap.get(item.productId) || item.product?.productionCost || 0
          }
        }));
        
        return {
          ...sale,
          saleitem: enrichedItems,
          payment: sale.payment || [],
          totalPaid,
          balance,
        };
      });
      
      setSales(enrichedSales);
      setDebugInfo(prev => prev + `\nEnriched sales: ${enrichedSales.length}`);
      
      const allGroupedSales = processSalesToGroupedReports(enrichedSales);
      setAllSales(allGroupedSales);
      setDebugInfo(prev => prev + `\nGrouped sales: ${allGroupedSales.length}`);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      setDebugInfo(prev => prev + `\nERROR: ${errorMsg}`);
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const processSalesToGroupedReports = (salesData: Sale[]): GroupedSale[] => {
    const groupedMap = new Map<number, GroupedSale>();
    
    salesData.forEach(sale => {
      // Include ALL sales regardless of status - show everything
      const reports: SalesIncomeReport[] = [];
      let saleTotalRevenue = 0;
      let saleTotalCost = 0;
      let saleGrossProfit = 0;
      
      (sale.saleitem || []).forEach((item: SaleItem) => {
        const unitProductionCost = item.product?.productionCost || 0;
        const totalProductionCost = unitProductionCost * item.quantity;
        const totalRevenue = item.quantity * item.price;
        const grossProfit = totalRevenue - totalProductionCost;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        
        reports.push({
          date: sale.date,
          createdAt: sale.createdAt || sale.date,
          saleId: sale.id,
          customerName: sale.customer?.name || "Walk-in Customer",
          customerId: sale.customer?.id || 0,
          productId: item.productId,
          productName: item.product?.name || "Unknown Product",
          quantity: item.quantity,
          unitPrice: item.price,
          totalRevenue,
          unitProductionCost,
          totalProductionCost,
          grossProfit,
          profitMargin,
          saleStatus: sale.status,
        });
        
        saleTotalRevenue += totalRevenue;
        saleTotalCost += totalProductionCost;
        saleGrossProfit += grossProfit;
      });
      
      groupedMap.set(sale.id, {
        saleId: sale.id,
        date: sale.date,
        createdAt: sale.createdAt || sale.date,
        customerName: sale.customer?.name || "Walk-in Customer",
        customerId: sale.customer?.id || 0,
        totalAmount: sale.amount,
        totalPaid: sale.totalPaid || 0,
        balance: sale.balance || sale.amount,
        status: sale.status,
        dueDate: sale.dueDate || null,
        items: reports,
        payments: sale.payment || [],
        createdBy: sale.createdBy,
        updatedBy: sale.updatedBy,
      });
    });
    
    // Sort by date descending (newest first)
    return Array.from(groupedMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const applyFilters = () => {
    let filtered = [...sales];
    
    if (!showAllData) {
      if (dateRange.startDate && dateRange.endDate) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate >= start && saleDate <= end;
        });
      } else {
        switch (periodFilter) {
          case "daily":
            const today = new Date();
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.date);
              return saleDate.toDateString() === today.toDateString();
            });
            break;
            
          case "weekly":
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.date);
              return saleDate >= oneWeekAgo;
            });
            break;
            
          case "monthly":
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.date);
              return saleDate >= oneMonthAgo;
            });
            break;
            
          case "yearly":
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            filtered = filtered.filter(sale => {
              const saleDate = new Date(sale.date);
              return saleDate >= oneYearAgo;
            });
            break;
            
          case "all":
          default:
            break;
        }
      }
    }
    
    const groupedReports = processSalesToGroupedReports(filtered);
    setFilteredSales(groupedReports);
    calculateSummary(groupedReports);
  };

  const calculateSummary = (reports: GroupedSale[]) => {
    let totalRevenue = 0;
    let totalProductionCost = 0;
    let totalGrossProfit = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalProfitMarginSum = 0;
    let itemCount = 0;
    
    reports.forEach(sale => {
      totalRevenue += sale.totalAmount;
      totalPaid += sale.totalPaid;
      totalBalance += sale.balance;
      
      sale.items.forEach(item => {
        totalProductionCost += item.totalProductionCost;
        totalGrossProfit += item.grossProfit;
        totalProfitMarginSum += item.profitMargin;
        itemCount++;
      });
    });
    
    setSummary({
      totalRevenue,
      totalProductionCost,
      totalGrossProfit,
      averageProfitMargin: itemCount > 0 ? totalProfitMarginSum / itemCount : 0,
      totalSales: reports.length,
      totalPaid,
      totalBalance,
    });
  };

  const downloadCSV = () => {
    const dataToDownload = showAllData ? allSales : filteredSales;
    
    if (dataToDownload.length === 0) {
      alert("No data to download");
      return;
    }
    
    const headers = [
      "Date",
      "Time",
      "Sale ID",
      "Customer",
      "Product Name",
      "Quantity",
      "Unit Price",
      "Total Revenue",
      "Production Cost",
      "Gross Profit",
      "Profit Margin %",
      "Sale Status",
      "Total Sale Amount",
      "Amount Paid",
      "Balance",
      "Created By",
      "Updated By"
    ];
    
    const csvData: string[][] = [];
    
    dataToDownload.forEach(sale => {
      sale.items.forEach(item => {
        csvData.push([
          formatDate(item.date),
          formatTime(item.createdAt),
          item.saleId.toString(),
          `"${item.customerName.replace(/"/g, '""')}"`,
          `"${item.productName.replace(/"/g, '""')}"`,
          item.quantity.toString(),
          formatCurrency(item.unitPrice, false),
          formatCurrency(item.totalRevenue, false),
          formatCurrency(item.totalProductionCost, false),
          formatCurrency(item.grossProfit, false),
          item.profitMargin.toFixed(1),
          item.saleStatus,
          formatCurrency(sale.totalAmount, false),
          formatCurrency(sale.totalPaid, false),
          formatCurrency(sale.balance, false),
          sale.createdBy || "System",
          sale.updatedBy || "System"
        ]);
      });
    });
    
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    let periodName: string;
    if (periodFilter === "custom" && dateRange.startDate && dateRange.endDate) {
      periodName = `custom-${dateRange.startDate}-to-${dateRange.endDate}`;
    } else {
      periodName = periodFilter;
    }
    
    link.download = `sales-income-report-${periodName}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number, includeSymbol: boolean = true) => {
    const formatted = Number(amount || 0).toFixed(2);
    return includeSymbol ? `KES ${formatted.toLocaleString()}` : formatted.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resetFilters = () => {
    setDateRange({
      startDate: "",
      endDate: "",
    });
    setPeriodFilter("all");
    setShowAllData(true);
    setShowFilters(false);
  };

  const toggleAllData = () => {
    setShowAllData(!showAllData);
    if (!showAllData) {
      setPeriodFilter("all");
    }
  };

  const toggleViewMode = () => {
    const modes: ViewMode[] = ["grouped", "table", "cards"];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      "PAID": { color: "bg-green-100 text-green-800", label: "Paid" },
      "UNPAID": { color: "bg-red-100 text-red-800", label: "Unpaid" },
      "PARTIAL": { color: "bg-yellow-100 text-yellow-800", label: "Partial" },
      "CANCELLED": { color: "bg-gray-100 text-gray-800", label: "Cancelled" },
    };
    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
  };

  const displayData = showAllData ? allSales : filteredSales;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6 border-2 border-blue-200 print:shadow-none print:border-0">
      {/* Debug Info - Remove in production */}
      {debugInfo && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 print:hidden">
          <details>
            <summary className="font-semibold cursor-pointer">Debug Info ({allSales.length} sales)</summary>
            <pre className="mt-2 whitespace-pre-wrap">{debugInfo}</pre>
          </details>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 print:mb-4">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-blue-100 p-1.5 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                Sales Income Report
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 pl-9">
              Gross Profit = (Selling Price - Production Cost) × Quantity
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex gap-2">
              <button
                onClick={toggleViewMode}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center justify-center print:hidden"
                title="Toggle View"
              >
                {viewMode === "grouped" && <FileText className="w-4 h-4 text-gray-700" />}
                {viewMode === "table" && <PieChart className="w-4 h-4 text-gray-700" />}
                {viewMode === "cards" && <Smartphone className="w-4 h-4 text-gray-700" />}
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition print:hidden"
              >
                <Filter className="w-4 h-4 text-blue-600" />
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={toggleAllData}
                className={`px-3 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm print:hidden ${
                  showAllData 
                    ? "bg-green-500 hover:bg-green-600 text-white" 
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {showAllData ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">All Data</span>
                    <span className="sm:hidden">All</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Filtered</span>
                    <span className="sm:hidden">Filtered</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handlePrint}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 text-sm print:hidden"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
              
              <button
                onClick={downloadCSV}
                disabled={displayData.length === 0}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download CSV</span>
                <span className="sm:hidden">Download</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 mb-4 sm:mb-6 print:grid-cols-7 print:gap-2">
        <div className="bg-blue-50 rounded-lg p-2 sm:p-3 border border-blue-200">
          <p className="text-xs text-gray-600 mb-1">Revenue</p>
          <p className="text-sm sm:text-base font-bold text-blue-600 truncate">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-2 sm:p-3 border border-orange-200">
          <p className="text-xs text-gray-600 mb-1">Prod. Cost</p>
          <p className="text-sm sm:text-base font-bold text-orange-600 truncate">
            {formatCurrency(summary.totalProductionCost)}
          </p>
        </div>
        
        <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-200">
          <p className="text-xs text-gray-600 mb-1">Gross Profit</p>
          <p className="text-sm sm:text-base font-bold text-green-600 truncate">
            {formatCurrency(summary.totalGrossProfit)}
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-2 sm:p-3 border border-purple-200">
          <p className="text-xs text-gray-600 mb-1">Margin</p>
          <p className="text-sm sm:text-base font-bold text-purple-600">
            {summary.averageProfitMargin.toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-amber-50 rounded-lg p-2 sm:p-3 border border-amber-200">
          <p className="text-xs text-gray-600 mb-1">Sales</p>
          <p className="text-sm sm:text-base font-bold text-amber-600">
            {summary.totalSales}
          </p>
        </div>
        
        <div className="bg-indigo-50 rounded-lg p-2 sm:p-3 border border-indigo-200">
          <p className="text-xs text-gray-600 mb-1">Paid</p>
          <p className="text-sm sm:text-base font-bold text-indigo-600 truncate">
            {formatCurrency(summary.totalPaid)}
          </p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-2 sm:p-3 border border-red-200">
          <p className="text-xs text-gray-600 mb-1">Balance</p>
          <p className="text-sm sm:text-base font-bold text-red-600 truncate">
            {formatCurrency(summary.totalBalance)}
          </p>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showFilters && (
        <div className="sm:hidden mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Filters</h4>
            <button onClick={() => setShowFilters(false)} className="text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Period Filter</p>
            <div className="grid grid-cols-3 gap-2">
              {(["all", "daily", "weekly", "monthly", "yearly", "custom"] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setPeriodFilter(period);
                    if (period === "all") setShowAllData(true);
                    if (period !== "custom") setShowFilters(false);
                  }}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                    periodFilter === period
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300"
                  }`}
                >
                  {period === "all" ? "All" : period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {periodFilter === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
          
          <button
            onClick={resetFilters}
            className="w-full mt-3 px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition text-sm"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Desktop Filters */}
      {!showAllData && (
        <div className="hidden sm:block bg-gray-50 rounded-lg p-4 mb-6 print:hidden">
          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "daily", "weekly", "monthly", "yearly", "custom"] as PeriodFilter[]).map((period) => (
              <button
                key={period}
                onClick={() => setPeriodFilter(period)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  periodFilter === period
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300"
                }`}
              >
                {period === "all" ? "All Time" : period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {periodFilter === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}
          
          {(dateRange.startDate || dateRange.endDate) && (
            <button onClick={resetFilters} className="mt-4 text-sm text-red-600 hover:text-red-800">
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Results Info */}
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {displayData.length} sales • {displayData.reduce((sum, s) => sum + s.items.length, 0)} items
        </p>
        {!showAllData && periodFilter !== "all" && (
          <p className="text-xs text-blue-600">
            Filtered: {periodFilter}
          </p>
        )}
      </div>

      {/* Data Display */}
      {displayData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <PieChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No sales data found.</p>
          {debugInfo && (
            <p className="text-xs text-gray-400 mt-2">Check debug info above for details</p>
          )}
        </div>
      ) : viewMode === "grouped" ? (
        // Grouped View
        <div className="space-y-4 print:space-y-2">
          {displayData.map((sale) => (
            <div key={sale.saleId} className="border border-gray-200 rounded-lg overflow-hidden print:border-2">
              {/* Sale Header */}
              <div 
                className="bg-gray-50 p-3 sm:p-4 cursor-pointer hover:bg-gray-100 transition print:cursor-default"
                onClick={() => setExpandedSale(expandedSale === sale.saleId ? null : sale.saleId)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">#{sale.saleId}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">{formatDateTime(sale.date)}</span>
                      {getStatusBadge(sale.status)}
                    </div>
                    <p className="font-medium text-gray-800 mt-1">{sale.customerName}</p>
                    {sale.dueDate && sale.status !== "PAID" && (
                      <p className="text-xs text-orange-600 mt-1">Due: {formatDate(sale.dueDate)}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                      {sale.createdBy && <span>Created: {sale.createdBy}</span>}
                      {sale.updatedBy && sale.updatedBy !== sale.createdBy && (
                        <span>Updated: {sale.updatedBy}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(sale.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(sale.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className={`text-sm font-semibold ${sale.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(sale.balance)}
                      </p>
                    </div>
                  </div>
                  
                  <button className="text-gray-400 print:hidden">
                    {expandedSale === sale.saleId ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {/* Sale Items */}
              {(expandedSale === sale.saleId || viewMode === "grouped") && (
                <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Products Sold</h4>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-right">Cost</th>
                          <th className="px-3 py-2 text-right">Profit</th>
                          <th className="px-3 py-2 text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sale.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{item.productName}</td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.totalRevenue)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(item.totalProductionCost)}</td>
                            <td className={`px-3 py-2 text-right font-medium ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(item.grossProfit)}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${item.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.profitMargin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right">Totals:</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(sale.totalAmount)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(sale.items.reduce((sum, i) => sum + i.totalProductionCost, 0))}</td>
                          <td className="px-3 py-2 text-right text-green-600">{formatCurrency(sale.items.reduce((sum, i) => sum + i.grossProfit, 0))}</td>
                          <td className="px-3 py-2 text-right"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-2">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Quantity</p>
                            <p className="font-medium">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Unit Price</p>
                            <p className="font-medium">{formatCurrency(item.unitPrice)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-medium">{formatCurrency(item.totalRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Profit</p>
                            <p className={`font-medium ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(item.grossProfit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Payment Info */}
                  {sale.payments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Payment History
                      </h4>
                      <div className="space-y-1">
                        {sale.payments.map((payment, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{formatDateTime(payment.paidAt)}</span>
                            <span>{payment.method}</span>
                            <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === "table" ? (
        // Flat Table View
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Sale ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Revenue</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cost</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Profit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Margin</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.flatMap(sale => sale.items).slice(0, 100).map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-900">{formatDate(item.date)}</td>
                  <td className="px-3 py-2 text-xs text-gray-900">#{item.saleId}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 truncate max-w-[100px]">{item.customerName}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 truncate max-w-[100px]">{item.productName}</td>
                  <td className="px-3 py-2 text-xs text-gray-900 text-center">{item.quantity}</td>
                  <td className="px-3 py-2 text-xs text-right">{formatCurrency(item.totalRevenue)}</td>
                  <td className="px-3 py-2 text-xs text-right">{formatCurrency(item.totalProductionCost)}</td>
                  <td className={`px-3 py-2 text-xs text-right font-medium ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.grossProfit)}
                  </td>
                  <td className={`px-3 py-2 text-xs text-right font-medium ${item.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayData.flatMap(s => s.items).length > 100 && (
            <div className="bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
              Showing 100 of {displayData.flatMap(s => s.items).length} items. Download CSV for complete data.
            </div>
          )}
        </div>
      ) : (
        // Card View
        <div className="space-y-3">
          {displayData.slice(0, 20).map((sale) => (
            <div key={sale.saleId} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">#{sale.saleId}</span>
                    {getStatusBadge(sale.status)}
                  </div>
                  <p className="text-sm font-semibold mt-1">{sale.customerName}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-sm font-bold">{formatCurrency(sale.totalAmount)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Products</p>
                  <p className="text-sm font-medium">{sale.items.length} items</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Paid</p>
                  <p className="text-sm font-medium text-green-600">{formatCurrency(sale.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className={`text-sm font-medium ${sale.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(sale.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profit</p>
                  <p className="text-sm font-medium text-green-600">
                    {formatCurrency(sale.items.reduce((sum, i) => sum + i.grossProfit, 0))}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {displayData.length > 20 && (
            <div className="text-center text-sm text-gray-500 py-2">
              Showing 20 of {displayData.length} sales. Download CSV for complete data.
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 print:block">
        Generated on {formatDateTime(new Date().toISOString())}
      </div>
    </div>
  );
}