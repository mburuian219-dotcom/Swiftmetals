import { useState, useEffect } from "react";
import { TrendingUp, CreditCard, DollarSign, Download, Building, Cpu, Smartphone } from "lucide-react";

type BalanceSheet = {
  assets: {
    nonCurrentAssets: {
      machinery: number;
      motorVehicle: number;
      phoneAndAccessories: number;
      total: number;
    };
    currentAssets: {
      inventory: number;
      cash: number;
      bankBalances: number;
      accountsReceivable: number; // Also known as receivables/debtors
      pettyCash: number;
      total: number;
    };
    totalAssets: number;
  };
  liabilities: {
    nonCurrentLiabilities: {
      longTermLoans: number;
      total: number;
    };
    currentLiabilities: {
      shortTermLoans: number;
      creditors: number;
      total: number;
    };
    totalLiabilities: number;
  };
  equity: {
    shareCapital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  netAssets: number;
  date: string;
};

const defaultBalanceSheet: BalanceSheet = {
  assets: {
    nonCurrentAssets: {
      machinery: 0,
      motorVehicle: 0,
      phoneAndAccessories: 0,
      total: 0
    },
    currentAssets: {
      inventory: 0,
      cash: 0,
      bankBalances: 0,
      accountsReceivable: 0, // Debtors/Receivables
      pettyCash: 0,
      total: 0
    },
    totalAssets: 0
  },
  liabilities: {
    nonCurrentLiabilities: {
      longTermLoans: 0,
      total: 0
    },
    currentLiabilities: {
      shortTermLoans: 0,
      creditors: 0,
      total: 0
    },
    totalLiabilities: 0
  },
  equity: {
    shareCapital: 0,
    retainedEarnings: 0,
    totalEquity: 0
  },
  netAssets: 0,
  date: new Date().toISOString()
};

type BalanceSheetSectionProps = {
  balanceSheet?: Partial<BalanceSheet>;
  pettyCashBalance?: number;
  onDownload: () => void;
  onManualInputChange?: (category: string, field: string, value: number) => void;
};

export default function BalanceSheetSection({ 
  balanceSheet = {}, 
  pettyCashBalance = 0,
  onDownload, 
  onManualInputChange 
}: BalanceSheetSectionProps) {
  
  const [localBalanceSheet, setLocalBalanceSheet] = useState<BalanceSheet>(defaultBalanceSheet);
  const [creditorsData, setCreditorsData] = useState<any[]>([]);
  const [loadingCreditors, setLoadingCreditors] = useState(true);
  const [manualInputs, setManualInputs] = useState<{[key: string]: number}>({});

  // Fetch creditors data from API
  useEffect(() => {
    const fetchCreditors = async () => {
      try {
        setLoadingCreditors(true);
        const response = await fetch('/api/creditors');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch creditors: ${response.status}`);
        }
        
        const data = await response.json();
        setCreditorsData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching creditors:', error);
        setCreditorsData([]);
      } finally {
        setLoadingCreditors(false);
      }
    };

    fetchCreditors();
  }, []);

  // Calculate total creditors balance
  const calculateTotalCreditors = (creditors: any[]): number => {
    if (!Array.isArray(creditors)) return 0;
    
    return creditors.reduce((total, creditor) => {
      // Handle different possible creditor data structures
      const balance = 
        creditor.balance !== undefined ? Number(creditor.balance) :
        creditor.totalOwed !== undefined ? Number(creditor.totalOwed) :
        creditor.amountOwed !== undefined ? Number(creditor.amountOwed) : 0;
      
      return total + (isNaN(balance) ? 0 : balance);
    }, 0);
  };

  // Helper function to safely get numbers
  const safeNumber = (value: number | undefined | null): number => value ?? 0;

  useEffect(() => {
    const totalCreditorsBalance = calculateTotalCreditors(creditorsData);
    
    // Create a properly typed updatedBalanceSheet that matches Partial<BalanceSheet>
    const updatedBalanceSheet: Partial<BalanceSheet> = {
      ...balanceSheet,
      assets: {
        nonCurrentAssets: {
          machinery: manualInputs['nonCurrentAssets-machinery'] ?? safeNumber(balanceSheet.assets?.nonCurrentAssets?.machinery),
          motorVehicle: manualInputs['nonCurrentAssets-motorVehicle'] ?? safeNumber(balanceSheet.assets?.nonCurrentAssets?.motorVehicle),
          phoneAndAccessories: manualInputs['nonCurrentAssets-phoneAndAccessories'] ?? safeNumber(balanceSheet.assets?.nonCurrentAssets?.phoneAndAccessories),
          total: safeNumber(balanceSheet.assets?.nonCurrentAssets?.total)
        },
        currentAssets: {
          inventory: safeNumber(balanceSheet.assets?.currentAssets?.inventory),
          cash: safeNumber(balanceSheet.assets?.currentAssets?.cash),
          bankBalances: safeNumber(balanceSheet.assets?.currentAssets?.bankBalances),
          accountsReceivable: safeNumber(balanceSheet.assets?.currentAssets?.accountsReceivable),
          pettyCash: manualInputs['currentAssets-pettyCash'] ?? safeNumber(balanceSheet.assets?.currentAssets?.pettyCash),
          total: safeNumber(balanceSheet.assets?.currentAssets?.total)
        },
        totalAssets: safeNumber(balanceSheet.assets?.totalAssets)
      },
      liabilities: {
        nonCurrentLiabilities: {
          longTermLoans: manualInputs['nonCurrentLiabilities-longTermLoans'] ?? safeNumber(balanceSheet.liabilities?.nonCurrentLiabilities?.longTermLoans),
          total: safeNumber(balanceSheet.liabilities?.nonCurrentLiabilities?.total)
        },
        currentLiabilities: {
          shortTermLoans: manualInputs['currentLiabilities-shortTermLoans'] ?? safeNumber(balanceSheet.liabilities?.currentLiabilities?.shortTermLoans),
          creditors: totalCreditorsBalance,
          total: safeNumber(balanceSheet.liabilities?.currentLiabilities?.total)
        },
        totalLiabilities: safeNumber(balanceSheet.liabilities?.totalLiabilities)
      },
      equity: {
        shareCapital: manualInputs['equity-shareCapital'] ?? safeNumber(balanceSheet.equity?.shareCapital),
        retainedEarnings: safeNumber(balanceSheet.equity?.retainedEarnings),
        totalEquity: safeNumber(balanceSheet.equity?.totalEquity)
      },
      netAssets: safeNumber(balanceSheet.netAssets)
    };
    
    const calculated = calculateTotals(updatedBalanceSheet, totalCreditorsBalance);
    setLocalBalanceSheet(calculated);
  }, [balanceSheet, pettyCashBalance, creditorsData, manualInputs]);

  const calculateTotals = (sheet: Partial<BalanceSheet>, creditorsBalance: number = 0): BalanceSheet => {
    // Ensure all required properties exist with defaults
    const baseSheet: BalanceSheet = {
      ...defaultBalanceSheet,
      ...sheet,
      assets: {
        ...defaultBalanceSheet.assets,
        ...sheet.assets,
        nonCurrentAssets: {
          ...defaultBalanceSheet.assets.nonCurrentAssets,
          ...sheet.assets?.nonCurrentAssets
        },
        currentAssets: {
          ...defaultBalanceSheet.assets.currentAssets,
          ...sheet.assets?.currentAssets
        }
      },
      liabilities: {
        ...defaultBalanceSheet.liabilities,
        ...sheet.liabilities,
        nonCurrentLiabilities: {
          ...defaultBalanceSheet.liabilities.nonCurrentLiabilities,
          ...sheet.liabilities?.nonCurrentLiabilities
        },
        currentLiabilities: {
          ...defaultBalanceSheet.liabilities.currentLiabilities,
          ...sheet.liabilities?.currentLiabilities,
          // Use calculated creditors balance from API
          creditors: creditorsBalance
        }
      },
      equity: {
        ...defaultBalanceSheet.equity,
        ...sheet.equity
      }
    };

    // Calculate non-current assets total
    const nonCurrentAssetsTotal = 
      Number(baseSheet.assets.nonCurrentAssets.machinery || 0) +
      Number(baseSheet.assets.nonCurrentAssets.motorVehicle || 0) +
      Number(baseSheet.assets.nonCurrentAssets.phoneAndAccessories || 0);

    // Calculate current assets total (including manually inputted petty cash)
    const currentAssetsTotal = 
      Number(baseSheet.assets.currentAssets.inventory || 0) +
      Number(baseSheet.assets.currentAssets.cash || 0) +
      Number(baseSheet.assets.currentAssets.bankBalances || 0) +
      Number(baseSheet.assets.currentAssets.accountsReceivable || 0) + // Debtors/Receivables
      Number(baseSheet.assets.currentAssets.pettyCash || 0); // Now using manual petty cash input

    // Calculate total assets
    const totalAssets = nonCurrentAssetsTotal + currentAssetsTotal;

    // Calculate liabilities totals
    const nonCurrentLiabilitiesTotal = Number(baseSheet.liabilities.nonCurrentLiabilities.longTermLoans || 0);
    const currentLiabilitiesTotal = 
      Number(baseSheet.liabilities.currentLiabilities.shortTermLoans || 0) +
      Number(baseSheet.liabilities.currentLiabilities.creditors || 0);
    
    const totalLiabilities = nonCurrentLiabilitiesTotal + currentLiabilitiesTotal;

    // Calculate retained earnings (if not provided from API)
    const retainedEarnings = Number(baseSheet.equity.retainedEarnings || 0);

    // Use manual share capital if provided, otherwise auto-calculate
    const manualShareCapital = baseSheet.equity.shareCapital || 0;
    const shareCapital = manualShareCapital > 0 
      ? manualShareCapital  // Use manual input
      : Math.max(0, totalAssets - totalLiabilities - retainedEarnings); // Auto-calculate if no manual input

    const totalEquity = shareCapital + retainedEarnings;
    const netAssets = totalAssets - totalLiabilities;

    return {
      ...baseSheet,
      assets: {
        ...baseSheet.assets,
        nonCurrentAssets: {
          ...baseSheet.assets.nonCurrentAssets,
          total: nonCurrentAssetsTotal
        },
        currentAssets: {
          ...baseSheet.assets.currentAssets,
          total: currentAssetsTotal
        },
        totalAssets: totalAssets
      },
      liabilities: {
        ...baseSheet.liabilities,
        nonCurrentLiabilities: {
          ...baseSheet.liabilities.nonCurrentLiabilities,
          total: nonCurrentLiabilitiesTotal
        },
        currentLiabilities: {
          ...baseSheet.liabilities.currentLiabilities,
          total: currentLiabilitiesTotal
        },
        totalLiabilities: totalLiabilities
      },
      equity: {
        shareCapital: shareCapital,
        retainedEarnings: retainedEarnings,
        totalEquity: totalEquity
      },
      netAssets: netAssets,
      date: baseSheet.date
    };
  };

  const handleInputChange = (category: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    // Store manual input separately
    const inputKey = `${category}-${field}`;
    setManualInputs(prev => ({
      ...prev,
      [inputKey]: numValue
    }));

    // Update local state immediately for responsive UI
    setLocalBalanceSheet(prev => {
      const updated = { ...prev };
      
      if (category === 'nonCurrentAssets') {
        updated.assets.nonCurrentAssets = {
          ...updated.assets.nonCurrentAssets,
          [field]: numValue
        };
      } else if (category === 'nonCurrentLiabilities') {
        updated.liabilities.nonCurrentLiabilities = {
          ...updated.liabilities.nonCurrentLiabilities,
          [field]: numValue
        };
      } else if (category === 'currentLiabilities') {
        updated.liabilities.currentLiabilities = {
          ...updated.liabilities.currentLiabilities,
          [field]: numValue
        };
      } else if (category === 'currentAssets' && field === 'pettyCash') {
        updated.assets.currentAssets = {
          ...updated.assets.currentAssets,
          pettyCash: numValue
        };
      } else if (category === 'equity' && field === 'shareCapital') {
        updated.equity = {
          ...updated.equity,
          shareCapital: numValue
        };
      }
      
      const totalCreditorsBalance = calculateTotalCreditors(creditorsData);
      return calculateTotals(updated, totalCreditorsBalance);
    });

    // Notify parent component
    if (onManualInputChange) {
      onManualInputChange(category, field, numValue);
    }
  };

  const formatCurrency = (value: number) => {
    return Number(value || 0).toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  // UPDATED: Download function that includes ALL data
  const handleDownload = () => {
    // Check if share capital is manually inputted
    const isShareCapitalManual = manualInputs['equity-shareCapital'] !== undefined;
    
    // Create CSV content with ALL data including manual inputs
    const csvContent = [
      ["BALANCE SHEET - COMPLETE DATA"],
      [`As of ${new Date(localBalanceSheet.date).toLocaleDateString()}`],
      ["Generated on: " + new Date().toLocaleString()],
      [""],
      ["ASSETS", "Amount (KES)"],
      ["NON-CURRENT ASSETS", ""],
      ["  Machinery", formatCurrency(localBalanceSheet.assets.nonCurrentAssets.machinery)],
      ["  Motor Vehicle", formatCurrency(localBalanceSheet.assets.nonCurrentAssets.motorVehicle)],
      ["  Phone & Accessories", formatCurrency(localBalanceSheet.assets.nonCurrentAssets.phoneAndAccessories)],
      ["  Total Non-Current Assets", formatCurrency(localBalanceSheet.assets.nonCurrentAssets.total)],
      [""],
      ["CURRENT ASSETS", ""],
      ["  Inventory", formatCurrency(localBalanceSheet.assets.currentAssets.inventory)],
      ["  Bank Balances", formatCurrency(localBalanceSheet.assets.currentAssets.cash)],
      ["  Petty Cash", formatCurrency(localBalanceSheet.assets.currentAssets.pettyCash)],
      ["  Accounts Receivable (Debtors)", formatCurrency(localBalanceSheet.assets.currentAssets.accountsReceivable)],
      ["  Total Current Assets", formatCurrency(localBalanceSheet.assets.currentAssets.total)],
      [""],
      ["TOTAL ASSETS", formatCurrency(localBalanceSheet.assets.totalAssets)],
      [""],
      ["LIABILITIES & EQUITY", "Amount (KES)"],
      ["NON-CURRENT LIABILITIES", ""],
      ["  Long-term Loans", formatCurrency(localBalanceSheet.liabilities.nonCurrentLiabilities.longTermLoans)],
      ["  Total Non-Current Liabilities", formatCurrency(localBalanceSheet.liabilities.nonCurrentLiabilities.total)],
      [""],
      ["CURRENT LIABILITIES", ""],
      ["  Short-term Loans", formatCurrency(localBalanceSheet.liabilities.currentLiabilities.shortTermLoans)],
      ["  Creditors", formatCurrency(localBalanceSheet.liabilities.currentLiabilities.creditors)],
      ["  Total Current Liabilities", formatCurrency(localBalanceSheet.liabilities.currentLiabilities.total)],
      [""],
      ["TOTAL LIABILITIES", formatCurrency(localBalanceSheet.liabilities.totalLiabilities)],
      [""],
      ["SHAREHOLDERS' FUNDS", ""],
      [`  Share Capital ${isShareCapitalManual ? "(Manual Input)" : "(Auto-calculated)"}`, formatCurrency(localBalanceSheet.equity.shareCapital)],
      ["  Retained Earnings", formatCurrency(localBalanceSheet.equity.retainedEarnings)],
      ["  Total Equity", formatCurrency(localBalanceSheet.equity.totalEquity)],
      [""],
      ["NET ASSETS", formatCurrency(localBalanceSheet.netAssets)],
      ["TOTAL LIABILITIES & EQUITY", formatCurrency(localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity)],
      [""],
      ["BALANCE CHECK", ""],
      ["Assets = Liabilities + Equity", localBalanceSheet.assets.totalAssets === (localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity) ? "BALANCED" : "NOT BALANCED"],
      ["Difference", formatCurrency(Math.abs(localBalanceSheet.assets.totalAssets - (localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity)))],
      [""],
      ["DATA SOURCES", ""],
      ["Manual Inputs", Object.keys(manualInputs).length > 0 ? "Yes" : "No"],
      ["Creditors Count", creditorsData.length.toString()],
      ["Petty Cash Source", "Manual Input"],
      ["Share Capital Source", isShareCapitalManual ? "Manual Input" : "Auto-calculated"],
      ["Inventory Source", "Inventory API"],
      ["Accounts Receivable Source", "Debtors API"],
      ["Retained Earnings Source", "Income Statement API"]
    ].map(row => 
      Array.isArray(row) 
        ? row.map(cell => `"${cell}"`).join(",")
        : `"${row}"`
    ).join("\n");

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complete-balance-sheet-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Call parent's onDownload if provided
    if (onDownload) {
      onDownload();
    }
  };

  const isBalanced = Math.abs(
    localBalanceSheet.assets.totalAssets - 
    (localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity)
  ) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-black">Balance Sheet</h3>
          <p className="text-xs sm:text-sm text-black">As of {new Date(localBalanceSheet.date).toLocaleDateString()}</p>
          {Object.keys(manualInputs).length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Includes {Object.keys(manualInputs).length} manual adjustment(s)
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download Complete CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASSETS SECTION */}
        <div className="space-y-6">
          {/* Non-Current Assets */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200">
            <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              NON-CURRENT ASSETS
            </h4>
            
            <div className="space-y-3">
              {/* Machinery - Manual Input */}
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-black">Machinery</label>
                <input
                  type="number"
                  step="0.01"
                  value={localBalanceSheet.assets.nonCurrentAssets.machinery || ''}
                  onChange={(e) => handleInputChange('nonCurrentAssets', 'machinery', e.target.value)}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Motor Vehicle - Manual Input */}
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-black flex items-center gap-1">
                  <Cpu className="w-4 h-4" />
                  Motor Vehicle
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={localBalanceSheet.assets.nonCurrentAssets.motorVehicle || ''}
                  onChange={(e) => handleInputChange('nonCurrentAssets', 'motorVehicle', e.target.value)}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Phone & Accessories - Manual Input */}
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-black flex items-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  Phone & Accessories
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={localBalanceSheet.assets.nonCurrentAssets.phoneAndAccessories || ''}
                  onChange={(e) => handleInputChange('nonCurrentAssets', 'phoneAndAccessories', e.target.value)}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-right"
                  placeholder="0.00"
                />
              </div>

              <div className="h-px bg-gray-300 my-2"></div>
              
              <div className="flex justify-between items-center font-semibold">
                <span className="text-black">Total Non-Current Assets</span>
                <span className="text-purple-600">
                  {formatCurrency(localBalanceSheet.assets.nonCurrentAssets.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Current Assets */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              CURRENT ASSETS
            </h4>
            
            <div className="space-y-3">
              {/* Inventory - From API */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Inventory</span>
                <span className="font-bold text-black">
                  {formatCurrency(localBalanceSheet.assets.currentAssets.inventory)}
                </span>
              </div>

              {/* Bank Balances - From API */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Bank Balances</span>
                <span className="font-bold text-black">
                  {formatCurrency(localBalanceSheet.assets.currentAssets.cash)}
                </span>
              </div>

              {/* Petty Cash - Manual Input */}
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-black">Petty Cash</label>
                <input
                  type="number"
                  step="0.01"
                  value={localBalanceSheet.assets.currentAssets.pettyCash || ''}
                  onChange={(e) => handleInputChange('currentAssets', 'pettyCash', e.target.value)}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Accounts Receivable (Debtors) - From API */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Accounts Receivable (Debtors)</span>
                <span className="font-bold text-black">
                  {formatCurrency(localBalanceSheet.assets.currentAssets.accountsReceivable)}
                </span>
              </div>

              <div className="h-px bg-gray-300 my-2"></div>
              
              <div className="flex justify-between items-center font-semibold">
                <span className="text-black">Total Current Assets</span>
                <span className="text-blue-600">
                  {formatCurrency(localBalanceSheet.assets.currentAssets.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Total Assets */}
          <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-300">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-black">TOTAL ASSETS</span>
              <span className="text-xl font-bold text-blue-700">
                {formatCurrency(localBalanceSheet.assets.totalAssets)}
              </span>
            </div>
          </div>
        </div>

        {/* LIABILITIES & EQUITY SECTION */}
        <div className="space-y-6">
          {/* Liabilities */}
          <div className="space-y-6">
            {/* Non-Current Liabilities */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-200">
              <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-600" />
                NON-CURRENT LIABILITIES
              </h4>
              
              <div className="space-y-3">
                {/* Long-term Loans - Manual Input */}
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-black">Long-term Loans</label>
                  <input
                    type="number"
                    step="0.01"
                    value={localBalanceSheet.liabilities.nonCurrentLiabilities.longTermLoans || ''}
                    onChange={(e) => handleInputChange('nonCurrentLiabilities', 'longTermLoans', e.target.value)}
                    className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-black text-right"
                    placeholder="0.00"
                  />
                </div>

                <div className="h-px bg-gray-300 my-2"></div>
                
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-black">Total Non-Current Liabilities</span>
                  <span className="text-orange-600">
                    {formatCurrency(localBalanceSheet.liabilities.nonCurrentLiabilities.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Liabilities */}
            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200">
              <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600" />
                CURRENT LIABILITIES
              </h4>
              
              <div className="space-y-3">
                {/* Short-term Loans - Manual Input */}
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-black">Short-term Loans</label>
                  <input
                    type="number"
                    step="0.01"
                    value={localBalanceSheet.liabilities.currentLiabilities.shortTermLoans || ''}
                    onChange={(e) => handleInputChange('currentLiabilities', 'shortTermLoans', e.target.value)}
                    className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-black text-right"
                    placeholder="0.00"
                  />
                </div>

                {/* Creditors - From API */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-black">Creditors</span>
                    {loadingCreditors && (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-black">
                      {formatCurrency(localBalanceSheet.liabilities.currentLiabilities.creditors)}
                    </span>
                    {creditorsData.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {creditorsData.length} supplier{creditorsData.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-gray-300 my-2"></div>
                
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-black">Total Current Liabilities</span>
                  <span className="text-red-600">
                    {formatCurrency(localBalanceSheet.liabilities.currentLiabilities.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Liabilities */}
            <div className="bg-red-100 rounded-lg p-4 border-2 border-red-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-black">TOTAL LIABILITIES</span>
                <span className="text-xl font-bold text-red-700">
                  {formatCurrency(localBalanceSheet.liabilities.totalLiabilities)}
                </span>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              SHAREHOLDERS' FUNDS
            </h4>
            
            <div className="space-y-3">
              {/* Share Capital - Manual Input (CHANGED FROM AUTO) */}
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-black">Share Capital</label>
                <input
                  type="number"
                  step="0.01"
                  value={localBalanceSheet.equity.shareCapital || ''}
                  onChange={(e) => handleInputChange('equity', 'shareCapital', e.target.value)}
                  className="w-32 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 text-black text-right"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 text-right">
                {manualInputs['equity-shareCapital'] !== undefined ? "Manual Input" : "Auto-calculated"}
              </p>

              {/* Retained Earnings - From API */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-black">Retained Earnings</span>
                <span className={`font-bold ${localBalanceSheet.equity.retainedEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(localBalanceSheet.equity.retainedEarnings)}
                </span>
              </div>

              <div className="h-px bg-gray-300 my-2"></div>
              
              <div className="flex justify-between items-center font-semibold">
                <span className="text-black">Total Equity</span>
                <span className="text-green-600">
                  {formatCurrency(localBalanceSheet.equity.totalEquity)}
                </span>
              </div>
            </div>
          </div>

          {/* Net Assets & Total Liabilities + Equity */}
          <div className="space-y-4">
            {/* Net Assets */}
            <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-black">NET ASSETS</span>
                <span className="text-xl font-bold text-green-700">
                  {formatCurrency(localBalanceSheet.netAssets)}
                </span>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-black">TOTAL LIABILITIES & EQUITY</span>
                <span className="text-xl font-bold text-gray-700">
                  {formatCurrency(localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Check */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-black text-sm">Balance Check: Assets = Liabilities + Equity</span>
            <p className="text-xs text-gray-600 mt-1">
              Total Assets: {formatCurrency(localBalanceSheet.assets.totalAssets)} = 
              Total Liabilities: {formatCurrency(localBalanceSheet.liabilities.totalLiabilities)} + 
              Total Equity: {formatCurrency(localBalanceSheet.equity.totalEquity)}
            </p>
            {Object.keys(manualInputs).length > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                Includes {Object.keys(manualInputs).length} manual input(s)
                {manualInputs['equity-shareCapital'] !== undefined && " (including share capital)"}
              </p>
            )}
          </div>
          {isBalanced ? (
            <span className="flex items-center gap-2 text-green-600 font-semibold text-sm bg-green-100 px-3 py-1 rounded-full">
              ✓ Perfectly Balanced
            </span>
          ) : (
            <span className="flex items-center gap-2 text-red-600 font-semibold text-sm bg-red-100 px-3 py-1 rounded-full">
              ✗ Not Balanced - Difference: {formatCurrency(
                Math.abs(localBalanceSheet.assets.totalAssets - (localBalanceSheet.liabilities.totalLiabilities + localBalanceSheet.equity.totalEquity))
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}