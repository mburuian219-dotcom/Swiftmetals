"use client";
import { useState, useEffect } from "react";
import { Download, Calendar, TrendingUp, DollarSign, PieChart, BarChart, Filter, X, Eye, EyeOff, Smartphone, ChevronDown, ChevronUp } from "lucide-react";

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

type Sale = {
  id: number;
  date: string;
  amount: number;
  status: string;
  saleitem: SaleItem[];
  totalPaid?: number;
  customer?: {
    name: string;
  };
};

type SalesIncomeReport = {
  date: string;
  saleId: number;
  customerName: string;
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
type ViewMode = "table" | "cards"; // Added card view for mobile

export default function SalesIncomeReport() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<SalesIncomeReport[]>([]);
  const [allSales, setAllSales] = useState<SalesIncomeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [showAllData, setShowAllData] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("table"); // Default to table
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false); // For mobile filter drawer
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
  });

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setViewMode("cards"); // Default to cards on mobile
      } else {
        setViewMode("table"); // Default to table on desktop
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
      
      const response = await fetch("/api/sales");
      if (!response.ok) throw new Error("Failed to fetch sales");
      const salesData = await response.json();
      
      const productsResponse = await fetch("/api/products");
      const productsData = await productsResponse.ok ? await productsResponse.json() : [];
      
      const productCostMap = new Map<number, number>();
      productsData.forEach((product: any) => {
        if (product.productionCost) {
          productCostMap.set(product.id, product.productionCost);
        }
      });
      
      const enrichedSales = salesData.map((sale: any) => ({
        ...sale,
        saleitem: sale.saleitem?.map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            productionCost: productCostMap.get(item.productId) || item.product?.productionCost || 0
          }
        })) || []
      }));
      
      setSales(enrichedSales);
      const allReports = processSalesToReports(enrichedSales);
      setAllSales(allReports);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const processSalesToReports = (salesData: Sale[]): SalesIncomeReport[] => {
    const reports: SalesIncomeReport[] = [];
    
    salesData.forEach(sale => {
      sale.saleitem.forEach((item: SaleItem) => {
        const unitProductionCost = item.product?.productionCost || 0;
        const totalProductionCost = unitProductionCost * item.quantity;
        const totalRevenue = item.quantity * item.price;
        const grossProfit = totalRevenue - totalProductionCost;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        
        reports.push({
          date: sale.date,
          saleId: sale.id,
          customerName: sale.customer?.name || "Unknown",
          productId: item.productId,
          productName: item.product?.name || "Product",
          quantity: item.quantity,
          unitPrice: item.price,
          totalRevenue,
          unitProductionCost,
          totalProductionCost,
          grossProfit,
          profitMargin,
          saleStatus: sale.status,
        });
      });
    });
    
    return reports;
  };

  const applyFilters = () => {
    let filtered = [...sales];
    
    if (periodFilter === "all" && showAllData) {
      setFilteredSales(allSales);
      calculateSummary(allSales);
      return;
    }
    
    if (dateRange.startDate && dateRange.endDate) {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= start && saleDate <= end;
      });
    }
    
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
    }
    
    const reports = processSalesToReports(filtered);
    setFilteredSales(reports);
    calculateSummary(reports);
  };

  const calculateSummary = (reports: SalesIncomeReport[]) => {
    const totalRevenue = reports.reduce((sum, report) => sum + report.totalRevenue, 0);
    const totalProductionCost = reports.reduce((sum, report) => sum + report.totalProductionCost, 0);
    const totalGrossProfit = reports.reduce((sum, report) => sum + report.grossProfit, 0);
    const averageProfitMargin = reports.length > 0 
      ? reports.reduce((sum, report) => sum + report.profitMargin, 0) / reports.length 
      : 0;
    
    setSummary({
      totalRevenue,
      totalProductionCost,
      totalGrossProfit,
      averageProfitMargin,
      totalSales: new Set(reports.map(r => r.saleId)).size,
    });
  };

  const downloadCSV = () => {
    const dataToDownload = periodFilter === "all" && showAllData ? allSales : filteredSales;
    
    if (dataToDownload.length === 0) {
      alert("No data to download");
      return;
    }
    
    const headers = [
      "Date",
      "Sale ID",
      "Customer",
      "Product ID",
      "Product Name",
      "Quantity",
      "Unit Price",
      "Total Revenue",
      "Unit Production Cost",
      "Total Production Cost",
      "Gross Profit",
      "Profit Margin %",
      "Status"
    ];
    
    const csvData = dataToDownload.map(report => [
      formatDate(report.date),
      report.saleId,
      `"${report.customerName.replace(/"/g, '""')}"`,
      report.productId,
      `"${report.productName.replace(/"/g, '""')}"`,
      report.quantity,
      formatCurrency(report.unitPrice, false),
      formatCurrency(report.totalRevenue, false),
      formatCurrency(report.unitProductionCost, false),
      formatCurrency(report.totalProductionCost, false),
      formatCurrency(report.grossProfit, false),
      report.profitMargin.toFixed(1),
      report.saleStatus
    ]);
    
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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

  const formatCurrency = (amount: number, includeSymbol: boolean = true) => {
    const formatted = Number(amount || 0).toFixed(2);
    return includeSymbol ? `KES ${formatted}` : formatted;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const resetFilters = () => {
    setDateRange({
      startDate: "",
      endDate: "",
    });
    setPeriodFilter("all");
    setShowAllData(true);
    setShowFilters(false); // Close filter drawer on mobile
  };

  const toggleAllData = () => {
    setShowAllData(!showAllData);
    if (!showAllData) {
      setPeriodFilter("all");
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "table" ? "cards" : "table");
  };

  const displayData = periodFilter === "all" && showAllData ? allSales : filteredSales;

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
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6 border-2 border-blue-200">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-blue-100 p-1.5 rounded-lg sm:hidden">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="bg-blue-100 p-1.5 rounded-lg hidden sm:inline-flex">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                Sales Income Report
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 pl-9 sm:pl-0">
              Gross Profit = Total Revenue - Total Production Cost
            </p>
          </div>
          
          {/* Mobile Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="flex gap-2">
              {/* View Mode Toggle - Mobile Only */}
              <button
                onClick={toggleViewMode}
                className="sm:hidden p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center justify-center"
                title={viewMode === "table" ? "Switch to Card View" : "Switch to Table View"}
              >
                <Smartphone className="w-4 h-4 text-gray-700" />
              </button>
              
              {/* Filter Toggle - Mobile Only */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition flex items-center justify-center"
              >
                <Filter className="w-4 h-4 text-blue-600" />
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Show All Toggle */}
              <button
                onClick={toggleAllData}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm ${
                  showAllData 
                    ? "bg-green-500 hover:bg-green-600 text-white" 
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {showAllData ? (
                  <>
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">All Data</span>
                    <span className="sm:hidden">All</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Filtered</span>
                    <span className="sm:hidden">Filtered</span>
                  </>
                )}
              </button>
              
              <button
                onClick={downloadCSV}
                disabled={displayData.length === 0}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Download CSV</span>
                <span className="sm:hidden">Download</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Toggle - Desktop Only */}
        <div className="hidden sm:flex justify-end">
          <div className="inline-flex rounded-lg border border-gray-300 p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === "table" 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === "cards" 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Card View
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards - Mobile Stacked */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-blue-50 rounded-lg p-2 sm:p-4 border border-blue-200">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Revenue</p>
          <p className="text-base sm:text-xl font-bold text-blue-600 truncate">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-2 sm:p-4 border border-orange-200">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Prod. Cost</p>
          <p className="text-base sm:text-xl font-bold text-orange-600 truncate">
            {formatCurrency(summary.totalProductionCost)}
          </p>
        </div>
        
        <div className="bg-green-50 rounded-lg p-2 sm:p-4 border border-green-200">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Gross Profit</p>
          <p className="text-base sm:text-xl font-bold text-green-600 truncate">
            {formatCurrency(summary.totalGrossProfit)}
          </p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-2 sm:p-4 border border-purple-200 hidden sm:block lg:block">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Avg. Margin</p>
          <p className="text-base sm:text-xl font-bold text-purple-600">
            {summary.averageProfitMargin.toFixed(1)}%
          </p>
        </div>
        
        <div className="bg-amber-50 rounded-lg p-2 sm:p-4 border border-amber-200 hidden sm:block lg:block">
          <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Sales</p>
          <p className="text-base sm:text-xl font-bold text-amber-600">
            {summary.totalSales}
          </p>
        </div>
      </div>

      {/* Mobile Only: Compact Summary Row */}
      <div className="sm:hidden grid grid-cols-2 gap-2 mb-4">
        <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
          <p className="text-xs text-gray-600 mb-1">Margin</p>
          <p className="text-sm font-bold text-purple-600">
            {summary.averageProfitMargin.toFixed(1)}%
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
          <p className="text-xs text-gray-600 mb-1">Sales</p>
          <p className="text-sm font-bold text-amber-600">
            {summary.totalSales}
          </p>
        </div>
      </div>

      {/* Data Info Banner */}
      {showAllData && periodFilter === "all" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-blue-100 p-1.5 sm:p-2 rounded-full">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-800 text-sm sm:text-base">Showing ALL Sales Data</p>
              <p className="text-xs sm:text-sm text-blue-600">
                {displayData.length > 0 ? (
                  <span>{displayData.length} items from {summary.totalSales} sales</span>
                ) : (
                  <span>Complete sales history with gross profit</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Drawer */}
      {showFilters && (
        <div className="sm:hidden mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Filters</h4>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-500 hover:text-gray-700"
            >
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
                    if (period === "all") {
                      setShowAllData(true);
                    }
                    if (period !== "custom") {
                      setShowFilters(false);
                    }
                  }}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition ${
                    periodFilter === period
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      {!showAllData || periodFilter !== "all" ? (
        <div className="hidden sm:block bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by Period</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(["all", "daily", "weekly", "monthly", "yearly", "custom"] as PeriodFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setPeriodFilter(period);
                    if (period === "all") {
                      setShowAllData(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    periodFilter === period
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {periodFilter === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
          
          {(dateRange.startDate || dateRange.endDate) && (
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600">
                Showing data from {formatDate(dateRange.startDate)} to {formatDate(dateRange.endDate)}
              </p>
              <button
                onClick={resetFilters}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Reset Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden sm:block mb-6">
          <button
            onClick={() => setShowAllData(false)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Click here to filter data by date range
          </button>
        </div>
      )}

      {/* Results Info */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {displayData.length} items from {summary.totalSales} sales
          {viewMode === "cards" && " (Card View)"}
          {viewMode === "table" && " (Table View)"}
        </p>
      </div>

      {/* Data Display - Conditional Rendering based on viewMode */}
      {displayData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <PieChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No sales data found.</p>
          <p className="text-sm mt-1">Check if you have any sales recorded.</p>
        </div>
      ) : viewMode === "table" ? (
        // Table View (Desktop/Mobile)
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sale
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit
                </th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.slice(0, 50).map((report, index) => (
                <tr key={`${report.saleId}-${report.productId}-${index}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {formatDate(report.date)}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    #{report.saleId}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 truncate max-w-[100px] sm:max-w-none">
                    {report.customerName}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 truncate max-w-[80px] sm:max-w-none">
                    {report.productName}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 text-center">
                    {report.quantity}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {formatCurrency(report.totalRevenue)}
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                    {formatCurrency(report.totalProductionCost)}
                  </td>
                  <td className={`px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium ${
                    report.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(report.grossProfit)}
                  </td>
                  <td className={`px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium ${
                    report.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {report.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {displayData.length > 50 && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
              <p className="text-xs sm:text-sm text-gray-600 text-center">
                Showing 50 of {displayData.length} items. Download CSV for complete data.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Card View (Mobile Optimized)
        <div className="space-y-3">
          {displayData.slice(0, 20).map((report, index) => (
            <div 
              key={`${report.saleId}-${report.productId}-${index}`}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div 
                className="flex justify-between items-start cursor-pointer"
                onClick={() => setExpandedCard(expandedCard === index ? null : index)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-900">#{report.saleId}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-600">{formatDate(report.date)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
                    {report.customerName}
                  </p>
                  <p className="text-xs text-gray-600 truncate max-w-[200px]">
                    {report.productName}
                  </p>
                </div>
                <button className="text-gray-400">
                  {expandedCard === index ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {/* Collapsed View */}
              {expandedCard !== index && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Revenue</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(report.totalRevenue)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Profit</p>
                    <p className={`text-sm font-semibold ${
                      report.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(report.grossProfit)}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Expanded View */}
              {expandedCard === index && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600">Product</p>
                      <p className="text-sm font-medium text-gray-900">{report.productName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Quantity</p>
                      <p className="text-sm font-medium text-gray-900 text-center">{report.quantity}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600">Revenue</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(report.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Prod. Cost</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(report.totalProductionCost)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-600">Gross Profit</p>
                      <p className={`text-sm font-medium ${
                        report.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(report.grossProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Margin</p>
                      <p className={`text-sm font-medium ${
                        report.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {report.profitMargin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Unit Price</p>
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(report.unitPrice)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {displayData.length > 20 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
              <p className="text-xs sm:text-sm text-gray-600">
                Showing 20 of {displayData.length} items. Download CSV for complete data.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Analysis - Mobile Optimized */}
      {displayData.length > 0 && (
        <div className="mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
              <BarChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Profit Distribution
            </h4>
            <div className="space-y-1.5 sm:space-y-2">
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="text-gray-600">Revenue</span>
                  <span className="font-medium">{formatCurrency(summary.totalRevenue)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-blue-500 h-1.5 sm:h-2 rounded-full" 
                    style={{ width: '100%' }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="text-gray-600">Production Cost</span>
                  <span className="font-medium">{formatCurrency(summary.totalProductionCost)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-orange-500 h-1.5 sm:h-2 rounded-full" 
                    style={{ 
                      width: `${summary.totalRevenue > 0 ? (summary.totalProductionCost / summary.totalRevenue * 100) : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-1">
                  <span className="text-gray-600">Gross Profit</span>
                  <span className="font-medium">{formatCurrency(summary.totalGrossProfit)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-green-500 h-1.5 sm:h-2 rounded-full" 
                    style={{ 
                      width: `${summary.totalRevenue > 0 ? (summary.totalGrossProfit / summary.totalRevenue * 100) : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Key Metrics
            </h4>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between">
                <span className="text-xs sm:text-sm text-gray-600">Profitability</span>
                <span className={`text-xs sm:text-sm font-medium ${summary.averageProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.averageProfitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs sm:text-sm text-gray-600">Revenue/Sale</span>
                <span className="text-xs sm:text-sm font-medium text-blue-600">
                  {summary.totalSales > 0 ? formatCurrency(summary.totalRevenue / summary.totalSales) : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs sm:text-sm text-gray-600">Profit/Sale</span>
                <span className="text-xs sm:text-sm font-medium text-green-600">
                  {summary.totalSales > 0 ? formatCurrency(summary.totalGrossProfit / summary.totalSales) : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs sm:text-sm text-gray-600">Items/Sale</span>
                <span className="text-xs sm:text-sm font-medium text-purple-600">
                  {summary.totalSales > 0 ? (displayData.length / summary.totalSales).toFixed(1) : '0.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}