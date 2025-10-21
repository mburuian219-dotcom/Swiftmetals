"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  TrendingUp,
  Receipt,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Activity,
  DollarSign,
  ChevronRight,
  Bell,
  X,
  AlertTriangle,
  Info,
  CheckCircle
} from "lucide-react";

export default function AdminDashboard() {
  const [quickStats, setQuickStats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const adminSections = [
    {
      title: "Sales",
      description: "View and manage all sales records and transactions.",
      href: "/admin/sales",
      icon: TrendingUp,
      color: "bg-emerald-500",
      stats: "↑ 12% this month",
    },
    {
      title: "Expenses",
      description: "Track and manage expenses and payments efficiently.",
      href: "/admin/expenses",
      icon: Receipt,
      color: "bg-red-500",
      stats: "KSh 45,230 this month",
    },
    {
      title: "Orders",
      description: "Track customer orders and fulfillment status.",
      href: "/admin/orders",
      icon: ShoppingCart,
      color: "bg-orange-500",
      stats: "15 pending orders",
    },
    {
      title: "Customers",
      description: "Manage customer relationships and information.",
      href: "/admin/customers",
      icon: Users,
      color: "bg-purple-500",
      stats: "1,247 total customers",
    },
    {
      title: "Reports",
      description: "Generate comprehensive business analytics.",
      href: "/admin/reports",
      icon: BarChart3,
      color: "bg-teal-500",
      stats: "8 reports available",
    },
    {
      title: "Products",
      description: "View and manage your inventory.",
      href: "/admin/products",
      icon: Package,
      color: "bg-gray-600",
      stats: "Last updated 2d ago",
    },
    {
      title: "Catalog",
      description: "Manage products shown to customers & visitors.",
      href: "/admin/catalog-products",
      icon: Package,
      color: "bg-blue-500",
      stats: "Public-facing items",
    },
  ];

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Parallel fetch for better performance
      const [ordersRes, productsRes, salesRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/products"),
        fetch("/api/sales")
      ]);

      const [ordersText, productsText, salesText] = await Promise.all([
        ordersRes.text(),
        productsRes.text(),
        salesRes.text()
      ]);

      const orders = ordersText ? JSON.parse(ordersText) : [];
      const products = productsText ? JSON.parse(productsText) : [];
      const sales = salesText ? JSON.parse(salesText) : [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Optimized calculations - check multiple date fields and amount fields
      console.log("Total sales records:", sales.length);
      console.log("Sample sale:", sales[0]); // Debug: see the structure
      
      const todayRevenue = sales
        .filter((s: any) => {
          // Try multiple possible date fields
          const dateStr = s.createdAt || s.saleDate || s.date || s.created_at;
          if (!dateStr) return false;
          
          const saleDate = new Date(dateStr);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime();
        })
        .reduce((sum: number, s: any) => {
          // Try multiple possible amount fields
          const amount = s.totalAmount || s.total || s.amount || s.total_amount || 0;
          return sum + amount;
        }, 0);
      
      console.log("Today's revenue calculated:", todayRevenue);

      const activeOrders = orders.filter(
        (o: any) => o.status === "PENDING"
      ).length;

      const lowStockItems = products.filter(
        (p: any) => (p.stock?.[0]?.quantity || 0) <= 5
      );

      const criticalStockItems = products.filter(
        (p: any) => (p.stock?.[0]?.quantity || 0) === 0
      );

      // Enhanced notifications with priority levels
      const newNotifications: any[] = [];

      // Critical notifications first
      if (criticalStockItems.length > 0) {
        newNotifications.push({
          id: `critical-stock-${Date.now()}`,
          type: "critical",
          priority: 1,
          icon: AlertTriangle,
          title: "Out of Stock Alert",
          message: `${criticalStockItems.length} product${criticalStockItems.length > 1 ? 's are' : ' is'} out of stock`,
          details: criticalStockItems.slice(0, 3).map((i: any) => i.name).join(", ") + 
                   (criticalStockItems.length > 3 ? ` and ${criticalStockItems.length - 3} more` : ""),
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      // Warning notifications
      if (lowStockItems.length > 0 && criticalStockItems.length < lowStockItems.length) {
        newNotifications.push({
          id: `low-stock-${Date.now()}`,
          type: "warning",
          priority: 2,
          icon: AlertTriangle,
          title: "Low Stock Warning",
          message: `${lowStockItems.length - criticalStockItems.length} product${lowStockItems.length - criticalStockItems.length > 1 ? 's are' : ' is'} running low`,
          details: lowStockItems
            .filter((i: any) => (i.stock?.[0]?.quantity || 0) > 0)
            .slice(0, 3)
            .map((i: any) => `${i.name} (${i.stock?.[0]?.quantity || 0} left)`)
            .join(", "),
          link: "/admin/products",
          timestamp: new Date().toISOString(),
        });
      }

      // Info notifications
      if (activeOrders > 0) {
        newNotifications.push({
          id: `pending-orders-${Date.now()}`,
          type: "info",
          priority: 3,
          icon: ShoppingCart,
          title: "Pending Orders",
          message: `${activeOrders} order${activeOrders > 1 ? 's' : ''} awaiting processing`,
          details: "Review and process pending orders to maintain customer satisfaction",
          link: "/admin/orders",
          timestamp: new Date().toISOString(),
        });
      }

      const newOrdersToday = orders.filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === today.getTime();
      });

      if (newOrdersToday.length > 0) {
        newNotifications.push({
          id: `new-orders-${Date.now()}`,
          type: "success",
          priority: 4,
          icon: CheckCircle,
          title: "New Orders Today",
          message: `${newOrdersToday.length} new order${newOrdersToday.length > 1 ? 's' : ''} received`,
          details: `Total value: KSh ${newOrdersToday.reduce((sum: number, o: any) => sum + (o.amount || 0), 0).toLocaleString()}`,
          link: "/admin/orders",
          timestamp: new Date().toISOString(),
        });
      }

      // Sort by priority
      newNotifications.sort((a, b) => a.priority - b.priority);

      setNotifications(newNotifications);

      setQuickStats([
        {
          title: "Today's Revenue",
          value: `KSh ${todayRevenue.toLocaleString()}`,
          change: "+0%",
          icon: DollarSign,
          positive: true,
        },
        {
          title: "Active Orders",
          value: activeOrders.toString(),
          change: `${activeOrders} pending`,
          icon: ShoppingCart,
          positive: true,
        },
        {
          title: "Low Stock Items",
          value: lowStockItems.length.toString(),
          change: criticalStockItems.length > 0 ? `${criticalStockItems.length} critical` : "Good",
          icon: Package,
          positive: lowStockItems.length === 0,
        },
        {
          title: "System Health",
          value: "99.8%",
          change: "Excellent",
          icon: Activity,
          positive: true,
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      setNotifications([{
        id: `error-${Date.now()}`,
        type: "critical",
        priority: 1,
        icon: AlertTriangle,
        title: "System Error",
        message: "Failed to load dashboard data",
        details: "Please refresh the page or contact support if the issue persists",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
        };
      case "warning":
        return {
          bg: "bg-orange-50",
          border: "border-orange-200",
          text: "text-orange-700",
          iconBg: "bg-orange-100",
          iconColor: "text-orange-600",
        };
      case "success":
        return {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-700",
          iconBg: "bg-emerald-100",
          iconColor: "text-emerald-600",
        };
      default:
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
        };
    }
  };

  const notificationCount = useMemo(() => notifications.length, [notifications]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 truncate">
                SWIFT METALS <span className="text-blue-600">Admin</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-600 mt-1">Your business at a glance</p>
            </div>

            {/* Notification Button */}
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 sm:p-2.5 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>

                {/* Notification Panel - Mobile Optimized */}
                {showNotifications && (
                  <>
                    {/* Backdrop for mobile */}
                    <div 
                      className="fixed inset-0 bg-black/20 z-40 md:hidden"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    <div className="fixed inset-x-4 top-20 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 w-auto md:w-96 bg-white shadow-2xl rounded-xl border border-slate-200 z-50 max-h-[calc(100vh-6rem)] md:max-h-[600px] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                            Notifications
                          </h3>
                          {notificationCount > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              {notificationCount}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowNotifications(false)}
                          className="text-slate-500 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                          aria-label="Close notifications"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                            <Bell className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-slate-600 font-medium">All caught up!</p>
                          <p className="text-slate-500 text-sm text-center mt-1">
                            No new notifications at the moment
                          </p>
                        </div>
                      ) : (
                        <ul className="overflow-y-auto flex-1">
                          {notifications.map((note) => {
                            const styles = getNotificationStyles(note.type);
                            const Icon = note.icon || Info;
                            
                            return (
                              <li
                                key={note.id}
                                className={`px-4 py-4 border-b last:border-none hover:bg-slate-50 transition-colors ${styles.bg}`}
                              >
                                <div className="flex gap-3">
                                  <div className={`${styles.iconBg} p-2 rounded-lg h-fit`}>
                                    <Icon className={`w-5 h-5 ${styles.iconColor}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-semibold text-sm mb-1 ${styles.text}`}>
                                      {note.title}
                                    </p>
                                    <p className="text-slate-700 text-sm mb-1">
                                      {note.message}
                                    </p>
                                    {note.details && (
                                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                                        {note.details}
                                      </p>
                                    )}
                                    {note.link && (
                                      <Link
                                        href={note.link}
                                        onClick={() => setShowNotifications(false)}
                                        className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                      >
                                        View details
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <div className="hidden md:block text-right text-sm">
                  <div className="text-slate-500">Last Login</div>
                  <div className="font-medium text-slate-800">Today</div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  ADM
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4 sm:mb-6">
          Quick Overview
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 animate-pulse">
                <div className="h-12 bg-slate-200 rounded mb-3"></div>
                <div className="h-6 bg-slate-200 rounded mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {quickStats.map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div
                    className={`p-2 sm:p-3 rounded-lg ${
                      stat.positive ? "bg-emerald-100" : "bg-orange-100"
                    }`}
                  >
                    <stat.icon
                      className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        stat.positive ? "text-emerald-600" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                      stat.positive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 mb-1 truncate">
                  {stat.value}
                </div>
                <div className="text-slate-600 text-xs sm:text-sm">{stat.title}</div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Sections */}
        <div className="mt-8 sm:mt-12">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-4 sm:mb-6">
            Management Sections
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {adminSections.map((section) => (
              <Link
                key={section.title}
                href={section.href}
                className="group bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-lg hover:scale-105 transition-all"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-lg ${section.color}`}>
                    <section.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-slate-600 transition" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 truncate">
                  {section.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4 line-clamp-2">
                  {section.description}
                </p>
                <div className="text-xs font-medium text-slate-500 bg-slate-50 rounded-full px-2 sm:px-3 py-1 inline-block truncate max-w-full">
                  {section.stats}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}