"use client";
import { useEffect, useState, useMemo } from "react";
import { Package, Download, Search, X } from "lucide-react";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalValue: number;
  supplier?: string;
  dateAdded: string;
};

type InventoryStats = {
  inventoryValue: number;
  estimatedInventoryValue: number;
  potentialProfit: number;
};

type RestockHistoryItem = {
  id: number;
  productId: number;
  quantity: number;
  costPrice: number;
  totalCost: number;
  paymentSource: string;
  createdAt: string;
  creditor?: {
    name: string;
  };
  product?: {
    name: string;
  };
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryHistory, setInventoryHistory] = useState<RestockHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<InventoryStats>({
    inventoryValue: 0,
    estimatedInventoryValue: 0,
    potentialProfit: 0,
  });

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      
      const [stockData] = await Promise.all([
        safeFetch("/api/stock"),
      ]);

      const stockArray = Array.isArray(stockData) ? stockData : stockData?.data || [];
      
      // Process inventory items
      const invItems: InventoryItem[] = stockArray.map((item: any) => {
        const quantity = Number(item?.quantity || 0);
        const costPrice = Number(item?.costPrice || 0);
        const sellingPrice = Number(item?.sellingPrice || 0);
        
        return {
          id: item?.id || 0,
          name: item?.name || "Item",
          quantity,
          costPrice,
          sellingPrice,
          totalValue: quantity * costPrice,
          supplier: item?.supplier || "",
          dateAdded: item?.createdAt || new Date().toISOString(),
        };
      });

      // Calculate stats
      const totalInventoryValue = invItems.reduce((sum, item) => sum + item.totalValue, 0);
      const estimatedInventoryValue = invItems.reduce((sum, item) => {
        return sum + (item.quantity * item.sellingPrice);
      }, 0);
      const potentialProfit = estimatedInventoryValue - totalInventoryValue;

      setInventory(invItems);
      setStats({
        inventoryValue: totalInventoryValue,
        estimatedInventoryValue,
        potentialProfit,
      });
    } catch (err) {
      console.error("Failed to fetch inventory data:", err);
      alert(`Error loading inventory data: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const safeFetch = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed to fetch ${url} - Status: ${res.status}`);
        return [];
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`Network error fetching ${url}:`, err);
      return [];
    }
  };

  const fetchInventoryHistory = async (productId: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/restock');
      if (!res.ok) {
        console.error(`Failed to fetch restock history - Status: ${res.status}`);
        setInventoryHistory([]);
        return;
      }
      const data = await res.json();
      
      // Handle the API response structure - your API returns { success: true, restocks: [...] }
      const allRestocks = data?.restocks || [];
      
      // Debug: Log the data to see the actual structure
      console.log('All restocks:', allRestocks);
      console.log('Looking for productId:', productId);
      
      // Filter restocks for this specific product
      const productRestocks = allRestocks.filter((restock: any) => {
        // Check both possible locations for productId
        const restockProductId = restock.productId || restock.product?.id;
        console.log('Restock productId:', restockProductId, 'Match:', restockProductId === productId);
        return restockProductId === productId;
      });
      
      console.log('Filtered restocks:', productRestocks);
      setInventoryHistory(productRestocks);
    } catch (error) {
      console.error('Error fetching restock history:', error);
      setInventoryHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewItemDetails = (item: InventoryItem) => {
    setSelectedInventoryItem(item);
    fetchInventoryHistory(item.id);
  };

  const downloadInventoryReport = () => {
    const csvContent = [
      ["Item Name", "Supplier", "Quantity", "Cost Price", "Selling Price", "Total Cost Value", "Total Selling Value", "Markup %", "Date Added"],
      ...inventory.map(item => {
        const markup = Number(item.sellingPrice || 0) > 0 && Number(item.costPrice || 0) > 0
          ? ((Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) / Number(item.costPrice || 0) * 100).toFixed(1)
          : "0.0";
        return [
          item.name || "Unknown",
          item.supplier || "N/A",
          item.quantity || 0,
          Number(item.costPrice || 0).toFixed(2),
          Number(item.sellingPrice || 0).toFixed(2),
          Number(item.totalValue || 0).toFixed(2),
          (item.quantity * item.sellingPrice).toFixed(2),
          markup,
          new Date(item.dateAdded).toLocaleDateString()
        ];
      })
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadItemHistory = (item: InventoryItem) => {
    const csvContent = [
      ["Item History Report"],
      [`Item: ${item.name}`],
      [`Current Quantity: ${item.quantity}`],
      [`Cost Price: KES ${Number(item.costPrice || 0).toFixed(2)}`],
      [`Selling Price: KES ${Number(item.sellingPrice || 0).toFixed(2)}`],
      [""],
      ["Restock History"],
      ["Date", "Quantity Added", "Cost Price", "Total Cost", "Supplier", "Payment Source"],
      ...inventoryHistory.map(record => [
        new Date(record?.createdAt).toLocaleDateString(),
        record?.quantity || 0,
        Number(record?.costPrice || 0).toFixed(2),
        Number(record?.totalCost || 0).toFixed(2),
        record?.creditor?.name || "N/A",
        record?.paymentSource || "N/A"
      ])
    ].map(row => Array.isArray(row) ? row.map(cell => `"${cell}"`).join(",") : `"${row}"`).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name.replace(/[^a-z0-9]/gi, '-')}-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Memoized filtered inventory
  const filteredInventory = useMemo(() =>
    inventory.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [inventory, searchTerm]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-base sm:text-lg font-medium text-gray-600">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Inventory Management</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600">Complete stock tracking and inventory control</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Inventory Cost Value</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total cost invested</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Potential Revenue</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.estimatedInventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">If all inventory sold</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-600">Potential Profit</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-all">
              KES {Number(stats.potentialProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{inventory.length} items in stock</p>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <button
              onClick={downloadInventoryReport}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4" />
              Download Full Report
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Supplier</th>
                  <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700">Quantity</th>
                  <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">Cost Price</th>
                  <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Selling Price</th>
                  <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700">Total Value</th>
                  <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Markup</th>
                  <th className="text-center p-3 text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item, idx) => {
                  const markup = Number(item.sellingPrice || 0) > 0 && Number(item.costPrice || 0) > 0
                    ? ((Number(item.sellingPrice || 0) - Number(item.costPrice || 0)) / Number(item.costPrice || 0) * 100)
                    : 0;
                  
                  return (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                      <td className="p-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm break-words">{item.name}</p>
                          <p className="text-xs text-gray-500">Added: {new Date(item.dateAdded).toLocaleDateString()}</p>
                        </div>
                      </td>
                      <td className="p-3 text-xs sm:text-sm text-gray-600 hidden md:table-cell">{item.supplier || "N/A"}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.quantity > 10 ? "bg-green-100 text-green-800" :
                          item.quantity > 5 ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-700 text-xs sm:text-sm hidden lg:table-cell break-all">
                        KES {Number(item.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-900 text-xs sm:text-sm hidden sm:table-cell break-all">
                        KES {Number(item.sellingPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-600 text-xs sm:text-sm break-all">
                        KES {Number(item.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right hidden md:table-cell">
                        <span className={`font-semibold text-xs sm:text-sm ${markup > 30 ? 'text-green-600' : markup > 15 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {markup.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleViewItemDetails(item)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded text-xs transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredInventory.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-sm sm:text-base">No inventory items found</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Item Details Modal */}
        {selectedInventoryItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 flex justify-between items-start">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">{selectedInventoryItem.name}</h2>
                  <p className="text-sm opacity-90">Product ID: {selectedInventoryItem.id}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedInventoryItem(null);
                    setInventoryHistory([]);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xs text-gray-600 mb-1">Current Quantity</p>
                    <p className="text-2xl font-bold text-blue-600">{selectedInventoryItem.quantity}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">Cost Price</p>
                    <p className="text-xl font-bold text-green-600">
                      KES {Number(selectedInventoryItem.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <p className="text-xs text-gray-600 mb-1">Selling Price</p>
                    <p className="text-xl font-bold text-purple-600">
                      KES {Number(selectedInventoryItem.sellingPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <p className="text-xs text-gray-600 mb-1">Total Cost Value</p>
                    <p className="text-xl font-bold text-amber-600">
                      KES {Number(selectedInventoryItem.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Restock History</h3>
                  <button
                    onClick={() => downloadItemHistory(selectedInventoryItem)}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Report
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading history...</p>
                  </div>
                ) : inventoryHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-700">Date</th>
                          <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700">Quantity Added</th>
                          <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700">Cost Price</th>
                          <th className="text-right p-3 text-xs sm:text-sm font-semibold text-gray-700">Total Cost</th>
                          <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Supplier</th>
                          <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">Payment Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryHistory.map((record, idx) => (
                          <tr key={record.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                            <td className="p-3 text-xs sm:text-sm text-gray-900">
                              {new Date(record.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-semibold text-green-600 text-xs sm:text-sm">
                                +{record.quantity}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700 text-xs sm:text-sm">
                              KES {Number(record.costPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700 text-xs sm:text-sm">
                              KES {Number(record.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-xs sm:text-sm text-gray-600 hidden sm:table-cell">
                              {record.creditor?.name || "N/A"}
                            </td>
                            <td className="p-3 text-xs sm:text-sm text-gray-600 hidden md:table-cell">
                              {record.paymentSource}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No restock history found for this item</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-gray-500 text-xs sm:text-sm mt-8">
          <p>Inventory Management System • Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}