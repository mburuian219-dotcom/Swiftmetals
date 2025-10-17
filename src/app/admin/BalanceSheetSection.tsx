import { TrendingUp, CreditCard, DollarSign, Download } from "lucide-react";

type BalanceSheet = {
  assets: {
    currentAssets: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      total: number;
    };
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: {
      accountsPayable: number;
      total: number;
    };
    totalLiabilities: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  date: string;
};

type BalanceSheetSectionProps = {
  balanceSheet: BalanceSheet;
  onDownload: () => void;
};

export default function BalanceSheetSection({ balanceSheet, onDownload }: BalanceSheetSectionProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Balance Sheet</h3>
          <p className="text-xs sm:text-sm text-gray-600">As of {new Date(balanceSheet.date).toLocaleDateString()}</p>
        </div>
        <button
          onClick={onDownload}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border-2 border-blue-200">
          <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            ASSETS
          </h4>
          
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Current Assets</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-gray-700">Cash</span>
                  <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-gray-700">A/R</span>
                  <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.accountsReceivable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-gray-700">Inventory</span>
                  <span className="font-bold break-all">{Number(balanceSheet.assets.currentAssets.inventory || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-gray-300 my-2"></div>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="font-semibold text-gray-800">Total Current Assets</span>
                  <span className="font-bold text-base text-blue-600 break-all">
                    {Number(balanceSheet.assets.currentAssets.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-100 rounded-lg p-3 sm:p-4 border-2 border-blue-300">
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL ASSETS</span>
                <span className="text-lg sm:text-xl font-bold text-blue-700 break-all">
                  {Number(balanceSheet.assets.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 sm:p-6 border-2 border-red-200">
            <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              LIABILITIES
            </h4>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-semibold text-gray-600 mb-3">Current Liabilities</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-700">A/P</span>
                    <span className="font-bold break-all">
                      {Number(balanceSheet.liabilities.currentLiabilities.accountsPayable || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-gray-300 my-2"></div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="font-semibold text-gray-800">Total Current Liabilities</span>
                    <span className="font-bold text-base text-red-600 break-all">
                      {Number(balanceSheet.liabilities.currentLiabilities.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-red-100 rounded-lg p-3 sm:p-4 border-2 border-red-300">
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL LIABILITIES</span>
                  <span className="text-lg sm:text-xl font-bold text-red-700 break-all">
                    {Number(balanceSheet.liabilities.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 sm:p-6 border-2 border-green-200">
            <h4 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              EQUITY
            </h4>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-3 sm:p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-700">Capital</span>
                    <span className="font-bold break-all">
                      {Number(balanceSheet.equity.capital || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-gray-700">Retained Earnings</span>
                    <span className={`font-bold break-all ${balanceSheet.equity.retainedEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(balanceSheet.equity.retainedEarnings || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-gray-300 my-2"></div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="font-semibold text-gray-800">Total Equity</span>
                    <span className="font-bold text-base text-green-600 break-all">
                      {Number(balanceSheet.equity.totalEquity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-100 rounded-lg p-3 sm:p-4 border-2 border-green-300">
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-bold text-gray-800">TOTAL LIAB & EQUITY</span>
                  <span className="text-lg sm:text-xl font-bold text-green-700 break-all">
                    {(Number(balanceSheet.liabilities.totalLiabilities || 0) + Number(balanceSheet.equity.totalEquity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="font-semibold text-gray-700 text-sm">Balance Check: Assets = Liabilities + Equity</span>
          {Math.abs(balanceSheet.assets.totalAssets - (balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity)) < 0.01 ? (
            <span className="flex items-center gap-2 text-green-600 font-semibold text-sm">
              ✓ Balanced
            </span>
          ) : (
            <span className="flex items-center gap-2 text-red-600 font-semibold text-sm">
              ✗ Not Balanced
            </span>
          )}
        </div>
      </div>
    </div>
  );
}