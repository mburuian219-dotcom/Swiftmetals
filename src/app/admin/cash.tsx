"use client";

import { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, RefreshCw, Calendar, TrendingUp, TrendingDown, Wallet, ChevronRight, Menu, X, Smartphone, Monitor } from 'lucide-react';

interface MoneyRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  referenceSource: string;
  referenceId: string;
  runningBalance?: number;
  timestamp?: string;
}

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
type TypeFilter = 'ALL' | 'INFLOW' | 'OUTFLOW';
type ViewMode = 'desktop' | 'mobile';

export default function MoneyTracker() {
  const [records, setRecords] = useState<MoneyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MoneyRecord | null>(null);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode('mobile');
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from all APIs
      const [salesRes, restocksRes, expensesRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/restock'),
        fetch('/api/expenses')
      ]);

      // Check if any API failed
      const errors: string[] = [];
      if (!salesRes.ok) errors.push(`Sales API: ${salesRes.status}`);
      if (!restocksRes.ok) errors.push(`Restock API: ${restocksRes.status}`);
      if (!expensesRes.ok) errors.push(`Expenses API: ${expensesRes.status}`);
      
      if (errors.length > 0) {
        throw new Error(`Failed to fetch: ${errors.join(', ')}`);
      }

      const [salesData, restocksData, expensesData] = await Promise.all([
        salesRes.json(),
        restocksRes.json(),
        expensesRes.json()
      ]);

      const allRecords = combineRecords(salesData, restocksData, expensesData);
      setRecords(allRecords);
      
      // Calculate current balance
      const totalInflow = allRecords
        .filter(r => r.type === 'INFLOW')
        .reduce((sum, r) => sum + r.amount, 0);
        
      const totalOutflow = allRecords
        .filter(r => r.type === 'OUTFLOW')
        .reduce((sum, r) => sum + r.amount, 0);
        
      setCurrentBalance(totalInflow - totalOutflow);
      
      console.log(`Loaded ${allRecords.length} records: ${allRecords.filter(r => r.type === 'INFLOW').length} inflow, ${allRecords.filter(r => r.type === 'OUTFLOW').length} outflow`);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : 'Failed to fetch data');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const combineRecords = (salesData: any, restocksData: any, expensesData: any): MoneyRecord[] => {
    const allRecords: MoneyRecord[] = [];
    
    // Process sales records
    if (Array.isArray(salesData)) {
      salesData.forEach((sale: any) => {
        if (sale.status === 'PAID' || sale.status === 'PARTIAL') {
          const amountReceived = sale.totalPaid || 0;
          if (amountReceived <= 0) return;
          
          const customerName = sale.customer?.name || 'Customer';
          const description = generateSaleDescription(sale, customerName);
          
          allRecords.push({
            id: `sale-${sale.id}`,
            date: sale.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            timestamp: sale.date, // Use the timestamp field
            description: description,
            amount: amountReceived,
            type: 'INFLOW',
            category: 'Sales',
            referenceSource: 'Sales',
            referenceId: `SALE-${String(sale.id).padStart(8, '0')}`,
            runningBalance: sale.runningBalance
          });
        }
      });
    }

    // Process restock records
    const restocksArray = Array.isArray(restocksData) 
      ? restocksData 
      : restocksData.restocks || [];
    
    restocksArray.forEach((restock: any) => {
      if (!restock.totalCost || restock.totalCost <= 0) return;
      
      const description = generateRestockDescription(restock);
      
      allRecords.push({
        id: `restock-${restock.id}`,
        // Use createdAt from restock data (which contains the actual timestamp)
        date: restock.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        timestamp: restock.createdAt, // This contains the actual time
        description: description,
        amount: restock.totalCost || 0,
        type: 'OUTFLOW',
        category: 'Restock',
        referenceSource: 'Restock',
        referenceId: `RSTK-${String(restock.id).padStart(8, '0')}`,
        runningBalance: restock.runningBalance
      });
    });

    // Process expense records
    const expensesArray = Array.isArray(expensesData)
      ? expensesData
      : expensesData.expenses || [];
    
    expensesArray.forEach((expense: any) => {
      if (!expense.amount || expense.amount <= 0) return;
      
      allRecords.push({
        id: `expense-${expense.id}`,
        date: expense.date?.split('T')[0] || new Date().toISOString().split('T')[0],
        timestamp: expense.date,
        description: expense.description || 'Expense',
        amount: expense.amount || 0,
        type: 'OUTFLOW',
        category: expense.category || 'Expense',
        referenceSource: 'Expense',
        referenceId: `EXP-${String(expense.id).padStart(8, '0')}`,
        runningBalance: expense.runningBalance
      });
    });

    // Sort by date (newest first) using local Kenyan time
    return allRecords.sort((a, b) => {
      const dateA = getLocalDate(a.timestamp || a.date).getTime();
      const dateB = getLocalDate(b.timestamp || b.date).getTime();
      if (isNaN(dateA) && isNaN(dateB)) return 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });
  };

  const generateSaleDescription = (sale: any, customerName: string): string => {
    let description = '';
    let itemsArray = sale.saleitems || sale.saleitem || [];
    
    if (Array.isArray(itemsArray) && itemsArray.length > 0) {
      const itemNames = itemsArray
        .map((item: any) => `${item.quantity}x ${item.product?.name || 'item'}`)
        .join(', ');
      description = `Sale to ${customerName} (${sale.status}): ${itemNames}`;
    } else {
      description = `Sale to ${customerName} (${sale.status})`;
    }
    
    return description;
  };

  const generateRestockDescription = (restock: any): string => {
    let itemsArray: any[] = [];
    
    if (restock.items && Array.isArray(restock.items)) {
      itemsArray = restock.items;
    } else if (restock.restockItems && Array.isArray(restock.restockItems)) {
      itemsArray = restock.restockItems;
    } else if (restock.restockitems && Array.isArray(restock.restockitems)) {
      itemsArray = restock.restockitems;
    }
    
    if (itemsArray.length > 0) {
      const itemDetails = itemsArray.map((item: any) => {
        const productName = item.product?.name || item.productName || 'item';
        const quantity = item.quantity || item.quantityOrdered || 1;
        return `${quantity}x ${productName}`;
      }).join(', ');
      
      return `Restock: ${itemDetails}`;
    } else if (restock.productName || restock.product?.name) {
      const productName = restock.productName || restock.product?.name;
      const quantity = restock.quantity || restock.quantityOrdered || 1;
      return `Restock: ${quantity}x ${productName}`;
    }
    
    return 'Restock';
  };

  // Date formatting functions for Kenyan timezone
  const formatDate = (dateString: string) => {
    try {
      // Convert UTC to East Africa Time (EAT)
      const date = new Date(dateString);
      // Format with Kenyan locale and timezone
      return date.toLocaleDateString('en-KE', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Format with Kenyan timezone including time
      return date.toLocaleDateString('en-KE', {
        timeZone: 'Africa/Nairobi',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-KE', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const getLocalDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Return date adjusted to Kenyan timezone
      return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
    } catch {
      return new Date();
    }
  };

  const getFullTimestamp = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Apply filters
  const filteredRecords = useMemo(() => {
    let result = records;
    
    // Apply time filter using Kenyan timezone
    if (timeFilter !== 'ALL') {
      const now = new Date();
      // Convert to Kenyan timezone for accurate filtering
      const kenyaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
      
      const startOfToday = new Date(kenyaNow.getFullYear(), kenyaNow.getMonth(), kenyaNow.getDate());
      const startOfWeek = new Date(kenyaNow.getFullYear(), kenyaNow.getMonth(), kenyaNow.getDate() - kenyaNow.getDay());
      const startOfMonth = new Date(kenyaNow.getFullYear(), kenyaNow.getMonth(), 1);
      
      result = result.filter(record => {
        const recordDate = getLocalDate(record.timestamp || record.date);
        
        switch (timeFilter) {
          case 'TODAY':
            return recordDate >= startOfToday;
          case 'WEEK':
            return recordDate >= startOfWeek;
          case 'MONTH':
            return recordDate >= startOfMonth;
          default:
            return true;
        }
      });
    }
    
    // Apply type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(record => record.type === typeFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(record =>
        record.description.toLowerCase().includes(term) ||
        record.category.toLowerCase().includes(term) ||
        record.referenceId.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [records, searchTerm, typeFilter, timeFilter]);

  // Calculate totals
  const { totalInflow, totalOutflow, netBalance } = useMemo(() => {
    const inflow = filteredRecords
      .filter(r => r.type === 'INFLOW')
      .reduce((sum, r) => sum + r.amount, 0);
    
    const outflow = filteredRecords
      .filter(r => r.type === 'OUTFLOW')
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netBalance: inflow - outflow
    };
  }, [filteredRecords]);

  // Format currency in Kenyan Shillings
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get time filter label
  const getTimeFilterLabel = (filter: TimeFilter): string => {
    switch (filter) {
      case 'TODAY': return 'Today';
      case 'WEEK': return 'This Week';
      case 'MONTH': return 'This Month';
      default: return 'All Time';
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ['Date', 'Time', 'Description', 'Amount (KES)', 'Type', 'Category', 'Reference'];
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(record =>
        [
          `"${formatDate(record.timestamp || record.date)}"`,
          `"${formatTime(record.timestamp || record.date)}"`,
          `"${record.description}"`,
          record.amount,
          record.type,
          `"${record.category}"`,
          `"${record.referenceId}"`
        ].join(',')
      )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-flow-${timeFilter.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Mobile transaction detail view
  const renderMobileDetailView = () => {
    if (!selectedRecord) return null;

    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setSelectedRecord(null)}
            className="p-2 rounded-lg bg-gray-100"
          >
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <h2 className="text-lg font-semibold">Transaction Details</h2>
          <div className="w-10"></div>
        </div>

        {/* Details */}
        <div className="p-4">
          {/* Amount Card */}
          <div className={`mb-6 p-6 rounded-2xl ${
            selectedRecord.type === 'INFLOW' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100' 
              : 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-100'
          }`}>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-2">Amount</p>
              <p className={`text-4xl font-bold ${
                selectedRecord.type === 'INFLOW' ? 'text-green-700' : 'text-red-700'
              }`}>
                {selectedRecord.type === 'INFLOW' ? '+' : '-'}{formatCurrency(selectedRecord.amount)}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-4">
            <DetailItem label="Date & Time" value={formatFullDate(selectedRecord.timestamp || selectedRecord.date)} />
            <DetailItem label="Description" value={selectedRecord.description} />
            <DetailItem label="Type" value={
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedRecord.type === 'INFLOW' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {selectedRecord.type === 'INFLOW' ? 'MONEY RECEIVED' : 'MONEY SPENT'}
              </span>
            } />
            <DetailItem label="Category" value={
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {selectedRecord.category}
              </span>
            } />
            <DetailItem label="Reference ID" value={
              <code className="bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700 font-mono">
                {selectedRecord.referenceId}
              </code>
            } />
            <DetailItem label="Source" value={selectedRecord.referenceSource} />
          </div>
        </div>
      </div>
    );
  };

  const DetailItem = ({ label, value }: { label: string; value: string | React.ReactNode }) => (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <div className="text-gray-900 font-medium">{value}</div>
    </div>
  );

  // Mobile summary cards
  const renderMobileSummaryCards = () => (
    <div className="space-y-4">
      {/* Balance Overview */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-500 text-sm">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
          </div>
          <Wallet className="text-gray-700" size={24} />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 p-3 rounded-xl">
            <p className="text-green-600 text-xs font-medium">Received</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalInflow)}</p>
            <p className="text-green-600 text-xs">
              {filteredRecords.filter(r => r.type === 'INFLOW').length} txns
            </p>
          </div>
          <div className="bg-red-50 p-3 rounded-xl">
            <p className="text-red-600 text-xs font-medium">Spent</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalOutflow)}</p>
            <p className="text-red-600 text-xs">
              {filteredRecords.filter(r => r.type === 'OUTFLOW').length} txns
            </p>
          </div>
        </div>
      </div>

      {/* Net Flow Card */}
      <div className={`p-5 rounded-2xl shadow-sm border ${
        netBalance >= 0 
          ? 'bg-gradient-to-r from-blue-50 to-sky-50 border-blue-100' 
          : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm">Net Cash Flow</p>
            <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {formatCurrency(netBalance)}
            </p>
            <p className="text-gray-500 text-xs">Received - Spent</p>
          </div>
          {netBalance >= 0 ? (
            <TrendingUp className="text-blue-600" size={24} />
          ) : (
            <TrendingDown className="text-orange-600" size={24} />
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading cash flow data...</p>
          <p className="text-gray-400 text-sm mt-1">Fetching transactions from all sources</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile Detail View */}
      {selectedRecord && renderMobileDetailView()}

      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        {/* Mobile Header */}
        <div className="md:hidden mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-white border border-gray-300"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-xl font-bold text-gray-900">Cash Flow</h1>
            <button
              onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
              className="p-2 rounded-lg bg-white border border-gray-300"
            >
              {viewMode === 'mobile' ? <Monitor size={20} /> : <Smartphone size={20} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-4 animate-slideDown">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => {
                    setTimeFilter('TODAY');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg flex flex-col items-center ${
                    timeFilter === 'TODAY' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="text-xs mt-1 font-medium">Today</span>
                </button>
                <button
                  onClick={() => {
                    setTimeFilter('WEEK');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg flex flex-col items-center ${
                    timeFilter === 'WEEK' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="text-xs mt-1 font-medium">Week</span>
                </button>
                <button
                  onClick={() => {
                    setTimeFilter('MONTH');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg flex flex-col items-center ${
                    timeFilter === 'MONTH' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="text-xs mt-1 font-medium">Month</span>
                </button>
                <button
                  onClick={() => {
                    setTimeFilter('ALL');
                    setMobileMenuOpen(false);
                  }}
                  className={`p-3 rounded-lg flex flex-col items-center ${
                    timeFilter === 'ALL' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="text-xs mt-1 font-medium">All Time</span>
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setTypeFilter(typeFilter === 'ALL' ? 'INFLOW' : typeFilter === 'INFLOW' ? 'OUTFLOW' : 'ALL');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <span className="text-gray-700 font-medium">Filter Type</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {typeFilter === 'ALL' ? 'All Types' : typeFilter === 'INFLOW' ? 'Received' : 'Spent'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    fetchData();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3 bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <RefreshCw size={18} />
                  <span className="text-gray-700 font-medium">Refresh Data</span>
                </button>

                <button
                  onClick={() => {
                    exportToCSV();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full p-3 bg-green-600 text-white rounded-lg flex items-center gap-3 justify-center"
                >
                  <Download size={18} />
                  <span className="font-medium">Export CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Cash Flow Tracker</h1>
              <p className="text-gray-600 mt-1">Track money received and spent in real-time</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-300">
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`p-2 rounded-md ${viewMode === 'mobile' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
                >
                  <Smartphone size={20} />
                </button>
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`p-2 rounded-md ${viewMode === 'desktop' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
                >
                  <Monitor size={20} />
                </button>
              </div>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center gap-2 border border-gray-300 shadow-sm hover:shadow"
              >
                <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                  filteredRecords.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-sm hover:shadow'
                }`}
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Desktop Time Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                  timeFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                <Calendar size={16} />
                {getTimeFilterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Mobile View */}
        {viewMode === 'mobile' ? (
          <div className="md:hidden">
            {/* Summary Cards */}
            {renderMobileSummaryCards()}

            {/* Time Filter Chips */}
            <div className="flex overflow-x-auto gap-2 my-4 pb-2">
              {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as TimeFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm ${
                    timeFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'TODAY' ? 'Today' : filter === 'WEEK' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>

            {/* Type Filter Chips */}
            <div className="flex overflow-x-auto gap-2 mb-4 pb-2">
              {(['ALL', 'INFLOW', 'OUTFLOW'] as TypeFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTypeFilter(filter)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm flex items-center gap-2 ${
                    typeFilter === filter
                      ? filter === 'INFLOW' 
                        ? 'bg-green-600 text-white'
                        : filter === 'OUTFLOW'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  {filter === 'INFLOW' ? (
                    <>
                      <TrendingUp size={14} />
                      Received
                    </>
                  ) : filter === 'OUTFLOW' ? (
                    <>
                      <TrendingDown size={14} />
                      Spent
                    </>
                  ) : (
                    'All Types'
                  )}
                </button>
              ))}
            </div>

            {/* Mobile Transactions List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Transactions</h3>
                  <span className="text-sm text-gray-500">
                    {filteredRecords.length} records
                  </span>
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center">
                  <Search size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium">No transactions found</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 active:bg-gray-50 transition-colors"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">
                            {record.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(record.timestamp || record.date)} • {record.category}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatTime(record.timestamp || record.date)}
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 ml-2 flex-shrink-0" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.type === 'INFLOW' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.type === 'INFLOW' ? 'RECEIVED' : 'SPENT'}
                          </span>
                          <span className="text-xs text-gray-500 ml-2 font-mono">
                            {record.referenceId}
                          </span>
                        </div>
                        <p className={`text-lg font-bold ${
                          record.type === 'INFLOW' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {record.type === 'INFLOW' ? '+' : '-'}{formatCurrency(record.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Footer */}
            <div className="mt-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-3">
                  Showing {filteredRecords.length} of {records.length} transactions
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Received</p>
                    <p className="font-bold text-green-700">{formatCurrency(totalInflow)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Spent</p>
                    <p className="font-bold text-red-700">{formatCurrency(totalOutflow)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Net</p>
                    <p className={`font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {formatCurrency(netBalance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop View */
          <div className="hidden md:block">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="text-green-600" size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Money Received</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatCurrency(totalInflow)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    {filteredRecords.filter(r => r.type === 'INFLOW').length} transactions
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <TrendingDown className="text-red-600" size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Money Spent</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatCurrency(totalOutflow)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                    {filteredRecords.filter(r => r.type === 'OUTFLOW').length} transactions
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <div className={`w-2 h-2 rounded-full ${netBalance >= 0 ? 'bg-blue-600' : 'bg-orange-600'}`}></div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">Net Cash Flow</span>
                </div>
                <p className={`text-2xl md:text-3xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(netBalance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Received - Spent</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Wallet className="text-gray-700" size={20} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Current Balance</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatCurrency(currentBalance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">All time transactions</p>
              </div>
            </div>

            {/* Filters Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search transactions by description, category, or reference..."
                      className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    >
                      <option value="ALL">All Types</option>
                      <option value="INFLOW">Money Received</option>
                      <option value="OUTFLOW">Money Spent</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{filteredRecords.length}</span> of <span className="font-medium">{records.length}</span> records
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-500">Inflow</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-xs text-gray-500">Outflow</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                      <th className="py-4 px-6 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="text-gray-400">
                            <Search size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-gray-500 font-medium">No transactions found</p>
                            <p className="text-gray-400 text-sm mt-1">
                              Try adjusting your filters or search term
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="py-4 px-6">
                            <div className="flex flex-col" title={getFullTimestamp(record.timestamp || record.date)}>
                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(record.timestamp || record.date)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTime(record.timestamp || record.date)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="max-w-md">
                              <div className="text-sm font-medium text-gray-900 truncate" title={record.description}>
                                {record.description}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${
                              record.type === 'INFLOW' 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-red-50 text-red-700'
                            }`}>
                              {record.type === 'INFLOW' ? (
                                <TrendingUp size={14} />
                              ) : (
                                <TrendingDown size={14} />
                              )}
                              <span className="font-semibold">
                                {record.type === 'INFLOW' ? '+' : '-'}{formatCurrency(record.amount)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                              record.type === 'INFLOW' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {record.type === 'INFLOW' ? 'RECEIVED' : 'SPENT'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                              {record.category}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-mono text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                              {record.referenceId}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-semibold">{filteredRecords.length}</span> transactions for {getTimeFilterLabel(timeFilter).toLowerCase()}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-gray-600">Received:</span>
                      <span className="font-semibold text-green-700">{formatCurrency(totalInflow)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-gray-600">Spent:</span>
                      <span className="font-semibold text-red-700">{formatCurrency(totalOutflow)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${netBalance >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                      <span className="text-gray-600">Net:</span>
                      <span className={`font-semibold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        {formatCurrency(netBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Information Footer */}
        <div className={`mt-6 p-6 bg-white rounded-xl border border-gray-200 shadow-sm ${viewMode === 'mobile' ? 'md:hidden' : ''}`}>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Understanding Your Cash Flow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="font-medium text-gray-900">Money Received</span>
                </div>
                <p className="text-xs">Only includes PAID and PARTIAL sales where money has actually been received.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="font-medium text-gray-900">Money Spent</span>
                </div>
                <p className="text-xs">Includes all restock purchases and expenses where money has been spent.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="font-medium text-gray-900">Timezone</span>
                </div>
                <p className="text-xs">All times shown in East Africa Time (EAT, UTC+3). Times are converted from server UTC.</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                All amounts in Kenyan Shillings (KES). Data updates in real-time.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Current view: {viewMode === 'mobile' ? 'Mobile' : 'Desktop'} • Time filter: {getTimeFilterLabel(timeFilter)} • {filteredRecords.length} transactions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}