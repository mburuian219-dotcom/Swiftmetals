"use client";
import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Clock, CheckCircle, DollarSign, Download, Star } from "lucide-react";

type Product = {
  id: number;
  name: string;
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

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/orders");
        const data: Order[] = await res.json();
        setOrders(data);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // Calculations for summary
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;
  const paidOrders = orders.filter((o) => o.status === "PAID").length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  // Top products
  const productCount: Record<string, number> = {};
  orders.forEach((o) => {
    const name = o.product?.name || "Unknown Product";
    productCount[name] = (productCount[name] || 0) + o.quantity;
  });
  
  const topProducts = Object.entries(productCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

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
  }

  const StatCard = ({ icon: Icon, title, value, color, bgColor, textColor }: StatCardProps) => (
    <div className={`${bgColor} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
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
              Business Reports
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Monitor your business performance and key metrics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={ShoppingCart}
            title="Total Orders"
            value={totalOrders.toLocaleString()}
            color="bg-gradient-to-r from-blue-500 to-blue-600"
            bgColor="bg-white hover:bg-blue-50"
            textColor="text-gray-800"
          />
          <StatCard
            icon={Clock}
            title="Pending Orders"
            value={pendingOrders.toLocaleString()}
            color="bg-gradient-to-r from-amber-500 to-amber-600"
            bgColor="bg-white hover:bg-amber-50"
            textColor="text-gray-800"
          />
          <StatCard
            icon={CheckCircle}
            title="Completed Orders"
            value={paidOrders.toLocaleString()}
            color="bg-gradient-to-r from-emerald-500 to-emerald-600"
            bgColor="bg-white hover:bg-emerald-50"
            textColor="text-gray-800"
          />
          <StatCard
            icon={DollarSign}
            title="Total Revenue"
            value={`KES ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            color="bg-gradient-to-r from-purple-500 to-purple-600"
            bgColor="bg-white hover:bg-purple-50"
            textColor="text-gray-800"
          />
        </div>

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
                {topProducts.map(([name, qty], index) => (
                  <div key={name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                          index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                          'bg-gradient-to-r from-blue-400 to-blue-500'
                        }`}>
                          #{index + 1}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{name}</h3>
                        <p className="text-sm text-gray-600">Product</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-800">{qty}</p>
                      <p className="text-sm text-gray-600">units sold</p>
                    </div>
                  </div>
                ))}
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
                <h3 className="font-semibold text-gray-800 mb-2">Report Summary</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-medium text-emerald-600">
                      {totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Rate:</span>
                    <span className="font-medium text-amber-600">
                      {totalOrders > 0 ? Math.round((pendingOrders / totalOrders) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg. Order Value:</span>
                    <span className="font-medium text-blue-600">
                      KES {totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
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