"use client";
import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Clock, CheckCircle, DollarSign, Download, Star, TrendingDown, Briefcase } from "lucide-react";

type Product = {
  id: number;
  name: string;
  productionCost?: number;
};

type Order = {
  id: number;
  productId: number | null;
  product?: Product | null;
  quantity: number;
  amount: number;
  status: string;
  createdAt: string;
};

type Expense = {
  id: number;
  amount: number;
  title: string;
  category: string;
};

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const [salesRes, expensesRes] = await Promise.all([
        fetch("/api/sales"),
        fetch("/api/expenses"),
      ]);

      const salesData = await salesRes.json();
      const expensesData: Expense[] = await expensesRes.json();

      // Transform sales data to match Order structure
      const ordersData: Order[] = salesData.flatMap((sale: any) => 
        sale.saleitem.map((item: any) => ({
          id: sale.id,
          productId: item.productId,
          product: item.product,
          quantity: item.quantity,
          amount: item.quantity * Number(item.price),
          status: sale.status || "PAID",
          createdAt: sale.createdAt,
        }))
      );

      setOrders(ordersData);
      setExpenses(expensesData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);

  // ✅ Financial calculations
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;
  const paidOrders = orders.filter((o) => o.status === "PAID").length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // ✅ Calculate production costs based on items sold (quantity × production cost)
  const totalProductionCosts = orders.reduce((sum, order) => {
    if (order.product && order.product.productionCost) {
      return sum + (order.product.productionCost * order.quantity);
    }
    return sum;
  }, 0);

  const netProfit = totalRevenue - totalProductionCosts - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

  // ✅ Top products
  const productCount: Record<string, number> = {};
  orders.forEach((o) => {
    const name = o.product?.name || "Unknown Product";
    productCount[name] = (productCount[name] || 0) + o.quantity;
  });
  const topProducts = Object.entries(productCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // ✅ Download Excel report
  const handleDownload = () => {
    window.open("/api/reports", "_blank");
  };

  interface StatCardProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string | number;
    color: string;
    bgColor: string;
    textColor: string;
    subtitle?: string;
  }

  const StatCard = ({ icon: Icon, title, value, color, bgColor, textColor, subtitle }: StatCardProps) => (
    <div className={`${bgColor} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Loading your reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Financial Reports
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Monitor your business performance and profitability</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={ShoppingCart}
            title="Total Sales"
            value={`KES ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
            bgColor="bg-white hover:bg-blue-50"
            textColor="text-gray-800"
            subtitle={`${totalOrders} orders`}
          />
          <StatCard
            icon={Briefcase}
            title="Production Costs"
            value={`KES ${totalProductionCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            color="bg-gradient-to-r from-orange-500 to-orange-600"
            bgColor="bg-white hover:bg-orange-50"
            textColor="text-gray-800"
            subtitle="Based on items sold"
          />
          <StatCard
            icon={TrendingDown}
            title="Expenses"
            value={`KES ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            color="bg-gradient-to-r from-red-500 to-red-600"
            bgColor="bg-white hover:bg-red-50"
            textColor="text-gray-800"
            subtitle={`${expenses.length} expenses`}
          />
          <StatCard
            icon={DollarSign}
            title="Net Profit"
            value={`KES ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            color={netProfit >= 0 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-red-600"}
            bgColor={netProfit >= 0 ? "bg-white hover:bg-emerald-50" : "bg-white hover:bg-red-50"}
            textColor={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
            subtitle={`${profitMargin.toFixed(1)}% margin`}
          />
        </div>

        {/* Profit Analysis + Order Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Profit Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Profit Analysis</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="font-medium text-gray-700">Total Sales</span>
                <span className="text-lg font-bold text-green-600">
                  +KES {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
                <span className="font-medium text-gray-700">Production Costs</span>
                <span className="text-lg font-bold text-orange-600">
                  -KES {totalProductionCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                <span className="font-medium text-gray-700">Operating Expenses</span>
                <span className="text-lg font-bold text-red-600">
                  -KES {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-px bg-gray-300 my-2"></div>
              <div className={`flex justify-between items-center p-4 rounded-lg ${netProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <span className="font-bold text-gray-800 text-lg">Net Profit</span>
                <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  KES {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Order Status */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Order Status</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-700">Total Orders</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{totalOrders}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-gray-700">Completed</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">{paidOrders}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-gray-700">Pending</span>
                </div>
                <span className="text-lg font-bold text-amber-600">{pendingOrders}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    {totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Top Products */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Top Selling Products</h2>
            </div>
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map(([name, qty], index) => {
                  const safeQty = isNaN(Number(qty)) ? 0 : Number(qty);
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              index === 0
                                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                : index === 1
                                ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                                : index === 2
                                ? 'bg-gradient-to-r from-amber-600 to-amber-700'
                                : 'bg-gradient-to-r from-blue-400 to-blue-500'
                            }`}
                          >
                            #{index + 1}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{name}</h3>
                          <p className="text-sm text-gray-600">Product</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-800">{safeQty}</p>
                        <p className="text-sm text-gray-600">units sold</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No products data available</p>
              </div>
            )}
          </div>
            
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Quick Actions</h2>
            <div className="space-y-4">
              <button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                <Download className="w-5 h-5" />
                Download Excel Report
              </button>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Key Metrics</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Profit Margin:</span>
                    <span className={`font-medium ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {profitMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Order Value:</span>
                    <span className="font-medium text-blue-600">
                      KES {totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost Ratio:</span>
                    <span className="font-medium text-orange-600">
                      {totalRevenue > 0 ? (((totalProductionCosts + totalExpenses) / totalRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}