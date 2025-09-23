"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Receipt, 
  Package, 
  ShoppingCart, 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings,
  ChevronRight,
  Activity,
  DollarSign
} from "lucide-react";

export default function AdminDashboard() {
  const [quickStats, setQuickStats] = useState<any[]>([
    {
      title: "Today's Revenue",
      value: "KSh 0",
      change: "+0%",
      icon: DollarSign,
      positive: true
    },
    {
      title: "Active Orders",
      value: "0",
      change: "+0",
      icon: ShoppingCart,
      positive: true
    },
    {
      title: "Low Stock Items",
      value: "0",
      change: "-0",
      icon: Package,
      positive: true
    },
    {
      title: "System Health",
      value: "99.8%",
      change: "Excellent",
      icon: Activity,
      positive: true
    }
  ]);

  const adminSections = [
    {
      title: "Sales",
      description: "View and manage all sales records and transactions.",
      href: "/admin/sales",
      icon: TrendingUp,
      color: "bg-emerald-500",
      stats: "↑ 12% this month"
    },
    {
      title: "Expenses",
      description: "Track and manage expenses and payments efficiently.",
      href: "/admin/expenses",
      icon: Receipt,
      color: "bg-red-500",
      stats: "KSh 45,230 this month"
    },
   
    {
      title: "Orders",
      description: "Track customer orders and fulfillment status.",
      href: "/admin/orders",
      icon: ShoppingCart,
      color: "bg-orange-500",
      stats: "15 pending orders"
    },
    {
      title: "Customers",
      description: "Manage customer relationships and information.",
      href: "/admin/customers",
      icon: Users,
      color: "bg-purple-500",
      stats: "1,247 total customers"
    },
    {
      title: "Reports",
      description: "Generate comprehensive business analytics.",
      href: "/admin/reports",
      icon: BarChart3,
      color: "bg-teal-500",
      stats: "8 reports available"
    },

    {
      title: "Products",
      description: "View all your products in one place.",
      href: "/admin/products",
      icon: Package,
      color: "bg-gray-600",
      stats: "Last updated 2d ago"
    },
     {
    title: "Catalog",
    description: "Manage products shown to customers & visitors.",
    href: "/admin/catalog-products",
    icon: Package, // we can swap with an image icon if you prefer
    color: "bg-blue-500",
    stats: "Public-facing items"
  },
  ];

  useEffect(() => {
    const fetchQuickStats = async () => {
      try {
        const ordersRes = await fetch("/api/orders");
        const orders = await ordersRes.json();

        const productsRes = await fetch("/api/products");
        const products = await productsRes.json();

        const today = new Date();
        const todayRevenue = orders
          .filter((o: any) => new Date(o.createdAt).toDateString() === today.toDateString())
          .reduce((sum: number, o: any) => sum + o.amount, 0);

        const activeOrders = orders.filter((o: any) => o.status === "PENDING").length;
        const lowStockItems = products.filter((p: any) => p.stock <= 5).length;

        setQuickStats([
          {
            title: "Today's Revenue",
            value: `KSh ${todayRevenue.toLocaleString()}`,
            change: "+0%", // optional
            icon: DollarSign,
            positive: true
          },
          {
            title: "Active Orders",
            value: activeOrders.toString(),
            change: "+0",
            icon: ShoppingCart,
            positive: true
          },
          {
            title: "Low Stock Items",
            value: lowStockItems.toString(),
            change: lowStockItems <= 5 ? "-0" : "+0",
            icon: Package,
            positive: lowStockItems > 0
          },
          {
            title: "System Health",
            value: "99.8%",
            change: "Excellent",
            icon: Activity,
            positive: true
          }
        ]);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      }
    };

    fetchQuickStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                SWIFT METALS
                <span className="text-blue-600 ml-2">Admin Dashboard</span>
              </h1>
              <p className="text-slate-600 text-lg">
                Welcome back! Here's what's happening with your business today.
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-slate-500">Last Login</div>
                <div className="text-slate-900 font-medium">Today, </div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                ADMIN
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-slate-900 mb-6">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickStats.map((stat) => (
              <div key={stat.title} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.positive ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                    <stat.icon className={`w-6 h-6 ${stat.positive ? 'text-emerald-600' : 'text-orange-600'}`} />
                  </div>
                  <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                    stat.positive 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {stat.change}
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-slate-600 text-sm">{stat.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Navigation */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-6">Management Sections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {adminSections.map((section) => (
              <Link
                key={section.title}
                href={section.href}
                className="group bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:scale-105 transition-all duration-300 ease-out"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${section.color} shadow-sm`}>
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-200" />
                </div>
                
                <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors duration-200">
                  {section.title}
                </h3>
                
                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                  {section.description}
                </p>
                
                <div className="text-xs font-medium text-slate-500 bg-slate-50 rounded-full px-3 py-1 inline-block">
                  {section.stats}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-12">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-slate-600 text-sm mb-4 md:mb-0">
              © 2024 SwiftSales. All rights reserved. | System Version 2.1.4
            </div>
            <div className="flex items-center space-x-6 text-sm text-slate-500">
              <button className="hover:text-slate-700 transition-colors">Support</button>
              <button className="hover:text-slate-700 transition-colors">Documentation</button>
              <button className="hover:text-slate-700 transition-colors">Updates</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
