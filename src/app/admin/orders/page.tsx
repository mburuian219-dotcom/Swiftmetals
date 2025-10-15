
"use client";

import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Package, 
  Clock, 
  DollarSign,
  Edit3,
  Eye,
  Search,
  CheckCircle,
  Truck,
  Save,
  X,
} from "lucide-react";

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category?: string;
  stock?: number;
}

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface SaleItem {
  id?: number;
  quantity: number;
  price?: number;
  product?: Product;
}

type OrderStatus = "PENDING" | "PAID" | "DELIVERED" | "CANCELLED";

interface Order {
  id: number;
  items?: OrderItem[];
  saleItems?: SaleItem[];
  totalAmount?: number;
  amount?: number;
  status: OrderStatus;
  date: string;
  customer: { id: number; name: string };
  orderNumber?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("PENDING");
  
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, customersRes, productsRes] = await Promise.all([
          fetch("/api/orders", { cache: 'no-store' }),
          fetch("/api/customer", { cache: 'no-store' }),
          fetch("/api/products", { cache: 'no-store' })
        ]);

        const [ordersData, customersData, productsData] = await Promise.all([
          ordersRes.ok ? ordersRes.json() : null,
          customersRes.ok ? customersRes.json() : null,
          productsRes.ok ? productsRes.json() : null
        ]);

        if (ordersData) {
          setOrders(Array.isArray(ordersData) ? ordersData : []);
        }

        if (customersData) {
          const customerArray = Array.isArray(customersData) 
            ? customersData
            : customersData.data || customersData.customers || [];
          setCustomers(customerArray);
        }

        if (productsData) {
          setProducts(Array.isArray(productsData) ? productsData : []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setOrders([]);
        setCustomers([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      { productId: 0, productName: "", quantity: 1, price: 0, total: 0 }
    ]);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updatedItems = [...orderItems];
    const item = updatedItems[index];
    
    if (field === 'productId') {
      const productId = typeof value === 'string' ? parseInt(value) : value;
      const product = products.find(p => p.id === productId);
      if (product) {
        item.productId = product.id;
        item.productName = product.name;
        item.price = product.price;
        item.total = item.quantity * product.price;
      }
    } else if (field === 'quantity') {
      const quantity = typeof value === 'string' ? parseInt(value) : value;
      item.quantity = quantity || 0;
      item.total = item.quantity * item.price;
    } else if (field === 'productName') {
      item.productName = value as string;
    } else if (field === 'price') {
      const price = typeof value === 'string' ? parseFloat(value) : value;
      item.price = price || 0;
      item.total = item.quantity * item.price;
    } else if (field === 'total') {
      const total = typeof value === 'string' ? parseFloat(value) : value;
      item.total = total || 0;
    }
    
    setOrderItems(updatedItems);
  };

  const getTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handlePlaceOrder = async () => {
    if (!selectedCustomerId) {
      alert("Please select a customer");
      return;
    }

    if (orderItems.length === 0) {
      alert("Please add at least one item to the order");
      return;
    }

    const lowStockItems: string[] = [];
    const stockWarnings: string[] = [];
    
    orderItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product && product.stock !== undefined) {
        const currentStock = product.stock;
        const orderedQty = item.quantity;
        
        if (currentStock === 0) {
          lowStockItems.push(product.name);
          stockWarnings.push(
            `📦 ${product.name}:\n` +
            `   • Current Stock: 0\n` +
            `   • Ordered: ${orderedQty}\n` +
            `   • Need to Restock: ${orderedQty} units`
          );
        } else if (currentStock < orderedQty) {
          const shortage = orderedQty - currentStock;
          lowStockItems.push(product.name);
          stockWarnings.push(
            `📦 ${product.name}:\n` +
            `   • Current Stock: ${currentStock}\n` +
            `   • Ordered: ${orderedQty}\n` +
            `   • Additional Stock Needed: ${shortage} units`
          );
        }
      }
    });

    if (stockWarnings.length > 0) {
      const warningMessage = 
        `⚠️ LOW STOCK WARNING\n\n` +
        `${stockWarnings.join('\n\n')}\n\n` +
        `The order will be placed, but you'll need to restock these items to complete fulfillment.\n` +
        `Stock will be deducted only for available quantities (won't go negative).\n\n` +
        `Do you want to continue?`;
      
      if (!confirm(warningMessage)) {
        return;
      }
    }

    setIsPlacingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: orderItems,
          status: orderStatus,
          paymentMethod: "CASH",
        }),
      });

      if (response.ok) {
        const result = await response.json();

        const enrichedItems = result.saleitems?.map((it: any) => ({
          ...it,
          productName:
            it.product?.name ||
            products.find(p => p.id === it.productId)?.name ||
            "Unknown Product",
        }));

        const newOrder = { ...result, items: enrichedItems };
        setOrders(prev => [newOrder, ...prev]);

        const productsRes = await fetch("/api/products", { cache: 'no-store' });
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
        }

        setOrderItems([]);
        setSelectedCustomerId("");
        setOrderStatus("PENDING");
        setIsAddingOrder(false);
        
        if (lowStockItems.length > 0) {
          alert(
            "✅ Order placed successfully!\n\n" +
            "⚠️ STOCK UPDATE:\n" +
            `The following items need restocking: ${lowStockItems.join(', ')}\n\n` +
            "Stock has been deducted only for available quantities. " +
            "Please restock to complete order fulfillment."
          );
        } else {
          alert("✅ Order placed successfully!");
        }
      } else {
        alert("Failed to place order. Please try again.");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      alert("An error occurred while placing the order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });

      if (response.ok) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId
              ? { ...order, status: newStatus as OrderStatus }
              : order
          )
        );
        
        if (newStatus === "CANCELLED") {
          const productsRes = await fetch("/api/products", { cache: 'no-store' });
          if (productsRes.ok) {
            const productsData = await productsRes.json();
            setProducts(Array.isArray(productsData) ? productsData : []);
          }
          alert("Order cancelled successfully! Stock has been restored.");
        } else {
          alert("Order status updated successfully!");
        }
      } else {
        const data = await response.json();
        console.error("Failed to update order:", data.error);
        alert(`Failed to update order: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("An error occurred while updating the order status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const deleteOrder = async (orderId: number) => {
    if (!confirm("Are you sure you want to delete this order? Stock will be restored automatically.")) {
      return;
    }

    setIsDeletingOrder(true);
    try {
      const response = await fetch(`/api/orders?id=${orderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setOrders((prevOrders) => prevOrders.filter((order) => order.id !== orderId));
        
        const productsRes = await fetch("/api/products", { cache: 'no-store' });
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
        }
        
        alert("Order deleted successfully! Stock has been restored.");
      } else {
        const data = await response.json();
        alert(`Failed to delete order: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("An error occurred while deleting the order.");
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (order.items?.some(item => item.productName?.toLowerCase().includes(searchTerm.toLowerCase())) || false) ||
      (order.saleItems?.some(item => item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())) || false);

    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    const matchesDate = !dateFilter || order.date?.includes(dateFilter);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const pendingOrders = Array.isArray(orders) ? orders.filter(o => o.status === "PENDING").length : 0;
  const paidOrders = Array.isArray(orders) ? orders.filter(o => o.status === "PAID").length : 0;
  const deliveredOrders = Array.isArray(orders) ? orders.filter(o => o.status === "DELIVERED").length : 0;
  const totalRevenue = Array.isArray(orders) ? orders.filter(o => o.status === "PAID" || o.status === "DELIVERED")
                            .reduce((sum, order) => sum + (order.amount || order.totalAmount || 0), 0) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "text-orange-600 bg-orange-100";
      case "PAID": return "text-blue-600 bg-blue-100";
      case "DELIVERED": return "text-green-600 bg-green-100";
      case "CANCELLED": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/30 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-blue-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">Orders Management</h1>
          <p className="text-sm sm:text-base text-slate-600">Manage customer orders and track deliveries</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1">Total Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900">{totalOrders}</p>
              </div>
              <div className="p-2 sm:p-3 bg-slate-100 rounded-lg">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{pendingOrders}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1">Paid</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{paidOrders}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1">Delivered</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{deliveredOrders}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-100 col-span-2 sm:col-span-3 lg:col-span-1 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs sm:text-sm mb-1">Revenue</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600">KSh {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-2 sm:p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => setIsAddingOrder(!isAddingOrder)}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 font-semibold text-base sm:text-lg"
          >
            {isAddingOrder ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6" />}
            {isAddingOrder ? "Cancel Order" : "Place New Order"}
          </button>
        </div>


        {/* Add Order Form */}
        {isAddingOrder && (
          <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-slate-100 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Create New Order</h2>
            
            {/* Customer Selection */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-3 sm:p-4 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all duration-200 text-sm sm:text-base"
              >
                <option value="">Choose a customer...</option>
                {customers && customers.length > 0 ? (
                  customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No customers available</option>
                )}
              </select>
            </div>

            {/* Order Items */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Order Items
                </label>
                <button
                  onClick={addOrderItem}
                  className="w-full sm:w-auto bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex flex-col gap-3 p-3 sm:p-4 bg-slate-50 rounded-lg sm:rounded-xl">
                    {/* Product Selection */}
                    <div className="w-full">
                      <select
                        value={item.productId}
                        onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                        className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                      >
                        <option value="">Select product...</option>
                        {products && products.length > 0 ? (
                          products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} - KSh {product.price.toLocaleString()}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No products available</option>
                        )}
                      </select>
                    </div>

                    {/* Quantity, Price, Total */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                          className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                          placeholder="Qty"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price || ''}
                          onChange={(e) => updateOrderItem(index, 'price', e.target.value)}
                          className="w-full p-2 sm:p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                          placeholder="Price"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Total</label>
                        <input
                          type="text"
                          value={item.total ? `${item.total.toLocaleString()}` : ''}
                          readOnly
                          className="w-full p-2 sm:p-3 bg-gray-100 border border-slate-300 rounded-lg text-slate-600 font-semibold text-sm"
                          placeholder="Total"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => removeOrderItem(index)}
                          className="w-full p-2 sm:p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {orderItems.length === 0 && (
                  <div className="text-center py-6 sm:py-8 text-slate-500">
                    <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm sm:text-base">No items added yet. Click "Add Item" to get started.</p>
                  </div>
                )}
              </div>

              {/* Order Total */}
              {orderItems.length > 0 && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-emerald-50 rounded-lg sm:rounded-xl border-l-4 border-emerald-500">
                  <div className="flex justify-between items-center">
                    <span className="text-base sm:text-lg font-semibold text-slate-900">Order Total:</span>
                    <span className="text-xl sm:text-2xl font-bold text-emerald-600">
                      KSh {getTotalAmount().toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Order Status */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Order Status
              </label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                className="w-full sm:w-auto p-3 sm:p-4 border border-slate-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm sm:text-base"
              >
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacingOrder ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
                    Placing Order...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                    Place Order
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsAddingOrder(false);
                  setOrderItems([]);
                  setSelectedCustomerId("");
                  setOrderStatus("PENDING");
                }}
                disabled={isPlacingOrder}
                className="w-full sm:w-auto bg-slate-200 text-slate-700 px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl hover:bg-slate-300 transition-colors font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

       {/* Filters */}
<div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-slate-100 mb-6 sm:mb-8">
  <div className="flex flex-col gap-3 sm:gap-4">
    <div className="flex-1 relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
      <input
        type="text"
        placeholder="Search orders..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm sm:text-base text-black placeholder-slate-500"
      />
    </div>
    
    <div className="flex flex-col sm:flex-row gap-3">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-sm sm:text-base text-black"
      >
        <option value="ALL">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="PAID">Paid</option>
        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      
      <input
        type="date"
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm sm:text-base text-black"
      />
    </div>
  </div>
</div>

        {/* Orders Table - Desktop */}
        <div className="hidden lg:block bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Recent Orders</h2>
            <p className="text-slate-600 mt-1">Showing {filteredOrders.length} orders</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Order #</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Items</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Total Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {order.orderNumber || `ORD-${order.id.toString().padStart(3, "0")}`}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{order.customer.name}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {order.saleItems && order.saleItems.length > 0 ? (
                          order.saleItems.map((item: any, index: number) => (
                            <div key={index} className="text-sm text-slate-600">
                              {item.product?.name || "Unknown Product"} × {item.quantity}
                            </div>
                          ))
                        ) : order.items && order.items.length > 0 ? (
                          order.items.map((item: any, index: number) => (
                            <div key={index} className="text-sm text-slate-600">
                              {item.productName} × {item.quantity}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-400 italic">No items</div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-bold text-emerald-600 text-lg">
                      KSh {(order.amount || order.totalAmount || 0).toLocaleString()}
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        disabled={isUpdatingStatus}
                        className={`px-3 py-2 rounded-full text-sm font-semibold border-0 outline-none cursor-pointer ${getStatusColor(order.status)} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-slate-600">
                      {new Date(order.date).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setViewingOrder(order)}
                          disabled={isUpdatingStatus || isDeletingOrder}
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingOrder(order)}
                          disabled={isUpdatingStatus || isDeletingOrder}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit Order"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteOrder(order.id)}
                          disabled={isUpdatingStatus || isDeletingOrder}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No orders found</h3>
              <p className="text-slate-500">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Orders Cards - Mobile & Tablet */}
        <div className="lg:hidden space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Recent Orders</h2>
            <p className="text-slate-600 text-sm mt-1">Showing {filteredOrders.length} orders</p>
          </div>

          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
              {/* Order Header */}
              <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 text-lg">
                    {order.orderNumber || `ORD-${order.id.toString().padStart(3, "0")}`}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{order.customer.name}</p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                  disabled={isUpdatingStatus}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-0 outline-none cursor-pointer ${getStatusColor(order.status)} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Order Items */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Items</p>
                <div className="space-y-1">
                  {order.saleItems && order.saleItems.length > 0 ? (
                    order.saleItems.map((item: any, index: number) => (
                      <div key={index} className="text-sm text-slate-700 flex justify-between">
                        <span>{item.product?.name || "Unknown Product"}</span>
                        <span className="text-slate-500">× {item.quantity}</span>
                      </div>
                    ))
                  ) : order.items && order.items.length > 0 ? (
                    order.items.map((item: any, index: number) => (
                      <div key={index} className="text-sm text-slate-700 flex justify-between">
                        <span>{item.productName}</span>
                        <span className="text-slate-500">× {item.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-400 italic">No items</div>
                  )}
                </div>
              </div>

              {/* Order Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="text-lg font-bold text-emerald-600">
                    KSh {(order.amount || order.totalAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(order.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewingOrder(order)}
                    disabled={isUpdatingStatus || isDeletingOrder}
                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="View Details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingOrder(order)}
                    disabled={isUpdatingStatus || isDeletingOrder}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit Order"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    disabled={isUpdatingStatus || isDeletingOrder}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Order"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No orders found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* View Order Modal */}
        {viewingOrder && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold">
                  Order Details - #{viewingOrder.orderNumber || viewingOrder.id}
                </h2>
                <button
                  onClick={() => setViewingOrder(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer Info */}
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer</label>
                <p className="text-slate-900 font-semibold text-lg">{viewingOrder.customer.name}</p>
              </div>

              {/* Order Status */}
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Status</label>
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(viewingOrder.status)}`}>
                  {viewingOrder.status}
                </span>
              </div>

              {/* Order Items */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Order Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {viewingOrder.saleItems && viewingOrder.saleItems.length > 0 ? (
                    viewingOrder.saleItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border-b border-slate-200 last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.product?.name || 'Unknown Product'}</p>
                          <p className="text-sm text-slate-500">KSh {(item.price || 0).toLocaleString()} each</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">× {item.quantity}</p>
                          <p className="text-sm text-emerald-600 font-semibold">
                            KSh {((item.price || 0) * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : viewingOrder.items && viewingOrder.items.length > 0 ? (
                    viewingOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border-b border-slate-200 last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.productName}</p>
                          <p className="text-sm text-slate-500">KSh {item.price.toLocaleString()} each</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">× {item.quantity}</p>
                          <p className="text-sm text-emerald-600 font-semibold">
                            KSh {item.total.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic text-sm p-3">No items</p>
                  )}
                </div>
              </div>

              {/* Total Amount */}
              <div className="mb-4 p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total Amount</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    KSh {(viewingOrder.amount || viewingOrder.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Order Date */}
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Order Date</label>
                <p className="text-slate-700 font-medium">{new Date(viewingOrder.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setViewingOrder(null)}
                className="w-full px-6 py-3 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors font-medium text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingOrder && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                Edit Order #{editingOrder.orderNumber || editingOrder.id}
              </h2>

              {/* Customer Info */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <p className="text-slate-900 font-semibold">{editingOrder.customer.name}</p>
              </div>

              {/* Order Items Display */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Items</label>
                <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {editingOrder.saleItems && editingOrder.saleItems.length > 0 ? (
                    editingOrder.saleItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm py-1">
                        <span>{item.product?.name || 'Unknown Product'}</span>
                        <span>× {item.quantity}</span>
                      </div>
                    ))
                  ) : editingOrder.items && editingOrder.items.length > 0 ? (
                    editingOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm py-1">
                        <span>{item.productName}</span>
                        <span>× {item.quantity}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic text-sm">No items</p>
                  )}
                </div>
              </div>

              {/* Total Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
                <p className="text-lg font-bold text-emerald-600">
                  KSh {(editingOrder.amount || editingOrder.totalAmount || 0).toLocaleString()}
                </p>
              </div>

              {/* Order Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
                <p className="text-slate-700">{new Date(editingOrder.date).toLocaleDateString()}</p>
              </div>

              {/* Status update */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) =>
                    setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })
                  }
                  className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm sm:text-base ${getStatusColor(editingOrder.status)}`}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setEditingOrder(null)}
                  disabled={isUpdatingStatus}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updateOrderStatus(editingOrder.id, editingOrder.status);
                      setEditingOrder(null);
                    } catch (error) {
                      console.error("Error updating order:", error);
                      alert("Failed to update order status. Please try again.");
                    }
                  }}
                  disabled={isUpdatingStatus}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 text-white hover:shadow-lg transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading/Processing Overlay */}
      {(isUpdatingStatus || isDeletingOrder) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-500"></div>
            <p className="text-slate-700 font-semibold text-lg">
              {isUpdatingStatus ? "Updating order status..." : "Deleting order..."}
            </p>
            <p className="text-slate-500 text-sm">Please wait</p>
          </div>
        </div>
      )}
    </div>
  );
}