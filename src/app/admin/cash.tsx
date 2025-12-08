"use client";

import { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, RefreshCw } from 'lucide-react';

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
}

export default function MoneyTracker() {
  const [records, setRecords] = useState<MoneyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');

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

      const salesData = await salesRes.json();
      const restocksData = await restocksRes.json();
      const expensesData = await expensesRes.json();

      // Combine and format all records
      const allRecords: MoneyRecord[] = [];
      
      // SALES - INFLOW (Only show PAID and PARTIAL payments - money received)
      if (Array.isArray(salesData)) {
        salesData.forEach((sale: any) => {
          // Only include sales with payments (PAID or PARTIAL status)
          if (sale.status === 'PAID' || sale.status === 'PARTIAL') {
            // Use totalPaid amount for inflow (money actually received)
            const amountReceived = sale.totalPaid || 0;
            
            if (amountReceived <= 0) return; // Skip if no money received
            
            // Get customer name
            const customerName = sale.customer?.name || 'Customer';
            
            // Create description from sale items
            let description = '';
            if (sale.saleitems && Array.isArray(sale.saleitems) && sale.saleitems.length > 0) {
              const itemNames = sale.saleitems
                .map((item: any) => `${item.quantity}x ${item.product?.name || 'item'}`)
                .join(', ');
              description = `Sale to ${customerName} (${sale.status}): ${itemNames}`;
            } else if (sale.saleitem && Array.isArray(sale.saleitem) && sale.saleitem.length > 0) {
              const itemNames = sale.saleitem
                .map((item: any) => `${item.quantity}x ${item.product?.name || 'item'}`)
                .join(', ');
              description = `Sale to ${customerName} (${sale.status}): ${itemNames}`;
            } else {
              description = `Sale to ${customerName} (${sale.status})`;
            }
            
            allRecords.push({
              id: `sale-${sale.id}`,
              date: sale.date?.split('T')[0] || new Date().toISOString().split('T')[0],
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

      // RESTOCKS - OUTFLOW (Show all restocks as money spent)
      // Check if restocksData is an array or has a restocks property
      let restocksArray: any[] = [];
      if (Array.isArray(restocksData)) {
        restocksArray = restocksData;
      } else if (restocksData.restocks && Array.isArray(restocksData.restocks)) {
        restocksArray = restocksData.restocks;
      }
      
      restocksArray.forEach((restock: any) => {
        // Skip if no totalCost or totalCost is 0
        if (!restock.totalCost || restock.totalCost <= 0) return;
        
        // Create description from restock items
        let description = 'Restock';
        
        // Try different item property names
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
          
          description = `Restock: ${itemDetails}`;
        } else {
          // If no items array, check for individual properties
          if (restock.productName || restock.product?.name) {
            const productName = restock.productName || restock.product?.name;
            const quantity = restock.quantity || restock.quantityOrdered || 1;
            description = `Restock: ${quantity}x ${productName}`;
          }
        }
        
        allRecords.push({
          id: `restock-${restock.id}`,
          date: restock.restockDate?.split('T')[0] || restock.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          description: description,
          amount: restock.totalCost || 0,
          type: 'OUTFLOW',
          category: 'Restock',
          referenceSource: 'Restock',
          referenceId: `RSTK-${String(restock.id).padStart(8, '0')}`,
          runningBalance: restock.runningBalance
        });
      });

      // EXPENSES - OUTFLOW (Show all expenses as money spent)
      // Check if expensesData is an array or has an expenses property
      let expensesArray: any[] = [];
      if (Array.isArray(expensesData)) {
        expensesArray = expensesData;
      } else if (expensesData.expenses && Array.isArray(expensesData.expenses)) {
        expensesArray = expensesData.expenses;
      }
      
      expensesArray.forEach((expense: any) => {
        // Skip if no amount or amount is 0
        if (!expense.amount || expense.amount <= 0) return;
        
        allRecords.push({
          id: `expense-${expense.id}`,
          date: expense.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          description: expense.description || 'Expense',
          amount: expense.amount || 0,
          type: 'OUTFLOW',
          category: expense.category || 'Expense',
          referenceSource: 'Expense',
          referenceId: `EXP-${String(expense.id).padStart(8, '0')}`,
          runningBalance: expense.runningBalance
        });
      });

      // Sort by date (newest first)
      allRecords.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        // If dates are invalid, put them at the end
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      });
      
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

  // Apply filters
  const filteredRecords = useMemo(() => {
    let result = records;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(record =>
        record.description.toLowerCase().includes(term) ||
        record.category.toLowerCase().includes(term) ||
        record.referenceId.toLowerCase().includes(term)
      );
    }
    
    if (typeFilter !== 'ALL') {
      result = result.filter(record => record.type === typeFilter);
    }
    
    return result;
  }, [records, searchTerm, typeFilter]);

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ['Date', 'Description', 'Amount (KES)', 'Type', 'Category', 'Reference'];
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(record =>
        [
          `"${record.date}"`,
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
    a.download = `cash-flow-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cash flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Cash Flow Tracker</h1>
              <p className="text-gray-600 mt-1">Track money received and spent</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  filteredRecords.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Download size={18} />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <p>Loaded {records.length} total records: 
            <span className="font-semibold text-green-600 ml-2">{records.filter(r => r.type === 'INFLOW').length} inflow (Paid/Partial sales)</span>
            <span className="font-semibold text-red-600 ml-4">{records.filter(r => r.type === 'OUTFLOW').length} outflow (Restocks & Expenses)</span>
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-gray-600 text-sm">Money Received</p>
            <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">
              {formatCurrency(totalInflow)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {filteredRecords.filter(r => r.type === 'INFLOW').length} paid/partial sales
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-gray-600 text-sm">Money Spent</p>
            <p className="text-2xl md:text-3xl font-bold text-red-600 mt-1">
              {formatCurrency(totalOutflow)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {filteredRecords.filter(r => r.type === 'OUTFLOW').length} restocks & expenses
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-gray-600 text-sm">Net Cash Flow</p>
            <p className={`text-2xl md:text-3xl font-bold mt-1 ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(netBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Received - Spent</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <p className="text-gray-600 text-sm">Current Cash Balance</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(currentBalance)}
            </p>
            <p className="text-sm text-gray-500 mt-1">All cash transactions</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select
                  className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Description</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Amount</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Category</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-700">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <p className="text-gray-500">No transactions found</p>
                      {records.length === 0 && (
                        <p className="text-gray-400 text-sm mt-1">No data available from APIs</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">{formatDate(record.date)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900 max-w-md truncate" title={record.description}>
                          {record.description}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`text-sm font-bold ${record.type === 'INFLOW' ? 'text-green-600' : 'text-red-600'}`}>
                          {record.type === 'INFLOW' ? '+' : '-'}{formatCurrency(record.amount)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.type === 'INFLOW' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.type === 'INFLOW' ? 'RECEIVED' : 'SPENT'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {record.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-500 font-mono">{record.referenceId}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-sm text-gray-600">
                Showing {filteredRecords.length} of {records.length} transactions
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Received: </span>
                  <span className="font-semibold text-green-600">{formatCurrency(totalInflow)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Spent: </span>
                  <span className="font-semibold text-red-600">{formatCurrency(totalOutflow)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Net: </span>
                  <span className={`font-semibold ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(netBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p><span className="font-semibold">Note:</span> Only showing money actually received (PAID and PARTIAL sales)</p>
          <p className="mt-1">UNPAID sales are not included as no money has been received yet</p>
          <p className="mt-1">All amounts in Kenyan Shillings (KES)</p>
          <div className="mt-3 flex flex-col md:flex-row justify-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
              <span>Green = Money Received (Paid/Partial Sales)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div>
              <span>Red = Money Spent (Restocks & Expenses)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}